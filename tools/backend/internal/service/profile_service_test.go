package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"

	"antifraud-workbench/backend/internal/db"
	"antifraud-workbench/backend/internal/model"
)

func TestQueryHourStats_IgnoresInvalidInvoiceTime(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	if _, err := conn.Exec(`
		INSERT INTO clean_txn(txn_id,invoice_time) VALUES
		('txn-valid','2026-03-30 14:20:00'),
		('txn-invalid-empty',''),
		('txn-invalid-text','not-a-time')
	`); err != nil {
		t.Fatalf("insert clean_txn: %v", err)
	}

	svc := NewProfileService(conn)
	stats, err := svc.queryHourStats()
	if err != nil {
		t.Fatalf("queryHourStats should tolerate invalid invoice_time rows: %v", err)
	}
	if len(stats) != 1 {
		t.Fatalf("expected only one valid hour bucket, got %d, stats=%+v", len(stats), stats)
	}
	if stats[0].Hour != 14 || stats[0].Count != 1 {
		t.Fatalf("unexpected hour bucket: %+v", stats[0])
	}
}

func TestRun_AssignsOneBasedGangIDs(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "txn-1", "BILL-1", "甲下游", "X1", "甲公司", "A", 1000, "2026-03-30 10:00:00")
	insertTxn(t, conn, "txn-2", "BILL-2", "乙下游", "X2", "乙公司", "B", 800, "2026-03-30 11:00:00")
	insertEntity(t, conn, "甲下游", "X1")
	insertEntity(t, conn, "乙下游", "X2")
	insertEntity(t, conn, "甲公司", "A")
	insertEntity(t, conn, "乙公司", "B")
	insertRawInvoice(t, conn, map[string]string{
		"销货方名称":     "甲公司",
		"销货方纳税人识别号": "A",
		"IP":        "10.0.0.8",
	})
	insertRawInvoice(t, conn, map[string]string{
		"销货方名称":     "乙公司",
		"销货方纳税人识别号": "B",
		"IP":        "10.0.0.8",
	})

	svc := NewProfileService(conn)
	result, err := svc.Run("task-1", model.ProfileRequest{MinEdgeAmount: 0, MinPairCount: 1})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}

	if result.GangCount != 1 {
		t.Fatalf("expected 1 gang, got %d", result.GangCount)
	}
	if len(result.Gangs) != 1 || result.Gangs[0].GangID != 1 {
		t.Fatalf("expected gang metadata to start from 1, got %+v", result.Gangs)
	}
	if got := findNodeGangID(result.Graph.Nodes, "甲公司"); got != 1 {
		t.Fatalf("expected 甲公司 to use one-based gangId, got %d", got)
	}
	if got := findNodeGangID(result.Graph.Nodes, "乙公司"); got != 1 {
		t.Fatalf("expected 乙公司 to use one-based gangId, got %d", got)
	}
}

func TestRun_GroupsCompaniesBySharedInvoiceDevice(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "txn-a", "BILL-A", "买方甲", "BX", "甲公司", "A", 1000, "2026-03-30 10:00:00")
	insertTxn(t, conn, "txn-b", "BILL-B", "买方乙", "BY", "乙公司", "B", 900, "2026-03-30 11:00:00")
	insertEntity(t, conn, "买方甲", "BX")
	insertEntity(t, conn, "买方乙", "BY")
	insertEntity(t, conn, "甲公司", "A")
	insertEntity(t, conn, "乙公司", "B")
	insertRawInvoice(t, conn, map[string]string{
		"销货方名称":     "甲公司",
		"销货方纳税人识别号": "A",
		"IP":        "10.10.1.1",
		"MAC":       "AA-BB-CC",
	})
	insertRawInvoice(t, conn, map[string]string{
		"销货方名称":     "乙公司",
		"销货方纳税人识别号": "B",
		"IP":        "10.10.1.1",
	})

	svc := NewProfileService(conn)
	result, err := svc.Run("task-device", model.ProfileRequest{MinEdgeAmount: 0})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}

	if result.GangCount != 1 {
		t.Fatalf("expected 1 evidence-based gang, got %d", result.GangCount)
	}
	if result.Gangs[0].Size != 2 {
		t.Fatalf("expected the device-based gang to contain 2 companies, got %+v", result.Gangs[0])
	}
}

