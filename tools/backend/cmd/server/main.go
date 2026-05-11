package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"antifraud-workbench/backend/internal/app"
)

func main() {
	addr := envOr("APP_ADDR", "127.0.0.1:18080")
	dbPath := envOr("APP_DB_PATH", "data/app.db")

	server, err := app.NewServer(addr, dbPath)
	if err != nil {
		log.Fatalf("init server failed: %v", err)
	}

	go func() {
		log.Printf("backend listening on http://%s", addr)
		if err := server.Start(); err != nil {
			log.Printf("server stopped: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Close(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func envOr(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
