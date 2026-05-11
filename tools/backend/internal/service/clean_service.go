package service

import (
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"antifraud-workbench/backend/internal/db"
	"antifraud-workbench/backend/internal/model"
	"antifraud-workbench/backend/internal/util"

	"github.com/xuri/excelize/v2"
)

type CleanService struct {
	db      *sql.DB
	hub     *TaskHub
	mu      sync.RWMutex
	results map[string]model.CleanResult
}

type normalizedTxn struct {
	TxnID         string
	BillNo        string
	BillCode      string
	PayerName     string
	PayerID       string
	PayeeName     string
	PayeeID       string
	AmountWithTax float64
	Amount        float64
	Tax           float64
	Rate          float64
	InvoiceTime   time.Time
	Month         string
	IsVoid        int
	GoodsName     string
	SourceType    string
	SourceFile    string
}

func NewCleanService(db *sql.DB, hub *TaskHub) *CleanService {
	return &CleanService{
		db:      db,
		hub:     hub,
		results: map[string]model.CleanResult{},
	}
}

func (s *CleanService) Preview(req model.CleanRequest) (model.CleanPreviewResponse, error) {
	resp := model.CleanPreviewResponse{
		Files:         []model.FilePreview{},
		FieldMappings: map[string]bool{},
	}
	if len(req.Paths) == 0 {
		return resp, errors.New("paths is required")
	}

	for _, path := range req.Paths {
		headers, rows, err := loadTable(path)
		if err != nil {
			return resp, err
		}
		kind := detectFileKind(path, headers)
		fp := model.FilePreview{
			Path:        path,
			Kind:        kind,
			Rows:        len(rows),
			FieldSample: headers,
			Issues:      map[string]int{},
		}
		for _, header := range headers {
			resp.FieldMappings[header] = true
		}

		required := requiredFieldsForKind(kind)
		headerSet := map[string]bool{}
		for _, h := range headers {
			headerSet[h] = true
		}
		for _, rf := range required {
			if !headerSet[rf] {
				fp.Issues["missing_"+rf]++
			}
		}
		resp.TotalRows += fp.Rows
		resp.Files = append(resp.Files, fp)
	}
	return resp, nil
}

func (s *CleanService) RunAsync(taskID string, req model.CleanRequest) {
	go s.run(taskID, req)
}

func (s *CleanService) GetResult(taskID string) (model.CleanResult, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.results[taskID]
	return v, ok
}