func TestRun_DoesNotGroupCompaniesBySharedTaxpayerPersonOnly(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "txn-c", "BILL-C", "买方丙", "CX", "丙公司", "C", 1000, "2026-03-30 10:00:00")
	insertTxn(t, conn, "txn-d", "BILL-D", "买方丁", "DX", "丁公司", "D", 1200, "2026-03-30 11:00:00")
	insertEntity(t, conn, "买方丙", "CX")
	insertEntity(t, conn, "买方丁", "DX")
	insertEntity(t, conn, "丙公司", "C")
	insertEntity(t, conn, "丁公司", "D")
	insertRawTaxpayer(t, conn, map[string]string{
		"纳税人名称":      "丙公司",
		"纳税人识别号":     "C",
		"法定代表人姓名":    "张三",
		"法定代表人身份证号码": "320123198001011111",
	})
	insertRawTaxpayer(t, conn, map[string]string{
		"纳税人名称":      "丁公司",
		"纳税人识别号":     "D",
		"法定代表人姓名":    "张三",
		"法定代表人身份证号码": "320123198001011111",
	})

	svc := NewProfileService(conn)
	result, err := svc.Run("task-person", model.ProfileRequest{MinEdgeAmount: 0})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}

	if result.GangCount != 0 {
		t.Fatalf("expected 0 gang because only IP/MAC and high-frequency rules are enabled, got %d", result.GangCount)
	}
}

func TestRun_DoesNotCreateGangFromTransactionsOnly(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "txn-1", "BILL-1", "甲公司", "A", "乙公司", "B", 1000, "2026-03-30 10:00:00")
	insertTxn(t, conn, "txn-2", "BILL-2", "乙公司", "B", "丙公司", "C", 900, "2026-03-30 11:00:00")
	insertEntity(t, conn, "甲公司", "A")
	insertEntity(t, conn, "乙公司", "B")
	insertEntity(t, conn, "丙公司", "C")

	svc := NewProfileService(conn)
	result, err := svc.Run("task-no-evidence", model.ProfileRequest{MinEdgeAmount: 0})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}

	if result.GangCount != 0 {
		t.Fatalf("expected 0 gangs without shared evidence, got %d", result.GangCount)
	}
	for _, node := range result.Graph.Nodes {
		if node.GangID != 0 {
			t.Fatalf("expected transaction-only node %q to stay ungrouped, got gangId=%d", node.ID, node.GangID)
		}
	}
}

func TestRun_GroupsFundAccountsBySharedDevice(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "fund-1", "FLOW-1", "资金主体甲", "ID-001", "对手甲", "CP-001", 1200, "2026-03-30 10:00:00")
	insertTxn(t, conn, "fund-2", "FLOW-2", "资金主体乙", "ID-002", "对手乙", "CP-002", 900, "2026-03-30 11:00:00")
	insertEntity(t, conn, "资金主体甲", "ID-001")
	insertEntity(t, conn, "资金主体乙", "ID-002")
	insertEntity(t, conn, "对手甲", "CP-001")
	insertEntity(t, conn, "对手乙", "CP-002")
	insertRawInvoice(t, conn, map[string]string{
		"交易户名":  "资金主体甲",
		"交易证件号": "ID-001",
		"IP地址":  "172.16.1.8",
		"MAC地址": "AA-BB-CC",
	})
	insertRawInvoice(t, conn, map[string]string{
		"交易户名":  "资金主体乙",
		"交易证件号": "ID-002",
		"IP地址":  "172.16.1.8",
	})

	svc := NewProfileService(conn)
	result, err := svc.Run("fund-device", model.ProfileRequest{MinEdgeAmount: 0})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}
	if result.GangCount != 1 {
		t.Fatalf("expected 1 fund device-based gang, got %d", result.GangCount)
	}
	if result.Gangs[0].Size != 2 {
		t.Fatalf("expected 2 members in fund device-based gang, got %+v", result.Gangs[0])
	}
}

