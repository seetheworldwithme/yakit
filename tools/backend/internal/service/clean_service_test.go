package service

import (
	"encoding/csv"
	"os"
	"path/filepath"
	"testing"

	"antifraud-workbench/backend/internal/db"
	"antifraud-workbench/backend/internal/model"
)

func TestCleanRun_SupportsFundFiles(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	transactionPath := writeCSV(t, tmp, "交易明细.csv", [][]string{
		{"交易卡号", "交易账号", "交易户名", "交易证件号", "交易时间", "交易金额", "交易余额", "收付标志", "交易对手账卡号", "对手户名", "对手证件号", "对手开户银行", "摘要说明", "交易是否成功", "IP地址", "MAC地址", "交易流水号"},
		{"CARD-001", "ACC-001", "资金主体甲", "ID-001", "2026-03-31 10:00:00", "8888.50", "10000", "出", "CARD-002", "下游乙", "ID-002", "测试银行", "货款", "1", "10.0.0.9", "AA-BB-CC", "FLOW-001"},
	})
	personPath := writeCSV(t, tmp, "人员信息.csv", [][]string{
		{"客户名称", "证照号码", "单位电话", "代办人姓名", "代办人证件号码", "法人代表"},
		{"资金主体甲", "ID-001", "13800138000", "代理人张三", "AGENT-1", "法人甲"},
	})
	accountPath := writeCSV(t, tmp, "账户信息.csv", [][]string{
		{"账户开户名称", "开户人证件号码", "交易卡号", "交易账号", "账号开户银行"},
		{"资金主体甲", "ID-001", "CARD-001", "ACC-001", "测试银行"},
	})
	subAccountPath := writeCSV(t, tmp, "子账户信息.csv", [][]string{
		{"银行名称", "开户账号", "子账户账号", "余额", "子账户类别"},
		{"测试银行", "ACC-001", "SUB-001", "10000", "活期"},
	})

	svc := NewCleanService(conn, NewTaskHub())
	svc.run("clean_fund", model.CleanRequest{Paths: []string{transactionPath, personPath, accountPath, subAccountPath}})

	res, ok := svc.GetResult("clean_fund")
	if !ok {
		t.Fatal("expected clean result to be stored")
	}
	if len(res.Errors) > 0 {
		t.Fatalf("expected no clean errors, got %v", res.Errors)
	}
	if res.AfterRows != 1 {
		t.Fatalf("expected 1 normalized fund transaction, got %d", res.AfterRows)
	}

	var payer, payee, billNo, sourceType string
	var amount float64
	if err := conn.QueryRow(`SELECT payer_name,payee_name,bill_no,amount_with_tax,source_type FROM clean_txn LIMIT 1`).
		Scan(&payer, &payee, &billNo, &amount, &sourceType); err != nil {
		t.Fatalf("query clean_txn: %v", err)
	}
	if payer != "资金主体甲" || payee != "下游乙" {
		t.Fatalf("unexpected normalized parties: payer=%q payee=%q", payer, payee)
	}
	if billNo != "FLOW-001" {
		t.Fatalf("expected fund serial number as bill_no, got %q", billNo)
	}
	if amount != 8888.50 {
		t.Fatalf("unexpected normalized amount: %.2f", amount)
	}
	if sourceType != "fund_transaction" {
		t.Fatalf("expected fund source type, got %q", sourceType)
	}
}

func TestCleanRun_FundDirectionUsesFlowFlag(t *testing.T) {
	tmp := t.TempDir()
	conn, err := db.OpenSQLite(filepath.Join(tmp, "app.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer conn.Close()

	transactionPath := writeCSV(t, tmp, "交易明细_收款.csv", [][]string{
		{"交易卡号", "交易账号", "交易户名", "交易证件号", "交易时间", "交易金额", "交易余额", "收付标志", "交易对手账卡号", "对手户名", "对手证件号", "对手开户银行", "摘要说明", "交易是否成功", "IP地址", "MAC地址", "交易流水号"},
		{"CARD-001", "ACC-001", "资金主体甲", "ID-001", "2026-03-31 10:00:00", "2000", "12000", "收", "CARD-002", "来款方乙", "ID-002", "测试银行", "货款回笼", "1", "10.0.0.9", "AA-BB-CC", "FLOW-IN-001"},
	})

	svc := NewCleanService(conn, NewTaskHub())
	svc.run("clean_fund_direction", model.CleanRequest{Paths: []string{transactionPath}})

	res, ok := svc.GetResult("clean_fund_direction")
	if !ok {
		t.Fatal("expected clean result to be stored")
	}
	if len(res.Errors) > 0 {
		t.Fatalf("expected no clean errors, got %v", res.Errors)
	}

	var payer, payee string
	if err := conn.QueryRow(`SELECT payer_name,payee_name FROM clean_txn LIMIT 1`).Scan(&payer, &payee); err != nil {
		t.Fatalf("query clean_txn: %v", err)
	}
	if payer != "来款方乙" || payee != "资金主体甲" {
		t.Fatalf("flow flag should reverse direction for inflow, payer=%q payee=%q", payer, payee)
	}
}

func writeCSV(t *testing.T, dir, name string, rows [][]string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create csv: %v", err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	if err := w.WriteAll(rows); err != nil {
		t.Fatalf("write csv: %v", err)
	}
	w.Flush()
	if err := w.Error(); err != nil {
		t.Fatalf("flush csv: %v", err)
	}
	return path
}