func (s *CleanService) run(taskID string, req model.CleanRequest) {
	result := model.CleanResult{
		TaskID:  taskID,
		Issues:  map[string]int{},
		Metrics: map[string]string{},
	}
	publish := func(step, msg string, progress int, status string) {
		s.hub.Publish(model.TaskEvent{
			TaskID:   taskID,
			Status:   status,
			Step:     step,
			Message:  msg,
			Progress: progress,
		})
	}
	publish("parse", "开始解析文件", 3, "running")

	if len(req.Paths) == 0 {
		result.Errors = append(result.Errors, "paths is empty")
		s.storeResult(result)
		publish("parse", "未提供文件路径", 100, "failed")
		return
	}

	publish("db", "清空旧数据", 5, "running")
	if err := db.TruncateAll(s.db); err != nil {
		result.Errors = append(result.Errors, err.Error())
		s.storeResult(result)
		publish("db", "清空旧数据失败", 100, "failed")
		return
	}

	tx, err := s.db.Begin()
	if err != nil {
		result.Errors = append(result.Errors, err.Error())
		s.storeResult(result)
		publish("db", "数据库事务启动失败", 100, "failed")
		return
	}
	defer tx.Rollback()

	rawInvoiceStmt, _ := tx.Prepare(`INSERT INTO raw_invoice(source_file, source_type, row_no, payload_json) VALUES(?,?,?,?)`)
	rawTaxpayerStmt, _ := tx.Prepare(`INSERT INTO raw_taxpayer(source_file, row_no, payload_json) VALUES(?,?,?)`)
	cleanStmt, _ := tx.Prepare(`INSERT OR IGNORE INTO clean_txn(
		txn_id,bill_no,bill_code,payer_name,payer_id,payee_name,payee_id,amount_with_tax,amount,tax,rate,invoice_time,month,is_void,goods_name,source_type,source_file
	) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
	entityStmt, _ := tx.Prepare(`INSERT OR IGNORE INTO entity(entity_key,name,id_no,kind) VALUES(?,?,?,?)`)
	edgeStmt, _ := tx.Prepare(`INSERT INTO money_edge(source_entity,target_entity,amount,count,invoice_time,bill_no) VALUES(?,?,?,?,?,?)`)

	defer rawInvoiceStmt.Close()
	defer rawTaxpayerStmt.Close()
	defer cleanStmt.Close()
	defer entityStmt.Close()
	defer edgeStmt.Close()

	seen := map[string]bool{}

	total := len(req.Paths)
	for idx, path := range req.Paths {
		result.SourceFiles = append(result.SourceFiles, path)
		headers, rows, err := loadTable(path)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", path, err))
			continue
		}
		_ = headers

		kind := detectFileKind(path, headers)
		if kind == "tax_taxpayer" || kind == "fund_personnel" {
			for rowNo, row := range rows {
				if _, err := rawTaxpayerStmt.Exec(path, rowNo+2, util.JSONString(row)); err != nil {
					result.Errors = append(result.Errors, err.Error())
				}
			}
		} else {
			sourceType := detectSourceType(path, kind)
			for rowNo, row := range rows {
				if _, err := rawInvoiceStmt.Exec(path, sourceType, rowNo+2, util.JSONString(row)); err != nil {
					result.Errors = append(result.Errors, err.Error())
					continue
				}

				if !kindProducesTxn(kind) {
					continue
				}
				result.BeforeRows++

				txn, abnormalReason := normalizeTxn(row, kind, sourceType, path, rowNo)
				if abnormalReason != "" {
					result.AbnormalRows++
					result.Issues[abnormalReason]++
					continue
				}
				if txn.IsVoid == 1 {
					result.SkippedVoid++
					continue
				}
				dedupKey := strings.Join([]string{
					txn.BillCode, txn.BillNo, txn.InvoiceTime.Format(time.RFC3339), fmt.Sprintf("%.2f", txn.AmountWithTax), txn.PayerName, txn.PayeeName,
				}, "|")
				if seen[dedupKey] {
					result.Duplicates++
					continue
				}
				seen[dedupKey] = true
				if txn.PayerName == "" || txn.PayeeName == "" {
					result.NullFields++
				}

				if _, err := cleanStmt.Exec(
					txn.TxnID, txn.BillNo, txn.BillCode, txn.PayerName, txn.PayerID, txn.PayeeName, txn.PayeeID,
					txn.AmountWithTax, txn.Amount, txn.Tax, txn.Rate, nullableTime(txn.InvoiceTime), txn.Month, txn.IsVoid, txn.GoodsName, txn.SourceType, txn.SourceFile,
				); err != nil {
					result.Errors = append(result.Errors, err.Error())
					continue
				}
				result.AfterRows++

				payerKey := util.NormalizeEntity(txn.PayerName, txn.PayerID)
				payeeKey := util.NormalizeEntity(txn.PayeeName, txn.PayeeID)
				_, _ = entityStmt.Exec(payerKey, txn.PayerName, txn.PayerID, "company")
				_, _ = entityStmt.Exec(payeeKey, txn.PayeeName, txn.PayeeID, "company")
				_, _ = edgeStmt.Exec(payerKey, payeeKey, txn.AmountWithTax, 1, nullableTime(txn.InvoiceTime), txn.BillNo)
			}
		}
		progress := 10 + ((idx + 1) * 60 / total)
		publish("parse", fmt.Sprintf("已解析 %d/%d 个文件", idx+1, total), progress, "running")
	}

	publish("db", "写入数据库", 80, "running")
	if err := tx.Commit(); err != nil {
		result.Errors = append(result.Errors, err.Error())
		s.storeResult(result)
		publish("db", "数据库提交失败", 100, "failed")
		return
	}

	result.Metrics["cleanRate"] = fmt.Sprintf("%.2f%%", safePct(result.AfterRows, result.BeforeRows))
	result.Metrics["dedupRate"] = fmt.Sprintf("%.2f%%", safePct(result.Duplicates, result.BeforeRows))
	result.Metrics["abnormalRate"] = fmt.Sprintf("%.2f%%", safePct(result.AbnormalRows, result.BeforeRows))

	s.storeResult(result)
	publish("done", "数据清洗与入库完成", 100, "completed")
}

func (s *CleanService) storeResult(result model.CleanResult) {
	s.mu.Lock()
	s.results[result.TaskID] = result
	s.mu.Unlock()
}

func safePct(x, y int) float64 {
	if y == 0 {
		return 0
	}
	return float64(x) * 100 / float64(y)
}

func normalizeTxn(row map[string]string, kind, sourceType, sourceFile string, rowNo int) (normalizedTxn, string) {
	if kind == "fund_transaction" {
		return normalizeFundTransaction(row, sourceType, sourceFile, rowNo)
	}
	return normalizeTaxInvoice(row, sourceType, sourceFile, rowNo)
}

func normalizeTaxInvoice(row map[string]string, sourceType, sourceFile string, rowNo int) (normalizedTxn, string) {
	t := normalizedTxn{
		BillNo:     strings.TrimSpace(row["发票号码"]),
		BillCode:   strings.TrimSpace(row["发票代码"]),
		PayerName:  util.Pick(row["购货方名称"], row["纳税人名称"]),
		PayerID:    util.Pick(row["购货方识别号"], row["纳税人识别号"], row["购方登记序号"]),
		PayeeName:  util.Pick(row["销货方名称"], row["销货方纳税人识别号"]),
		PayeeID:    util.Pick(row["销货方纳税人识别号"], row["销货方识别号"]),
		Amount:     util.ParseFloat(row["货物金额"]),
		Tax:        util.ParseFloat(row["货物税额"]),
		Rate:       util.ParseFloat(row["税率"]),
		GoodsName:  strings.TrimSpace(util.Pick(row["货物或应税劳务名称"], row["货物名称"], row["商品名称"])),
		SourceType: sourceType,
		SourceFile: sourceFile,
	}
	t.AmountWithTax = util.ParseFloat(row["价税合计"])
	if t.AmountWithTax <= 0 {
		t.AmountWithTax = t.Amount + t.Tax
	}
	t.InvoiceTime = util.ParseInvoiceTime(row["开票日期"])
	t.Month = util.MonthFromTime(t.InvoiceTime, row["开票月份"])
	if strings.EqualFold(strings.TrimSpace(row["作废标志"]), "Y") {
		t.IsVoid = 1
	}
	t.TxnID = util.HashID(sourceFile, fmt.Sprintf("%d", rowNo), t.BillCode, t.BillNo, t.PayerName, t.PayeeName, fmt.Sprintf("%.2f", t.AmountWithTax))

	if t.BillNo == "" || t.BillCode == "" {
		return t, "missing_bill"
	}
	if t.PayerName == "" || t.PayeeName == "" {
		return t, "missing_party"
	}
	if t.AmountWithTax <= 0 {
		return t, "non_positive_amount"
	}
	return t, ""
}

func normalizeFundTransaction(row map[string]string, sourceType, sourceFile string, rowNo int) (normalizedTxn, string) {
	tradeName := strings.TrimSpace(row["交易户名"])
	tradeID := strings.TrimSpace(util.Pick(row["交易证件号"], row["交易账号"], row["交易卡号"]))
	counterName := strings.TrimSpace(row["对手户名"])
	counterID := strings.TrimSpace(util.Pick(row["对手证件号"], row["交易对手账卡号"]))
	flowDirection := normalizeFundFlowDirection(row["收付标志"])

	payerName := tradeName
	payerID := tradeID
	payeeName := counterName
	payeeID := counterID
	if flowDirection == "inbound" {
		payerName = counterName
		payerID = counterID
		payeeName = tradeName
		payeeID = tradeID
	}

	t := normalizedTxn{
		BillNo:     strings.TrimSpace(util.Pick(row["交易流水号"], row["凭证号"], row["传票号"])),
		BillCode:   strings.TrimSpace(util.Pick(row["交易卡号"], row["交易账号"])),
		PayerName:  payerName,
		PayerID:    payerID,
		PayeeName:  payeeName,
		PayeeID:    payeeID,
		Amount:     util.ParseFloat(row["交易金额"]),
		GoodsName:  strings.TrimSpace(util.Pick(row["摘要说明"], row["备注"])),
		SourceType: sourceType,
		SourceFile: sourceFile,
	}
	t.AmountWithTax = t.Amount
	t.InvoiceTime = util.ParseInvoiceTime(row["交易时间"])
	t.Month = util.MonthFromTime(t.InvoiceTime, "")
	if strings.TrimSpace(row["交易是否成功"]) != "" && strings.TrimSpace(row["交易是否成功"]) != "1" {
		return t, "failed_transaction"
	}
	t.TxnID = util.HashID(sourceFile, fmt.Sprintf("%d", rowNo), t.BillCode, t.BillNo, t.PayerName, t.PayeeName, fmt.Sprintf("%.2f", t.AmountWithTax))

	if t.PayerName == "" || t.PayeeName == "" {
		return t, "missing_party"
	}
	if t.AmountWithTax <= 0 {
		return t, "non_positive_amount"
	}
	return t, ""
}

func normalizeFundFlowDirection(raw string) string {
	flag := strings.ToLower(strings.TrimSpace(raw))
	if flag == "" {
		return ""
	}

	inboundHints := []string{"收", "入", "贷", "credit", "inbound", "incoming", "in"}
	outboundHints := []string{"付", "出", "借", "debit", "outbound", "outgoing", "out"}

	for _, hint := range inboundHints {
		if strings.Contains(flag, hint) {
			return "inbound"
		}
	}
	for _, hint := range outboundHints {
		if strings.Contains(flag, hint) {
			return "outbound"
		}
	}
	return ""
}

func nullableTime(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return t
}

func detectFileKind(path string, headers []string) string {
	headerSet := map[string]bool{}
	for _, h := range headers {
		headerSet[h] = true
	}
	switch {
	case hasAllHeaders(headerSet, "交易卡号", "交易户名", "交易时间", "交易金额", "收付标志"):
		return "fund_transaction"
	case hasAllHeaders(headerSet, "客户名称", "证照号码"):
		return "fund_personnel"
	case hasAllHeaders(headerSet, "账户开户名称", "交易账号"):
		return "fund_account"
	case hasAllHeaders(headerSet, "开户账号", "子账户账号"):
		return "fund_subaccount"
	case hasAllHeaders(headerSet, "登记序号", "纳税人名称"):
		return "tax_taxpayer"
	case hasAllHeaders(headerSet, "发票号码", "发票代码"):
		return "tax_invoice"
	}

	name := strings.ToLower(filepath.Base(path))
	if strings.Contains(name, "纳税人") || strings.Contains(name, "taxpayer") {
		return "tax_taxpayer"
	}
	if strings.Contains(name, "交易明细") {
		return "fund_transaction"
	}
	if strings.Contains(name, "人员信息") {
		return "fund_personnel"
	}
	if strings.Contains(name, "账户信息") && !strings.Contains(name, "子账户") {
		return "fund_account"
	}
	if strings.Contains(name, "子账户") {
		return "fund_subaccount"
	}
	return "tax_invoice"
}

func detectSourceType(path, kind string) string {
	name := filepath.Base(path)
	switch {
	case kind == "fund_transaction":
		return "fund_transaction"
	case kind == "fund_account":
		return "fund_account"
	case kind == "fund_subaccount":
		return "fund_subaccount"
	case strings.Contains(name, "专票购方"):
		return "special_buy"
	case strings.Contains(name, "专票销方"):
		return "special_sell"
	case strings.Contains(name, "普票购方"):
		return "normal_buy"
	default:
		return "invoice_generic"
	}
}

func requiredFieldsForKind(kind string) []string {
	switch kind {
	case "fund_transaction":
		return []string{"交易卡号", "交易户名", "交易时间", "交易金额", "收付标志"}
	case "fund_personnel":
		return []string{"客户名称", "证照号码"}
	case "fund_account":
		return []string{"账户开户名称", "交易账号"}
	case "fund_subaccount":
		return []string{"开户账号", "子账户账号"}
	case "tax_taxpayer":
		return []string{"登记序号", "纳税人名称"}
	default:
		return []string{"发票号码", "发票代码", "价税合计", "开票日期", "购货方名称", "销货方纳税人识别号"}
	}
}

func kindProducesTxn(kind string) bool {
	return kind == "tax_invoice" || kind == "fund_transaction"
}

func hasAllHeaders(headerSet map[string]bool, headers ...string) bool {
	for _, h := range headers {
		if !headerSet[h] {
			return false
		}
	}
	return true
}

func loadTable(path string) ([]string, []map[string]string, error) {
	resolved := strings.TrimSpace(path)
	if resolved == "" {
		return nil, nil, fmt.Errorf("empty file path")
	}
	if !filepath.IsAbs(resolved) {
		abs, err := filepath.Abs(resolved)
		if err == nil {
			resolved = abs
		}
	}
	if _, err := os.Stat(resolved); err != nil {
		return nil, nil, fmt.Errorf("file not found: %s", resolved)
	}

	ext := strings.ToLower(filepath.Ext(resolved))
	if ext == ".csv" {
		return loadCSV(resolved)
	}
	if ext == ".xlsx" || ext == ".xlsm" || ext == ".xls" {
		return loadXLSX(resolved)
	}
	return nil, nil, fmt.Errorf("unsupported file type: %s", ext)
}

func loadCSV(path string) ([]string, []map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()
	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, nil, err
	}
	if len(rows) == 0 {
		return nil, nil, nil
	}
	headers := normalizeHeaders(rows[0])
	data := make([]map[string]string, 0, len(rows)-1)
	for _, row := range rows[1:] {
		record := map[string]string{}
		for idx, h := range headers {
			if idx < len(row) {
				record[h] = strings.TrimSpace(row[idx])
			}
		}
		data = append(data, record)
	}
	return headers, data, nil
}

func loadXLSX(path string) ([]string, []map[string]string, error) {
	xls, err := excelize.OpenFile(path)
	if err != nil {
		return nil, nil, err
	}
	defer xls.Close()
	sheet := xls.GetSheetName(0)
	if sheet == "" {
		return nil, nil, errors.New("no sheet")
	}
	rows, err := xls.GetRows(sheet)
	if err != nil {
		return nil, nil, err
	}
	if len(rows) == 0 {
		return nil, nil, nil
	}
	headers := normalizeHeaders(rows[0])
	data := make([]map[string]string, 0, len(rows)-1)
	for _, row := range rows[1:] {
		record := map[string]string{}
		for idx, h := range headers {
			if idx < len(row) {
				record[h] = strings.TrimSpace(row[idx])
			}
		}
		data = append(data, record)
	}
	return headers, data, nil
}

func normalizeHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, v := range headers {
		out[i] = strings.TrimSpace(v)
	}
	return out
}
