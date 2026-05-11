package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"antifraud-workbench/backend/internal/model"
	"antifraud-workbench/backend/internal/util"
)

type PenetrationService struct {
	db      *sql.DB
	mu      sync.RWMutex
	results map[string]model.PenetrationResult
}

type txnEdge struct {
	TxnID       string
	PayerName   string
	PayerID     string
	PayeeName   string
	PayeeID     string
	Amount      float64
	InvoiceTime time.Time
	BillNo      string
	GoodsName   string
}

const (
	penetrationDirectionOutbound = "outbound"
	penetrationDirectionInbound  = "inbound"
	penetrationDirectionBoth     = "both"
)

type graphBuildOptions struct {
	BranchLimit int
	NodeLimit   int
	EdgeLimit   int
}

func NewPenetrationService(db *sql.DB) *PenetrationService {
	return &PenetrationService{
		db:      db,
		results: map[string]model.PenetrationResult{},
	}
}

func (s *PenetrationService) Run(taskID string, req model.PenetrationRequest) (model.PenetrationResult, error) {
	if req.MaxHops < 1 {
		req.MaxHops = 3
	}
	if req.MaxHops > 6 {
		req.MaxHops = 6
	}
	req.Direction = normalizePenetrationDirection(req.Direction)
	buildOptions := normalizeGraphBuildOptions(req)

	txns, err := s.queryTxnEdges(req)
	if err != nil {
		return model.PenetrationResult{}, err
	}
	seeds, err := s.resolveSeeds(req)
	if err != nil {
		return model.PenetrationResult{}, err
	}
	graph, truncated, trimNote := BuildPenetrationGraphWithOptions(txns, seeds, req.MaxHops, req.Direction, buildOptions)
	result := model.PenetrationResult{
		TaskID:    taskID,
		Entry:     req.EntryValue,
		MaxHops:   req.MaxHops,
		Direction: req.Direction,
		Truncated: truncated,
		TrimNote:  trimNote,
		Graph:     graph,
		NodeSize:  len(graph.Nodes),
		EdgeSize:  len(graph.Links),
		Summary:   fmt.Sprintf("从线索 %s 以%s穿透 %d 层，共命中 %d 个主体、%d 条资金边", req.EntryValue, penetrationDirectionCN(req.Direction), req.MaxHops, len(graph.Nodes), len(graph.Links)),
	}
	if truncated && trimNote != "" {
		result.Summary += "（" + trimNote + "）"
	}

	rawResult := util.JSONString(result)
	if _, err := s.db.Exec(
		`INSERT OR REPLACE INTO penetration_result(task_id,params_json,result_json) VALUES(?,?,?)`,
		taskID, util.JSONString(req), rawResult,
	); err != nil {
		return model.PenetrationResult{}, err
	}

	s.mu.Lock()
	s.results[taskID] = result
	s.mu.Unlock()
	return result, nil
}

func (s *PenetrationService) Get(taskID string) (model.PenetrationResult, bool) {
	s.mu.RLock()
	if v, ok := s.results[taskID]; ok {
		s.mu.RUnlock()
		return v, true
	}
	s.mu.RUnlock()

	var raw string
	err := s.db.QueryRow(`SELECT result_json FROM penetration_result WHERE task_id=?`, taskID).Scan(&raw)
	if err != nil {
		return model.PenetrationResult{}, false
	}
	var res model.PenetrationResult
	if json.Unmarshal([]byte(raw), &res) != nil {
		return model.PenetrationResult{}, false
	}
	s.mu.Lock()
	s.results[taskID] = res
	s.mu.Unlock()
	return res, true
}

func (s *PenetrationService) LatestTaskID() string {
	var taskID string
	_ = s.db.QueryRow(`SELECT task_id FROM penetration_result ORDER BY created_at DESC LIMIT 1`).Scan(&taskID)
	return taskID
}