func TestRun_DoesNotGroupFundAccountsBySharedAgentOnly(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "fund-3", "FLOW-3", "资金主体丙", "ID-003", "对手丙", "CP-003", 2200, "2026-03-30 10:00:00")
	insertTxn(t, conn, "fund-4", "FLOW-4", "资金主体丁", "ID-004", "对手丁", "CP-004", 1900, "2026-03-30 11:00:00")
	insertEntity(t, conn, "资金主体丙", "ID-003")
	insertEntity(t, conn, "资金主体丁", "ID-004")
	insertRawTaxpayer(t, conn, map[string]string{
		"客户名称":    "资金主体丙",
		"证照号码":    "ID-003",
		"代办人姓名":   "代理人李四",
		"代办人证件号码": "AGENT-2",
	})
	insertRawTaxpayer(t, conn, map[string]string{
		"客户名称":    "资金主体丁",
		"证照号码":    "ID-004",
		"代办人姓名":   "代理人李四",
		"代办人证件号码": "AGENT-2",
	})

	svc := NewProfileService(conn)
	result, err := svc.Run("fund-agent", model.ProfileRequest{MinEdgeAmount: 0})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}
	if result.GangCount != 0 {
		t.Fatalf("expected 0 gang because only IP/MAC and high-frequency rules are enabled, got %d", result.GangCount)
	}
}

func TestRun_GroupsByHighFrequencyWhenNoDeviceEvidence(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertEntity(t, conn, "甲公司", "A")
	insertEntity(t, conn, "乙公司", "B")
	for i := 0; i < 50; i++ {
		insertTxn(
			t,
			conn,
			fmt.Sprintf("txn-hf-%d", i),
			fmt.Sprintf("BILL-HF-%d", i),
			"甲公司",
			"A",
			"乙公司",
			"B",
			100+float64(i),
			"2026-03-30 10:00:00",
		)
	}

	svc := NewProfileService(conn)
	result, err := svc.Run("task-hf", model.ProfileRequest{MinEdgeAmount: 0, MinPairCount: 50})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}
	if result.GangCount != 1 {
		t.Fatalf("expected 1 gang from high-frequency fallback, got %d", result.GangCount)
	}
	if len(result.Graph.Links) == 0 {
		t.Fatalf("expected graph links to keep >=50 pair links")
	}
}

func TestRun_FiltersLowFrequencyEdgesFromGraph(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertEntity(t, conn, "甲公司", "A")
	insertEntity(t, conn, "乙公司", "B")
	insertEntity(t, conn, "丙公司", "C")
	insertEntity(t, conn, "丁公司", "D")

	for i := 0; i < 50; i++ {
		insertTxn(
			t,
			conn,
			fmt.Sprintf("txn-keep-%d", i),
			fmt.Sprintf("BILL-KEEP-%d", i),
			"甲公司",
			"A",
			"乙公司",
			"B",
			200,
			"2026-03-30 09:00:00",
		)
	}
	for i := 0; i < 20; i++ {
		insertTxn(
			t,
			conn,
			fmt.Sprintf("txn-drop-%d", i),
			fmt.Sprintf("BILL-DROP-%d", i),
			"丙公司",
			"C",
			"丁公司",
			"D",
			200,
			"2026-03-30 11:00:00",
		)
	}

	svc := NewProfileService(conn)
	result, err := svc.Run("task-edge-filter", model.ProfileRequest{MinEdgeAmount: 0, MinPairCount: 50})
	if err != nil {
		t.Fatalf("run profile: %v", err)
	}

	for _, l := range result.Graph.Links {
		if l.Count < 50 {
			t.Fatalf("expected low-frequency links (<50) to be filtered, got %+v", l)
		}
	}
}

