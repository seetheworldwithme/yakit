package db

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func hasColumn(t *testing.T, conn *sql.DB, table, column string) bool {
	t.Helper()
	rows, err := conn.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		t.Fatalf("query table_info failed: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull, pk int
		var defaultValue sql.NullString
		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk); err != nil {
			t.Fatalf("scan table_info failed: %v", err)
		}
		if name == column {
			return true
		}
	}
	return false
}

func TestInitSchema_AddsGoodsNameColumnForLegacyCleanTxn(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "legacy.db")

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	defer conn.Close()

	// Simulate a legacy clean_txn schema without goods_name.
	if _, err := conn.Exec(`
		CREATE TABLE clean_txn (
			txn_id TEXT PRIMARY KEY,
			bill_no TEXT,
			bill_code TEXT,
			payer_name TEXT,
			payer_id TEXT,
			payee_name TEXT,
			payee_id TEXT,
			amount_with_tax REAL,
			amount REAL,
			tax REAL,
			rate REAL,
			invoice_time DATETIME,
			month TEXT,
			is_void INTEGER,
			source_type TEXT,
			source_file TEXT
		);
	`); err != nil {
		t.Fatalf("create legacy clean_txn failed: %v", err)
	}

	if hasColumn(t, conn, "clean_txn", "goods_name") {
		t.Fatal("goods_name should not exist before migration in this test setup")
	}

	if err := initSchema(conn); err != nil {
		t.Fatalf("initSchema failed: %v", err)
	}

	if !hasColumn(t, conn, "clean_txn", "goods_name") {
		t.Fatal("goods_name column should be added for legacy clean_txn")
	}
}