func (s *PenetrationService) ListEntryOptions(entryType, q string, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 60
	}
	q = strings.TrimSpace(q)

	if entryType == "invoice" {
		like := "%" + q + "%"
		rows, err := s.db.Query(`
			SELECT DISTINCT v FROM (
				SELECT bill_no AS v FROM clean_txn WHERE bill_no <> ''
				UNION ALL
				SELECT bill_code AS v FROM clean_txn WHERE bill_code <> ''
			)
			WHERE v LIKE ?
			LIMIT ?`, like, limit)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var v string
			if rows.Scan(&v) == nil && strings.TrimSpace(v) != "" {
				out = append(out, v)
			}
		}
		return dedupeStrings(out), nil
	}

	rows, err := s.db.Query(`SELECT payload_json FROM raw_taxpayer ORDER BY id DESC LIMIT ?`, limit*20)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	set := map[string]bool{}
	qLower := strings.ToLower(q)
	for rows.Next() {
		var raw string
		if rows.Scan(&raw) != nil {
			continue
		}

		var payload struct {
			TaxpayerName string `json:"纳税人名称"`
			Name         string `json:"name"`
			Alias        string `json:"taxpayerName"`
			CustomerName string `json:"客户名称"`
			AccountName  string `json:"账户开户名称"`
		}
		if json.Unmarshal([]byte(raw), &payload) != nil {
			continue
		}

		name := strings.TrimSpace(util.Pick(payload.TaxpayerName, payload.Alias, payload.Name, payload.CustomerName, payload.AccountName))
		if name == "" {
			continue
		}
		if qLower != "" && !strings.Contains(strings.ToLower(name), qLower) {
			continue
		}
		set[name] = true
		if len(set) >= limit {
			break
		}
	}

	if len(set) == 0 {
		rows2, err := s.db.Query(`
			SELECT name
			FROM entity
			WHERE name <> '' AND name LIKE ?
			GROUP BY name
			ORDER BY name
			LIMIT ?`, "%"+q+"%", limit*2)
		if err != nil {
			return nil, err
		}
		defer rows2.Close()

		for rows2.Next() {
			var name string
			if rows2.Scan(&name) != nil {
				continue
			}
			set[strings.TrimSpace(name)] = true
		}
	}

	out := make([]string, 0, len(set))
	for v := range set {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return len(out[i]) < len(out[j]) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *PenetrationService) resolveSeeds(req model.PenetrationRequest) ([]string, error) {
	entry := strings.TrimSpace(req.EntryValue)
	if entry == "" {
		return nil, fmt.Errorf("entryValue is required")
	}
	seedSet := map[string]bool{}

	if req.EntryType == "invoice" {
		rows, err := s.db.Query(`SELECT payer_name,payer_id,payee_name,payee_id FROM clean_txn WHERE bill_no LIKE ? OR bill_code LIKE ? LIMIT 100`, "%"+entry+"%", "%"+entry+"%")
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var payerName, payerID, payeeName, payeeID string
			_ = rows.Scan(&payerName, &payerID, &payeeName, &payeeID)
			seedSet[util.NormalizeEntity(payerName, payerID)] = true
			seedSet[util.NormalizeEntity(payeeName, payeeID)] = true
		}
	} else {
		rows, err := s.db.Query(`
			SELECT payer_name,payer_id,payee_name,payee_id
			FROM clean_txn
			WHERE payer_name = ? OR payee_name = ? OR payer_id = ? OR payee_id = ?
			LIMIT 300`,
			entry, entry, entry, entry,
		)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var payerName, payerID, payeeName, payeeID string
			_ = rows.Scan(&payerName, &payerID, &payeeName, &payeeID)
			if strings.Contains(payerName, entry) || strings.Contains(payerID, entry) {
				seedSet[util.NormalizeEntity(payerName, payerID)] = true
			}
			if strings.Contains(payeeName, entry) || strings.Contains(payeeID, entry) {
				seedSet[util.NormalizeEntity(payeeName, payeeID)] = true
			}
		}

		if len(seedSet) == 0 {
			rows2, err := s.db.Query(`
				SELECT payer_name,payer_id,payee_name,payee_id
				FROM clean_txn
				WHERE payer_name LIKE ? OR payee_name LIKE ? OR payer_id LIKE ? OR payee_id LIKE ?
				LIMIT 300`,
				"%"+entry+"%", "%"+entry+"%", "%"+entry+"%", "%"+entry+"%",
			)
			if err != nil {
				return nil, err
			}
			defer rows2.Close()

			for rows2.Next() {
				var payerName, payerID, payeeName, payeeID string
				_ = rows2.Scan(&payerName, &payerID, &payeeName, &payeeID)
				if strings.Contains(payerName, entry) || strings.Contains(payerID, entry) {
					seedSet[util.NormalizeEntity(payerName, payerID)] = true
				}
				if strings.Contains(payeeName, entry) || strings.Contains(payeeID, entry) {
					seedSet[util.NormalizeEntity(payeeName, payeeID)] = true
				}
			}
		}
	}

	seeds := make([]string, 0, len(seedSet))
	for k := range seedSet {
		if k != "UNKNOWN" {
			seeds = append(seeds, k)
		}
	}
	if len(seeds) == 0 {
		seeds = append(seeds, entry)
	}
	return seeds, nil
}

