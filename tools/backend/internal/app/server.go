package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"sort"
	"strings"
	"time"

	"antifraud-workbench/backend/internal/db"
	"antifraud-workbench/backend/internal/model"
	"antifraud-workbench/backend/internal/service"
	"antifraud-workbench/backend/internal/util"
)

type Server struct {
	addr       string
	httpServer *http.Server
	db         *sql.DB
	hub        *service.TaskHub
	clean      *service.CleanService
	penetrate  *service.PenetrationService
	profile    *service.ProfileService
	report     *service.ReportService
}

func NewServer(addr, dbPath string) (*Server, error) {
	conn, err := db.OpenSQLite(dbPath)
	if err != nil {
		return nil, err
	}
	hub := service.NewTaskHub()
	cleanSvc := service.NewCleanService(conn, hub)
	penetrateSvc := service.NewPenetrationService(conn)
	profileSvc := service.NewProfileService(conn)
	reportSvc := service.NewReportService(conn, penetrateSvc, profileSvc)

	s := &Server{
		addr:      addr,
		db:        conn,
		hub:       hub,
		clean:     cleanSvc,
		penetrate: penetrateSvc,
		profile:   profileSvc,
		report:    reportSvc,
	}
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: s.routes(),
	}
	return s, nil
}

func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

func (s *Server) Close(ctx context.Context) error {
	errs := []error{}
	if s.httpServer != nil {
		if err := s.httpServer.Shutdown(ctx); err != nil {
			errs = append(errs, err)
		}
	}
	if s.db != nil {
		if err := s.db.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":   true,
			"time": time.Now().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("POST /clean/preview", func(w http.ResponseWriter, r *http.Request) {
		req, err := decodeJSON[model.CleanRequest](r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		resp, err := s.clean.Preview(req)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("POST /clean/upload", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(256 << 20); err != nil {
			log.Printf("[clean/upload] parse multipart failed: %v", err)
			writeError(w, http.StatusBadRequest, "invalid multipart form")
			return
		}
		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			log.Printf("[clean/upload] no files in multipart form")
			writeError(w, http.StatusBadRequest, "no files uploaded")
			return
		}
		uploadDir := filepath.Join("data", "uploads")
		if err := os.MkdirAll(uploadDir, 0o755); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		paths := make([]string, 0, len(files))
		for i, fh := range files {
			src, err := fh.Open()
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			defer src.Close()

			name := filepath.Base(fh.Filename)
			dstName := fmt.Sprintf("%d_%d_%s", time.Now().UnixMilli(), i, name)
			dstPath := filepath.Join(uploadDir, dstName)

			dst, err := os.Create(dstPath)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if _, err := io.Copy(dst, src); err != nil {
				dst.Close()
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			_ = dst.Close()

			absPath, _ := filepath.Abs(dstPath)
			paths = append(paths, absPath)
		}
		log.Printf("[clean/upload] uploaded files=%d", len(paths))
		writeJSON(w, http.StatusOK, map[string]any{
			"count": len(paths),
			"paths": paths,
		})
	})

	mux.HandleFunc("POST /clean/run", func(w http.ResponseWriter, r *http.Request) {
		req, err := decodeJSON[model.CleanRequest](r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		taskID := util.NewTaskID("clean")
		s.clean.RunAsync(taskID, req)
		writeJSON(w, http.StatusAccepted, map[string]any{
			"taskId":    taskID,
			"streamUrl": fmt.Sprintf("http://%s/clean/stream/%s", s.addr, taskID),
		})
	})

	mux.HandleFunc("GET /clean/stream/{taskID}", func(w http.ResponseWriter, r *http.Request) {
		taskID := r.PathValue("taskID")
		if taskID == "" {
			writeError(w, http.StatusBadRequest, "missing taskID")
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			writeError(w, http.StatusInternalServerError, "streaming unsupported")
			return
		}

		events, cancel := s.hub.Subscribe(taskID)
		defer cancel()
		ctx := r.Context()

		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-events:
				if !ok {
					return
				}
				raw, _ := json.Marshal(evt)
				_, _ = w.Write([]byte("data: " + string(raw) + "\n\n"))
				flusher.Flush()
				if evt.Status == "completed" || evt.Status == "failed" {
					return
				}
			}
		}
	})

	mux.HandleFunc("GET /clean/result/{taskID}", func(w http.ResponseWriter, r *http.Request) {
		taskID := r.PathValue("taskID")
		res, ok := s.clean.GetResult(taskID)
		if !ok {
			writeError(w, http.StatusNotFound, "task result not found")
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("POST /penetration/run", func(w http.ResponseWriter, r *http.Request) {
		req, err := decodeJSON[model.PenetrationRequest](r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		taskID := util.NewTaskID("penetration")
		res, err := s.penetrate.Run(taskID, req)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("GET /penetration/options", func(w http.ResponseWriter, r *http.Request) {
		entryType := strings.TrimSpace(r.URL.Query().Get("entryType"))
		if entryType == "" {
			entryType = "entity"
		}
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		options, err := s.penetrate.ListEntryOptions(entryType, q, 60)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		sort.Strings(options)
		writeJSON(w, http.StatusOK, map[string]any{
			"entryType": entryType,
			"options":   options,
		})
	})

	mux.HandleFunc("GET /penetration/graph/{taskID}", func(w http.ResponseWriter, r *http.Request) {
		taskID := r.PathValue("taskID")
		res, ok := s.penetrate.Get(taskID)
		if !ok {
			writeError(w, http.StatusNotFound, "task result not found")
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("POST /profile/run", func(w http.ResponseWriter, r *http.Request) {
		req, err := decodeJSON[model.ProfileRequest](r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		taskID := util.NewTaskID("profile")
		res, err := s.profile.Run(taskID, req)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("GET /profile/result/{taskID}", func(w http.ResponseWriter, r *http.Request) {
		taskID := r.PathValue("taskID")
		res, ok := s.profile.Get(taskID)
		if !ok {
			writeError(w, http.StatusNotFound, "task result not found")
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("POST /report/generate", func(w http.ResponseWriter, r *http.Request) {
		req, err := decodeJSON[model.ReportRequest](r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		taskID := util.NewTaskID("report")
		res, err := s.report.Generate(taskID, req)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("GET /download", func(w http.ResponseWriter, r *http.Request) {
		target := strings.TrimSpace(r.URL.Query().Get("path"))
		if target == "" {
			writeError(w, http.StatusBadRequest, "path is required")
			return
		}
		abs, err := filepath.Abs(target)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid path")
			return
		}
		if _, err := os.Stat(abs); err != nil {
			writeError(w, http.StatusNotFound, "file not found")
			return
		}
		http.ServeFile(w, r, abs)
	})

	return withRecover(withRequestLog(withCORS(mux)))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

func withRequestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("[api] %s %s -> %d (%s)", r.Method, r.URL.Path, rec.status, time.Since(start))
	})
}

func withRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("[panic] %v\n%s", rec, string(debug.Stack()))
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func decodeJSON[T any](body io.ReadCloser) (T, error) {
	defer body.Close()
	var req T
	err := json.NewDecoder(body).Decode(&req)
	return req, err
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{
		"error": msg,
	})
}
