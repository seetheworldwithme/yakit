package service

import (
	"database/sql"
	"path/filepath"
	"testing"

	"antifraud-workbench/backend/internal/db"
	"antifraud-workbench/backend/internal/model"
	_ "modernc.org/sqlite"
)

func TestBuildPenetrationGraph(t *testing.T) {
	txns := []txnEdge{
		{TxnID: "1", PayerName: "A", PayeeName: "B", Amount: 100},
		{TxnID: "2", PayerName: "B", PayeeName: "C", Amount: 80},
		{TxnID: "3", PayerName: "X", PayeeName: "Y", Amount: 50},
	}

	graph := BuildPenetrationGraph(txns, []string{"A"}, 2, "outbound")
	if len(graph.Nodes) == 0 || len(graph.Links) == 0 {
		t.Fatalf("graph should not be empty: nodes=%d links=%d", len(graph.Nodes), len(graph.Links))
	}

	foundC := false
	for _, n := range graph.Nodes {
		if n.Label == "C" {
			foundC = true
		}
	}
	if !foundC {
		t.Fatal("expected to reach node C in 2 hops")
	}
}

func TestBuildPenetrationGraph_DownstreamOnly(t *testing.T) {
	txns := []txnEdge{
		{TxnID: "1", PayerName: "纳税人A", PayeeName: "下游B", Amount: 100},
		{TxnID: "2", PayerName: "下游B", PayeeName: "下游C", Amount: 80},
		{TxnID: "3", PayerName: "上游D", PayeeName: "纳税人A", Amount: 120},
	}

	graph := BuildPenetrationGraph(txns, []string{"纳税人A"}, 2, "outbound")

	hasNode := func(label string) bool {
		for _, n := range graph.Nodes {
			if n.Label == label {
				return true
			}
		}
		return false
	}
	hasEdge := func(source, target string) bool {
		for _, l := range graph.Links {
			if l.Source == source && l.Target == target {
				return true
			}
		}
		return false
	}

	if !hasNode("下游B") || !hasNode("下游C") {
		t.Fatalf("expected downstream nodes to be included, nodes=%v", graph.Nodes)
	}
	if hasNode("上游D") {
		t.Fatalf("upstream node should not be included in downstream traversal, nodes=%v", graph.Nodes)
	}
	if hasEdge("上游D", "纳税人A") {
		t.Fatalf("upstream edge should not be included in downstream traversal, edges=%v", graph.Links)
	}
}

func TestBuildPenetrationGraph_InboundOnly(t *testing.T) {
	txns := []txnEdge{
		{TxnID: "1", PayerName: "上游D", PayeeName: "纳税人A", Amount: 120},
		{TxnID: "2", PayerName: "纳税人A", PayeeName: "下游B", Amount: 100},
		{TxnID: "3", PayerName: "下游B", PayeeName: "下游C", Amount: 80},
	}

	graph := BuildPenetrationGraph(txns, []string{"纳税人A"}, 2, "inbound")

	hasNode := func(label string) bool {
		for _, n := range graph.Nodes {
			if n.Label == label {
				return true
			}
		}
		return false
	}
	hasEdge := func(source, target string) bool {
		for _, l := range graph.Links {
			if l.Source == source && l.Target == target {
				return true
			}
		}
		return false
	}

	if !hasNode("上游D") {
		t.Fatalf("expected upstream node to be included, nodes=%v", graph.Nodes)
	}
	if hasNode("下游B") || hasNode("下游C") {
		t.Fatalf("downstream nodes should not be included in inbound traversal, nodes=%v", graph.Nodes)
	}
	if !hasEdge("上游D", "纳税人A") {
		t.Fatalf("expected inbound edge to be included, edges=%v", graph.Links)
	}
	if hasEdge("纳税人A", "下游B") {
		t.Fatalf("downstream edge should not be included in inbound traversal, edges=%v", graph.Links)
	}
}

func TestBuildPenetrationGraph_BothDirections(t *testing.T) {
	txns := []txnEdge{
		{TxnID: "1", PayerName: "上游D", PayeeName: "纳税人A", Amount: 120},
		{TxnID: "2", PayerName: "纳税人A", PayeeName: "下游B", Amount: 100},
		{TxnID: "3", PayerName: "下游B", PayeeName: "下游C", Amount: 80},
	}

	graph := BuildPenetrationGraph(txns, []string{"纳税人A"}, 2, "both")
	if len(graph.Links) != 3 {
		t.Fatalf("expected each edge to be counted once in bidirectional traversal, got %d edges", len(graph.Links))
	}

	for _, edge := range graph.Links {
		if edge.Source == "上游D" && edge.Target == "纳税人A" && edge.IsBackflow {
			t.Fatalf("direct inbound edge should not be marked as backflow in both-direction mode: %+v", edge)
		}
	}
}