func TestRun_FiltersByEntryValue(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	insertTxn(t, conn, "txn-a", "BILL-A", "目标公司", "T-001", "往来甲", "CP-001", 1800, "2026-03-30 09:00:00")
	insertTxn(t, conn, "txn-b", "BILL-B", "其他公司", "O-001", "往来乙", "CP-002", 2200, "2026-03-30 11:00:00")
	insertEntity(t, conn, "目标公司", "T-001")
	insertEntity(t, conn, "往来甲", "CP-001")
	insertEntity(t, conn, "其他公司", "O-001")
	insertEntity(t, conn, "往来乙", "CP-002")

	svc := NewProfileService(conn)
	result, err := svc.Run("task-filter", model.ProfileRequest{
		MinEdgeAmount: 0,
		MinPairCount:  1,
		EntryType:     "entity",
		EntryValue:    "目标公司",
	})
	if err != nil {
		t.Fatalf("run profile with entry filter: %v", err)
	}

	if hasNode(result.Graph.Nodes, "其他公司") || hasNode(result.Graph.Nodes, "往来乙") {
		t.Fatalf("expected filtered graph to exclude unrelated nodes, got %+v", result.Graph.Nodes)
	}
	if !hasNode(result.Graph.Nodes, "目标公司") || !hasNode(result.Graph.Nodes, "往来甲") {
		t.Fatalf("expected filtered graph to keep clue-related nodes, got %+v", result.Graph.Nodes)
	}
}

func insertTxn(t *testing.T, conn *sql.DB, txnID, billNo, payerName, payerID, payeeName, payeeID string, amount float64, invoiceTime string) {
	t.Helper()
	if _, err := conn.Exec(`
		INSERT INTO clean_txn(txn_id,bill_no,payer_name,payer_id,payee_name,payee_id,amount_with_tax,invoice_time)
		VALUES(?,?,?,?,?,?,?,?)`,
		txnID, billNo, payerName, payerID, payeeName, payeeID, amount, invoiceTime,
	); err != nil {
		t.Fatalf("insert clean_txn: %v", err)
	}
}

func insertEntity(t *testing.T, conn *sql.DB, name, id string) {
	t.Helper()
	if _, err := conn.Exec(
		`INSERT INTO entity(entity_key,name,id_no,kind) VALUES(?,?,?,?)`,
		fmt.Sprintf("%s(%s)", name, id), name, id, "company",
	); err != nil {
		t.Fatalf("insert entity: %v", err)
	}
}

func insertRawInvoice(t *testing.T, conn *sql.DB, row map[string]string) {
	t.Helper()
	if _, err := conn.Exec(
		`INSERT INTO raw_invoice(source_file,source_type,row_no,payload_json) VALUES(?,?,?,?)`,
		"test-invoice.xlsx", "special_sell", 2, mustJSON(t, row),
	); err != nil {
		t.Fatalf("insert raw_invoice: %v", err)
	}
}

func insertRawTaxpayer(t *testing.T, conn *sql.DB, row map[string]string) {
	t.Helper()
	if _, err := conn.Exec(
		`INSERT INTO raw_taxpayer(source_file,row_no,payload_json) VALUES(?,?,?)`,
		"test-taxpayer.xlsx", 2, mustJSON(t, row),
	); err != nil {
		t.Fatalf("insert raw_taxpayer: %v", err)
	}
}

func mustJSON(t *testing.T, v map[string]string) string {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}
	return string(raw)
}

func findNodeGangID(nodes []model.GraphNode, label string) int {
	for _, node := range nodes {
		if node.Label == label {
			return node.GangID
		}
	}
	return -999
}

func hasNode(nodes []model.GraphNode, label string) bool {
	for _, node := range nodes {
		if node.Label == label {
			return true
		}
	}
	return false
}
