package util

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"
)

func NewTaskID(prefix string) string {
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), rand.Intn(100000))
}

func ParseFloat(raw string) float64 {
	clean := strings.TrimSpace(strings.ReplaceAll(raw, ",", ""))
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0
	}
	return v
}

func ParseInvoiceTime(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02",
		time.RFC3339,
	}
	for _, layout := range layouts {
		if v, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
			return v
		}
	}
	return time.Time{}
}

func MonthFromTime(ts time.Time, fallback string) string {
	if ts.IsZero() {
		return strings.TrimSpace(fallback)
	}
	return ts.Format("200601")
}

func HashID(parts ...string) string {
	h := sha1.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte("|"))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func JSONString(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func NormalizeEntity(name, idNo string) string {
	name = strings.TrimSpace(name)
	idNo = strings.TrimSpace(idNo)
	// Use name only as entity key so the same company has a consistent
	// identifier regardless of whether ID is present in a given record.
	// This is critical for BFS traversal: a company may have an ID when
	// it appears as payer but no ID when it appears as payee.
	if name != "" {
		return name
	}
	if idNo != "" {
		return idNo
	}
	return "UNKNOWN"
}

func Pick(values ...string) string {
	for _, v := range values {
		t := strings.TrimSpace(v)
		if t != "" {
			return t
		}
	}
	return ""
}