func TestBuildPenetrationGraphWithOptions_TruncatesByBranchLimit(t *testing.T) {
	txns := []txnEdge{
		{TxnID: "1", PayerName: "A", PayeeName: "B1", Amount: 100},
		{TxnID: "2", PayerName: "A", PayeeName: "B2", Amount: 90},
		{TxnID: "3", PayerName: "A", PayeeName: "B3", Amount: 80},
		{TxnID: "4", PayerName: "A", PayeeName: "B4", Amount: 70},
	}

	graph, truncated, trimNote := BuildPenetrationGraphWithOptions(txns, []string{"A"}, 1, "outbound", graphBuildOptions{
		BranchLimit: 2,
		NodeLimit:   100,
		EdgeLimit:   100,
	})
	if !truncated {
		t.Fatalf("expected graph to be truncated by branch limit")
	}
	if len(graph.Links) != 2 {
		t.Fatalf("expected only top 2 outbound edges, got %d", len(graph.Links))
	}
	if trimNote == "" {
		t.Fatal("expected trim note when graph is truncated")
	}
}

func TestListEntryOptions_EntityOnlyTaxpayerName(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	svc := NewPenetrationService(conn)

	if _, err := conn.Exec(`
		INSERT INTO raw_taxpayer(source_file,row_no,payload_json) VALUES
		('tax/纳税人信息.xlsx',2,'{"纳税人名称":"测试纳税人甲","登记序号":"T001"}'),
		('tax/纳税人信息.xlsx',3,'{"纳税人名称":"测试纳税人乙","登记序号":"T002"}')
	`); err != nil {
		t.Fatalf("insert raw_taxpayer: %v", err)
	}

	if _, err := conn.Exec(`
		INSERT INTO clean_txn(txn_id,payer_name,payer_id,payee_name,payee_id,amount_with_tax) VALUES
		('txn1','购方公司A','P001','销方公司B','S001',1000),
		('txn2','购方公司C','P002','销方公司D','S002',2000)
	`); err != nil {
		t.Fatalf("insert clean_txn: %v", err)
	}

	options, err := svc.ListEntryOptions("entity", "", 60)
	if err != nil {
		t.Fatalf("ListEntryOptions: %v", err)
	}

	want := map[string]bool{"测试纳税人甲": true, "测试纳税人乙": true}
	if len(options) != len(want) {
		t.Fatalf("expected only taxpayer names, got %v", options)
	}
	for _, v := range options {
		if !want[v] {
			t.Fatalf("unexpected option %q, options=%v", v, options)
		}
	}
}

func TestListEntryOptions_EntityUsesPersonnelCustomerNames(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	svc := NewPenetrationService(conn)
	if _, err := conn.Exec(`
		INSERT INTO raw_taxpayer(source_file,row_no,payload_json) VALUES
		('fund/人员信息.xlsx',2,'{"客户名称":"资金主体甲","证照号码":"ID-001"}'),
		('fund/人员信息.xlsx',3,'{"客户名称":"资金主体乙","证照号码":"ID-002"}')
	`); err != nil {
		t.Fatalf("insert raw_taxpayer: %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO entity(entity_key,name,id_no,kind) VALUES
		('资金主体甲','资金主体甲','ID-001','account'),
		('下游乙','下游乙','ID-003','account')
	`); err != nil {
		t.Fatalf("insert entity: %v", err)
	}

	options, err := svc.ListEntryOptions("entity", "", 60)
	if err != nil {
		t.Fatalf("ListEntryOptions: %v", err)
	}

	want := map[string]bool{"资金主体甲": true, "资金主体乙": true}
	if len(options) != len(want) {
		t.Fatalf("expected only personnel customer names, got %v", options)
	}
	for _, option := range options {
		if !want[option] {
			t.Fatalf("unexpected entity option %q, options=%v", option, options)
		}
	}
}

func TestResolveSeeds_EntityPreferExactMatch(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	svc := NewPenetrationService(conn)
	if _, err := conn.Exec(`
		INSERT INTO clean_txn(txn_id,payer_name,payer_id,payee_name,payee_id,amount_with_tax) VALUES
		('txn1','测试纳税人甲','','下游B','',1000),
		('txn2','测试纳税人甲分公司','','下游C','',1500)
	`); err != nil {
		t.Fatalf("insert clean_txn: %v", err)
	}

	seeds, err := svc.resolveSeeds(model.PenetrationRequest{
		EntryType:  "entity",
		EntryValue: "测试纳税人甲",
	})
	if err != nil {
		t.Fatalf("resolveSeeds: %v", err)
	}
	if len(seeds) != 1 || seeds[0] != "测试纳税人甲" {
		t.Fatalf("expected exact seed only, got %v", seeds)
	}
}

func TestQueryTxnEdges_LegacySchemaWithoutGoodsName(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "legacy.db")
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

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
		t.Fatalf("create legacy clean_txn: %v", err)
	}
	if _, err := conn.Exec(`
		INSERT INTO clean_txn(txn_id,bill_no,payer_name,payer_id,payee_name,payee_id,amount_with_tax) VALUES
		('txn1','bill1','纳税人A','','下游B','',1234.56)
	`); err != nil {
		t.Fatalf("insert legacy clean_txn: %v", err)
	}

	svc := NewPenetrationService(conn)
	edges, err := svc.queryTxnEdges(model.PenetrationRequest{})
	if err != nil {
		t.Fatalf("queryTxnEdges should work on legacy schema: %v", err)
	}
	if len(edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(edges))
	}
	if edges[0].GoodsName != "" {
		t.Fatalf("expected empty goods name on legacy schema, got %q", edges[0].GoodsName)
	}
}
