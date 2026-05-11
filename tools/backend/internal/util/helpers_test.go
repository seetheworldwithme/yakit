package util

import "testing"

func TestParseFloat(t *testing.T) {
	got := ParseFloat("1,234.56")
	if got != 1234.56 {
		t.Fatalf("ParseFloat mismatch: %v", got)
	}
}

func TestParseInvoiceTime(t *testing.T) {
	got := ParseInvoiceTime("2019-01-15 16:22:24")
	if got.IsZero() {
		t.Fatal("expected parsed time")
	}
}

func TestNormalizeEntity(t *testing.T) {
	got := NormalizeEntity("A公司", "123")
	if got != "A公司" {
		t.Fatalf("unexpected: %s", got)
	}
}