func (s *PenetrationService) queryTxnEdges(req model.PenetrationRequest) ([]txnEdge, error) {
	start, _ := time.ParseInLocation("2006-01-02", req.StartDate, time.Local)
	end, _ := time.ParseInLocation("2006-01-02", req.EndDate, time.Local)

	rows, err := s.db.Query(`
		SELECT txn_id,payer_name,payer_id,payee_name,payee_id,amount_with_tax,invoice_time,bill_no,COALESCE(goods_name,'')
		FROM clean_txn
		WHERE amount_with_tax >= ?`,
		req.MinAmount,
	)
	scanWithGoods := true
	if err != nil {
		// Compatible with legacy DBs that do not yet have goods_name.
		if strings.Contains(strings.ToLower(err.Error()), "no such column: goods_name") {
			rows, err = s.db.Query(`
				SELECT txn_id,payer_name,payer_id,payee_name,payee_id,amount_with_tax,invoice_time,bill_no
				FROM clean_txn
				WHERE amount_with_tax >= ?`,
				req.MinAmount,
			)
			if err != nil {
				return nil, err
			}
			scanWithGoods = false
		} else {
			return nil, err
		}
	}
	defer rows.Close()

	out := make([]txnEdge, 0, 256)
	for rows.Next() {
		var item txnEdge
		var invoiceTime sql.NullTime
		if scanWithGoods {
			if err := rows.Scan(&item.TxnID, &item.PayerName, &item.PayerID, &item.PayeeName, &item.PayeeID, &item.Amount, &invoiceTime, &item.BillNo, &item.GoodsName); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&item.TxnID, &item.PayerName, &item.PayerID, &item.PayeeName, &item.PayeeID, &item.Amount, &invoiceTime, &item.BillNo); err != nil {
				return nil, err
			}
		}
		if invoiceTime.Valid {
			item.InvoiceTime = invoiceTime.Time
			if !start.IsZero() && item.InvoiceTime.Before(start) {
				continue
			}
			if !end.IsZero() && item.InvoiceTime.After(end.Add(24*time.Hour)) {
				continue
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func normalizePenetrationDirection(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "outbound", "downstream", "out":
		return penetrationDirectionOutbound
	case "inbound", "upstream", "in":
		return penetrationDirectionInbound
	case "both", "all", "bidirectional":
		return penetrationDirectionBoth
	default:
		return penetrationDirectionOutbound
	}
}

func penetrationDirectionCN(direction string) string {
	switch normalizePenetrationDirection(direction) {
	case penetrationDirectionInbound:
		return "上游方向"
	case penetrationDirectionBoth:
		return "双向"
	default:
		return "下游方向"
	}
}

func normalizeGraphBuildOptions(req model.PenetrationRequest) graphBuildOptions {
	direction := normalizePenetrationDirection(req.Direction)

	branchLimit := req.BranchLimit
	if branchLimit <= 0 {
		if direction == penetrationDirectionBoth {
			branchLimit = 8
		} else {
			branchLimit = 16
		}
	}
	branchLimit = clampInt(branchLimit, 2, 80)

	nodeLimit := req.NodeLimit
	if nodeLimit <= 0 {
		if direction == penetrationDirectionBoth {
			nodeLimit = 1200
		} else {
			nodeLimit = 1800
		}
	}
	nodeLimit = clampInt(nodeLimit, 200, 20000)

	edgeLimit := req.EdgeLimit
	if edgeLimit <= 0 {
		edgeLimit = nodeLimit * 2
	}
	edgeLimit = clampInt(edgeLimit, 300, 50000)

	return graphBuildOptions{
		BranchLimit: branchLimit,
		NodeLimit:   nodeLimit,
		EdgeLimit:   edgeLimit,
	}
}

func clampInt(v, minV, maxV int) int {
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}

func BuildPenetrationGraph(txns []txnEdge, seeds []string, maxHops int, direction string) model.GraphData {
	graph, _, _ := BuildPenetrationGraphWithOptions(txns, seeds, maxHops, direction, graphBuildOptions{})
	return graph
}

type goodsStat struct {
	Count  int
	Amount float64
}

type aggTxnEdge struct {
	Source string
	Target string
	Amount float64
	Count  int
	Goods  map[string]*goodsStat
}

func BuildPenetrationGraphWithOptions(txns []txnEdge, seeds []string, maxHops int, direction string, options graphBuildOptions) (model.GraphData, bool, string) {
	if maxHops < 1 {
		maxHops = 3
	}
	direction = normalizePenetrationDirection(direction)

	outAdj := map[string][]*aggTxnEdge{}
	inAdj := map[string][]*aggTxnEdge{}
	pairMap := map[string]*aggTxnEdge{}
	nodeIn := map[string]float64{}
	nodeOut := map[string]float64{}
	outNeighborSet := map[string]map[string]bool{}
	inNeighborSet := map[string]map[string]bool{}

	for _, txn := range txns {
		from := util.NormalizeEntity(txn.PayerName, txn.PayerID)
		to := util.NormalizeEntity(txn.PayeeName, txn.PayeeID)
		if from == "UNKNOWN" || to == "UNKNOWN" {
			continue
		}
		nodeOut[from] += txn.Amount
		nodeIn[to] += txn.Amount

		if outNeighborSet[from] == nil {
			outNeighborSet[from] = map[string]bool{}
		}
		outNeighborSet[from][to] = true
		if inNeighborSet[to] == nil {
			inNeighborSet[to] = map[string]bool{}
		}
		inNeighborSet[to][from] = true

		key := from + "->" + to
		agg := pairMap[key]
		if agg == nil {
			agg = &aggTxnEdge{
				Source: from,
				Target: to,
				Goods:  map[string]*goodsStat{},
			}
			pairMap[key] = agg
		}
		agg.Amount += txn.Amount
		agg.Count++

		goods := strings.TrimSpace(txn.GoodsName)
		if goods != "" {
			stat := agg.Goods[goods]
			if stat == nil {
				stat = &goodsStat{}
				agg.Goods[goods] = stat
			}
			stat.Count++
			stat.Amount += txn.Amount
		}
	}

	allAggLinks := make([]*aggTxnEdge, 0, len(pairMap))
	for _, agg := range pairMap {
		allAggLinks = append(allAggLinks, agg)
		outAdj[agg.Source] = append(outAdj[agg.Source], agg)
		inAdj[agg.Target] = append(inAdj[agg.Target], agg)
	}
	sort.Slice(allAggLinks, func(i, j int) bool {
		if allAggLinks[i].Amount != allAggLinks[j].Amount {
			return allAggLinks[i].Amount > allAggLinks[j].Amount
		}
		if allAggLinks[i].Count != allAggLinks[j].Count {
			return allAggLinks[i].Count > allAggLinks[j].Count
		}
		if allAggLinks[i].Source != allAggLinks[j].Source {
			return allAggLinks[i].Source < allAggLinks[j].Source
		}
		return allAggLinks[i].Target < allAggLinks[j].Target
	})
	sortAdj := func(adj map[string][]*aggTxnEdge) {
		for k := range adj {
			sort.Slice(adj[k], func(i, j int) bool {
				if adj[k][i].Amount != adj[k][j].Amount {
					return adj[k][i].Amount > adj[k][j].Amount
				}
				if adj[k][i].Count != adj[k][j].Count {
					return adj[k][i].Count > adj[k][j].Count
				}
				if adj[k][i].Source != adj[k][j].Source {
					return adj[k][i].Source < adj[k][j].Source
				}
				return adj[k][i].Target < adj[k][j].Target
			})
		}
	}
	sortAdj(outAdj)
	sortAdj(inAdj)

	type qItem struct {
		Node  string
		Depth int
	}
	queue := make([]qItem, 0, len(seeds))
	visitedDepth := map[string]int{}
	selectedNodes := map[string]bool{}
	selectedEdges := map[string]*aggTxnEdge{}
	branchTruncated := false
	nodeCapTruncated := false
	edgeCapTruncated := false

	addEdge := func(edge *aggTxnEdge) bool {
		if edge == nil {
			return false
		}
		key := edge.Source + "->" + edge.Target
		if _, ok := selectedEdges[key]; ok {
			return true
		}
		if options.EdgeLimit > 0 && len(selectedEdges) >= options.EdgeLimit {
			edgeCapTruncated = true
			return false
		}

		newNodeDelta := 0
		if !selectedNodes[edge.Source] {
			newNodeDelta++
		}
		if !selectedNodes[edge.Target] {
			newNodeDelta++
		}
		if options.NodeLimit > 0 && len(selectedNodes)+newNodeDelta > options.NodeLimit {
			nodeCapTruncated = true
			return false
		}

		selectedEdges[key] = edge
		selectedNodes[edge.Source] = true
		selectedNodes[edge.Target] = true
		return true
	}

	if len(seeds) == 0 {
		limit := len(allAggLinks)
		if options.EdgeLimit > 0 && limit > options.EdgeLimit {
			limit = options.EdgeLimit
			edgeCapTruncated = true
		}
		for i := 0; i < limit; i++ {
			_ = addEdge(allAggLinks[i])
		}
	}

	seedSeen := map[string]bool{}
	for _, seed := range seeds {
		seed = strings.TrimSpace(seed)
		if seed == "" || seed == "UNKNOWN" || seedSeen[seed] {
			continue
		}
		seedSeen[seed] = true
		if options.NodeLimit > 0 && len(selectedNodes) >= options.NodeLimit {
			nodeCapTruncated = true
			break
		}
		queue = append(queue, qItem{Node: seed, Depth: 0})
		visitedDepth[seed] = 0
		selectedNodes[seed] = true
	}

	for len(queue) > 0 {
		item := queue[0]
		queue = queue[1:]
		if item.Depth >= maxHops {
			continue
		}
		processAdj := func(edges []*aggTxnEdge, nextGetter func(*aggTxnEdge) string) {
			if len(edges) == 0 {
				return
			}
			limit := len(edges)
			if options.BranchLimit > 0 && limit > options.BranchLimit {
				limit = options.BranchLimit
				branchTruncated = true
			}
			for i := 0; i < limit; i++ {
				edge := edges[i]
				if !addEdge(edge) {
					continue
				}
				next := nextGetter(edge)
				if next == "" || next == "UNKNOWN" {
					continue
				}
				if d, ok := visitedDepth[next]; ok && d <= item.Depth+1 {
					continue
				}
				if options.NodeLimit > 0 {
					if _, ok := visitedDepth[next]; !ok && len(visitedDepth) >= options.NodeLimit {
						nodeCapTruncated = true
						continue
					}
				}
				visitedDepth[next] = item.Depth + 1
				queue = append(queue, qItem{Node: next, Depth: item.Depth + 1})
				selectedNodes[next] = true
			}
		}

		if direction == penetrationDirectionOutbound || direction == penetrationDirectionBoth {
			processAdj(outAdj[item.Node], func(edge *aggTxnEdge) string { return edge.Target })
		}

		if direction == penetrationDirectionInbound || direction == penetrationDirectionBoth {
			processAdj(inAdj[item.Node], func(edge *aggTxnEdge) string { return edge.Source })
		}
	}

	nodes := make([]model.GraphNode, 0, len(selectedNodes))
	for node := range selectedNodes {
		depth := -1
		if d, ok := visitedDepth[node]; ok {
			depth = d
		}
		nodes = append(nodes, model.GraphNode{
			ID:       node,
			Label:    node,
			Category: "entity",
			TotalIn:  nodeIn[node],
			TotalOut: nodeOut[node],
			Degree:   len(outNeighborSet[node]) + len(inNeighborSet[node]),
			Depth:    depth,
		})
	}
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].Depth != nodes[j].Depth {
			return nodes[i].Depth < nodes[j].Depth
		}
		if nodes[i].Degree == nodes[j].Degree {
			return nodes[i].Label < nodes[j].Label
		}
		return nodes[i].Degree > nodes[j].Degree
	})

	links := make([]model.GraphLink, 0, len(selectedEdges))
	for _, rawEdge := range selectedEdges {
		edge := model.GraphLink{
			Source: rawEdge.Source,
			Target: rawEdge.Target,
			Value:  rawEdge.Amount,
			Count:  rawEdge.Count,
		}
		type gItem struct {
			Name   string
			Count  int
			Amount float64
		}
		items := make([]gItem, 0, len(rawEdge.Goods))
		for gName, stat := range rawEdge.Goods {
			items = append(items, gItem{Name: gName, Count: stat.Count, Amount: stat.Amount})
		}
		sort.Slice(items, func(i, j int) bool {
			if items[i].Amount != items[j].Amount {
				return items[i].Amount > items[j].Amount
			}
			if items[i].Count != items[j].Count {
				return items[i].Count > items[j].Count
			}
			return items[i].Name < items[j].Name
		})
		names := make([]string, 0, len(items))
		for _, it := range items {
			names = append(names, it.Name)
		}
		edge.GoodsNames = names

		// Build label with amount, count, and goods
		amountStr := fmt.Sprintf("%.2f", edge.Value)
		labelParts := []string{fmt.Sprintf("金额 %s / 笔数 %d", amountStr, edge.Count)}
		if len(edge.GoodsNames) > 0 {
			goodsSummary := strings.Join(edge.GoodsNames, "、")
			if len(goodsSummary) > 40 {
				goodsSummary = goodsSummary[:40] + "…"
			}
			labelParts = append(labelParts, "购买内容: "+goodsSummary)
		}
		edge.Label = strings.Join(labelParts, " | ")

		srcDepth, srcOk := visitedDepth[edge.Source]
		tgtDepth, tgtOk := visitedDepth[edge.Target]
		edge.IsBackflow = isBackflowEdge(direction, srcDepth, tgtDepth, srcOk, tgtOk)
		links = append(links, edge)
	}
	sort.Slice(links, func(i, j int) bool {
		return links[i].Value > links[j].Value
	})

	trimmed := branchTruncated || nodeCapTruncated || edgeCapTruncated
	trimNote := ""
	if trimmed {
		reasons := []string{}
		if branchTruncated {
			reasons = append(reasons, fmt.Sprintf("每节点最多扩展 %d 条关系", options.BranchLimit))
		}
		if nodeCapTruncated && options.NodeLimit > 0 {
			reasons = append(reasons, fmt.Sprintf("节点上限 %d", options.NodeLimit))
		}
		if edgeCapTruncated && options.EdgeLimit > 0 {
			reasons = append(reasons, fmt.Sprintf("边上限 %d", options.EdgeLimit))
		}
		if len(reasons) > 0 {
			trimNote = "已按关键视图裁剪: " + strings.Join(reasons, "，")
		}
	}
	return model.GraphData{Nodes: nodes, Links: links}, trimmed, trimNote
}

func isBackflowEdge(direction string, srcDepth, tgtDepth int, srcOk, tgtOk bool) bool {
	if !srcOk || !tgtOk {
		return false
	}
	direction = normalizePenetrationDirection(direction)
	switch direction {
	case penetrationDirectionInbound:
		return srcDepth <= tgtDepth
	case penetrationDirectionBoth:
		if srcDepth == tgtDepth {
			return true
		}
		return math.Abs(float64(srcDepth-tgtDepth)) > 1
	default:
		return tgtDepth <= srcDepth
	}
}

func dedupeStrings(values []string) []string {
	set := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" || set[v] {
			continue
		}
		set[v] = true
		out = append(out, v)
	}
	return out
}
