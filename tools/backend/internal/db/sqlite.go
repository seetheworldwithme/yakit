package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func OpenSQLite(dbPath string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, err
	}
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	if err := conn.Ping(); err != nil {
		return nil, err
	}
	if err := initSchema(conn); err != nil {
		return nil, err
	}
	return conn, nil
}

func TruncateAll(db *sql.DB) error {
	tables := []string{
		"money_edge",
		"clean_txn",
		"raw_invoice",
		"raw_taxpayer",
		"entity",
		"penetration_result",
		"profile_result",
		"report_task",
	}
	for _, t := range tables {
		if _, err := db.Exec("DELETE FROM " + t); err != nil {
			return err
		}
	}
	return nil
}

func initSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS raw_invoice (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source_file TEXT NOT NULL,
			source_type TEXT NOT NULL,
			row_no INTEGER NOT NULL,
			payload_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS raw_taxpayer (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source_file TEXT NOT NULL,
			row_no INTEGER NOT NULL,
			payload_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS clean_txn (
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
			goods_name TEXT,
			source_type TEXT,
			source_file TEXT
		);`,
		`CREATE TABLE IF NOT EXISTS entity (
			entity_key TEXT PRIMARY KEY,
			name TEXT,
			id_no TEXT,
			kind TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS money_edge (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source_entity TEXT NOT NULL,
			target_entity TEXT NOT NULL,
			amount REAL NOT NULL,
			count INTEGER NOT NULL,
			invoice_time DATETIME,
			bill_no TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS penetration_result (
			task_id TEXT PRIMARY KEY,
			params_json TEXT NOT NULL,
			result_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS profile_result (
			task_id TEXT PRIMARY KEY,
			params_json TEXT NOT NULL,
			result_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS report_task (
			task_id TEXT PRIMARY KEY,
			output_path TEXT NOT NULL,
			status TEXT NOT NULL,
			result_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_clean_txn_payer ON clean_txn(payer_name, payer_id);`,
		`CREATE INDEX IF NOT EXISTS idx_clean_txn_payee ON clean_txn(payee_name, payee_id);`,
		`CREATE INDEX IF NOT EXISTS idx_clean_txn_bill ON clean_txn(bill_no, bill_code);`,
		`CREATE INDEX IF NOT EXISTS idx_clean_txn_time ON clean_txn(invoice_time);`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	if err := ensureColumnExists(db, "clean_txn", "goods_name", "TEXT"); err != nil {
		return err
	}
	return nil
}

func ensureColumnExists(db *sql.DB, table, column, columnType string) error {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &dataType, &notNull, &dflt, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}

	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, columnType))
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
			return nil
		}
		return err
	}
	return nil
}
