package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"

	"antifraud-workbench/backend/internal/model"
	"antifraud-workbench/backend/internal/util"
)

type ProfileService struct {
	db      *sql.DB
	mu      sync.RWMutex
	results map[string]model.ProfileResult
}

func NewProfileService(db *sql.DB) *ProfileService {
	return &ProfileService{
		db:      db,
		results: map[string]model.ProfileResult{},
	}
}

// --------------- main entry ---------------

func (s *ProfileService) Run(taskID string, req model.ProfileRequest) (model.ProfileResult, error) {
	req.MinPairCount = normalizeMinPairCount(req.MinPairCount)

	txns, err := s.queryTxn(req)
	if err != nil {
		return model.ProfileResult{}, err
	}

	// Step 1: build adjacency maps
	adj, nodeIn, nodeOut, degree := buildAdjMaps(txns)

	// collect all entity nodes
	allNodes := make([]string, 0, len(degree))
	for k := range degree {
		allNodes = append(allNodes, k)
	}
	sort.Strings(allNodes)

	// Step 2: identify gangs by shared IP/MAC; fallback to high-frequency transactions.
	components, companyEvidenceHits, err := s.buildEvidenceGangs(allNodes, txns, req.MinPairCount)
	if err != nil {
		return model.ProfileResult{}, err
	}

	// Step 3: for each gang, compute centrality & assign roles
	type gangAnalysis struct {
		id              int
		nodes           []string
		leader          string
		core            []string
		periphery       []string
		betweenness     map[string]float64
		depthMap        map[string]int
		totalAmt        float64
		edgeCnt         int
		evidenceSummary []string
	}

	gangAnalyses := make([]gangAnalysis, 0, len(components))
	nodeGang := map[string]int{}    // node -> gangID
	nodeRole := map[string]string{} // node -> role
	nodeBC := map[string]float64{}  // node -> betweenness
	nodeDepth := map[string]int{}   // node -> depth

	// Build directed edge aggregation for later graph construction
	type edgeKey struct{ src, tgt string }
	edgeAgg := map[edgeKey]*model.GraphLink{}
	edgeGoods := map[edgeKey]map[string]struct{}{}

	for _, t := range txns {
		from := util.NormalizeEntity(t.PayerName, t.PayerID)
		to := util.NormalizeEntity(t.PayeeName, t.PayeeID)
		if from == "UNKNOWN" || to == "UNKNOWN" {
			continue
		}
		k := edgeKey{from, to}
		if e, ok := edgeAgg[k]; ok {
			e.Value += t.Amount
			e.Count++
		} else {
			edgeAgg[k] = &model.GraphLink{
				Source: from, Target: to,
				Value: t.Amount, Count: 1,
			}
		}
		if t.GoodsName != "" {
			if edgeGoods[k] == nil {
				edgeGoods[k] = map[string]struct{}{}
			}
			edgeGoods[k][t.GoodsName] = struct{}{}
		}
	}

	for i, comp := range components {
		bc := computeBetweenness(comp.nodes, adj)
		leader, core, periph := classifyRoles(comp.nodes, bc, degree, nodeIn, nodeOut, companyEvidenceHits)
		depthMap := assignDepths(leader, adj, comp.nodes)

		// compute gang-level stats
		totalAmt := 0.0
		edgeCnt := 0
		inComp := map[string]bool{}
		for _, n := range comp.nodes {
			inComp[n] = true
		}
		for _, t := range txns {
			from := util.NormalizeEntity(t.PayerName, t.PayerID)
			to := util.NormalizeEntity(t.PayeeName, t.PayeeID)
			if from == "UNKNOWN" || to == "UNKNOWN" {
				continue
			}
			if inComp[from] || inComp[to] {
				totalAmt += t.Amount
				edgeCnt++
			}
		}

		gangAnalyses = append(gangAnalyses, gangAnalysis{
			id:              i,
			nodes:           comp.nodes,
			leader:          leader,
			core:            core,
			periphery:       periph,
			betweenness:     bc,
			depthMap:        depthMap,
			totalAmt:        totalAmt,
			edgeCnt:         edgeCnt,
			evidenceSummary: comp.evidenceSummary,
		})

		for _, n := range comp.nodes {
			nodeGang[n] = i + 1
			nodeDepth[n] = depthMap[n]
			nodeBC[n] = bc[n]
		}
		nodeRole[leader] = "leader"
		for _, m := range core {
			nodeRole[m] = "core"
		}
		for _, m := range periph {
			nodeRole[m] = "periphery"
		}
	}

	// Step 4: build GraphData
	graphNodes := make([]model.GraphNode, 0, len(allNodes))
	for _, id := range allNodes {
		gid := nodeGang[id]
		d := degree[id]
		if gid < 0 {
			gid = 0
		}
		graphNodes = append(graphNodes, model.GraphNode{
			ID:          id,
			Label:       id,
			Category:    "entity",
			TotalIn:     nodeIn[id],
			TotalOut:    nodeOut[id],
			Degree:      d,
			Depth:       nodeDepth[id],
			GangID:      gid,
			Betweenness: nodeBC[id],
			Role:        nodeRole[id],
		})
	}
	// sort: gangId asc, then by composite score desc
	sort.Slice(graphNodes, func(i, j int) bool {
		gi := graphNodes[i].GangID
		gj := graphNodes[j].GangID
		inGroupI := gi > 0
		inGroupJ := gj > 0
		// Prioritize identified gang members before ungrouped nodes,
		// otherwise pruneGraph may drop all gang nodes and yield zero links.
		if inGroupI != inGroupJ {
			return inGroupI
		}
		if gi != gj {
			if gi == 0 {
				return false
			}
			if gj == 0 {
				return true
			}
			return gi < gj
		}
		si := compositeScore(graphNodes[i])
		sj := compositeScore(graphNodes[j])
		return si > sj
	})

	graphLinks := make([]model.GraphLink, 0, len(edgeAgg))
	for k, e := range edgeAgg {
		if e.Count < req.MinPairCount {
			// Filter low-frequency links to keep graph readable and fast to render.
			continue
		}

		gidSrc := nodeGang[k.src]
		gidTgt := nodeGang[k.tgt]
		gid := 0
		switch {
		case gidSrc > 0 && gidTgt > 0 && gidSrc != gidTgt:
			gid = -1
		case gidSrc > 0:
			gid = gidSrc
		case gidTgt > 0:
			gid = gidTgt
		}

		srcDepth := nodeDepth[k.src]
		tgtDepth := nodeDepth[k.tgt]
		isBackflow := srcDepth >= 0 && tgtDepth >= 0 && tgtDepth < srcDepth

		// attach goods names
		goods := make([]string, 0)
		if g, ok := edgeGoods[k]; ok {
			for name := range g {
				goods = append(goods, name)
			}
			sort.Strings(goods)
		}

		link := *e
		link.GangID = gid
		link.IsBackflow = isBackflow
		link.GoodsNames = goods
		link.Label = fmt.Sprintf("%.2f", e.Value)
		graphLinks = append(graphLinks, link)
	}
	// sort links by value desc
	sort.Slice(graphLinks, func(i, j int) bool {
		return graphLinks[i].Value > graphLinks[j].Value
	})

	graph := model.GraphData{Nodes: graphNodes, Links: graphLinks}

	// Step 5: key nodes — top nodes by composite score across all gangs
	keyNodes := make([]model.GraphNode, len(graph.Nodes))
	copy(keyNodes, graph.Nodes)
	sort.Slice(keyNodes, func(i, j int) bool {
		si := compositeScore(keyNodes[i])
		sj := compositeScore(keyNodes[j])
		if si == sj {
			return keyNodes[i].Degree > keyNodes[j].Degree
		}
		return si > sj
	})
	if len(keyNodes) > 15 {
		keyNodes = keyNodes[:15]
	}

	// Step 6: role groups — backward compatible, from the largest gang
	var largestGang *gangAnalysis
	for i := range gangAnalyses {
		if largestGang == nil || len(gangAnalyses[i].nodes) > len(largestGang.nodes) {
			largestGang = &gangAnalyses[i]
		}
	}

	leader := []string{}
	core := []string{}
	periphery := []string{}
	if largestGang != nil {
		leader = []string{largestGang.leader}
		core = largestGang.core
		periphery = largestGang.periphery
	}

	// Step 7: build GangInfo list
	gangInfos := make([]model.GangInfo, 0, len(gangAnalyses))
	for _, ga := range gangAnalyses {
		gangInfos = append(gangInfos, model.GangInfo{
			GangID:          ga.id + 1,
			Label:           fmt.Sprintf("团伙%d", ga.id+1),
			Size:            len(ga.nodes),
			Leader:          ga.leader,
			CoreMembers:     ga.core,
			Periphery:       ga.periphery,
			TotalAmount:     ga.totalAmt,
			EdgeCount:       ga.edgeCnt,
			EvidenceSummary: ga.evidenceSummary,
		})
	}

	pairStats := topPairStats(graphLinks, 12)
	hourStats, err := s.queryHourStats()
	if err != nil {
		return model.ProfileResult{}, err
	}
	geoStats, err := s.queryGeoStats()
	if err != nil {
		return model.ProfileResult{}, err
	}

	brief := fmt.Sprintf("未基于共享IP/MAC或高频交易（%d笔及以上）识别出明确团伙，当前结果主要反映交易网络结构。", req.MinPairCount)
	if len(gangAnalyses) > 0 {
		brief = fmt.Sprintf(
			"基于共享IP/MAC和高频交易（%d笔及以上）识别出 %d 个独立团伙，涉及 %d 个交易主体，关键活跃节点 %d 个，联系最频繁链路 %d 条。",
			req.MinPairCount, len(gangAnalyses), len(allNodes), len(keyNodes), len(pairStats),
		)
	}

	roleGroups := []model.RoleGroup{}
	if largestGang != nil {
		roleGroups = []model.RoleGroup{
			{Role: "主犯/组织者", Members: leader},
			{Role: "骨干", Members: core},
			{Role: "外围", Members: periphery},
		}
	}

	result := model.ProfileResult{
		TaskID:            taskID,
		RoleGroups:        roleGroups,
		KeyNodes:          keyNodes,
		FrequentContacts:  pairStats,
		ActiveByHour:      hourStats,
		Geography:         geoStats,
		Graph:             pruneGraph(graph, 80, 160),
		OrganizationBrief: brief,
		Gangs:             gangInfos,
		GangCount:         len(gangAnalyses),
	}

	if _, err := s.db.Exec(
		`INSERT OR REPLACE INTO profile_result(task_id,params_json,result_json) VALUES(?,?,?)`,
		taskID, util.JSONString(req), util.JSONString(result),
	); err != nil {
		return model.ProfileResult{}, err
	}
	s.mu.Lock()
	s.results[taskID] = result
	s.mu.Unlock()
	return result, nil
}

// --------------- graph algorithms ---------------

type evidenceGang struct {
	nodes           []string
	evidenceSummary []string
}

func (s *ProfileService) buildEvidenceGangs(activeNodes []string, txns []txnEdge, minPairCount int) ([]evidenceGang, map[string]int, error) {
	if len(activeNodes) == 0 {
		return nil, map[string]int{}, nil
	}
	minPairCount = normalizeMinPairCount(minPairCount)

	activeSet := make(map[string]bool, len(activeNodes))
	idx := make(map[string]int, len(activeNodes))
	for i, node := range activeNodes {
		activeSet[node] = true
		idx[node] = i
	}

	uf := util.NewUnionFind(len(activeNodes))
	deviceOwners := map[string]map[string]struct{}{}
	deviceLabels := map[string]string{}

	addEvidence := func(company, kind, normalizedValue, labelValue string) {
		if kind != "device_ip" && kind != "device_mac" {
			return
		}
		company = strings.TrimSpace(company)
		if company == "" || !activeSet[company] {
			return
		}
		normalizedValue = strings.TrimSpace(normalizedValue)
		if normalizedValue == "" {
			return
		}
		key := kind + ":" + normalizedValue
		if deviceOwners[key] == nil {
			deviceOwners[key] = map[string]struct{}{}
		}
		deviceOwners[key][company] = struct{}{}
		deviceLabels[key] = sharedEvidenceLabel(kind, labelValue)
	}

	if err := s.collectInvoiceEvidence(addEvidence); err != nil {
		return nil, nil, err
	}

	companyEvidenceHits := map[string]int{}
	sharedDeviceKeys := make([]string, 0, len(deviceOwners))
	for key, owners := range deviceOwners {
		if len(owners) < 2 {
			continue
		}
		sharedDeviceKeys = append(sharedDeviceKeys, key)
		ownerList := sortedOwnerList(owners)
		first := idx[ownerList[0]]
		for _, company := range ownerList[1:] {
			uf.Union(first, idx[company])
		}
		for _, company := range ownerList {
			companyEvidenceHits[company]++
		}
	}

	type pairKey struct {
		a string
		b string
	}
	type freqPair struct {
		a     string
		b     string
		count int
	}
	pairCounts := map[pairKey]int{}
	for _, t := range txns {
		from := util.NormalizeEntity(t.PayerName, t.PayerID)
		to := util.NormalizeEntity(t.PayeeName, t.PayeeID)
		if from == "UNKNOWN" || to == "UNKNOWN" || from == to {
			continue
		}
		if !activeSet[from] || !activeSet[to] {
			continue
		}
		a, b := from, to
		if a > b {
			a, b = b, a
		}
		pairCounts[pairKey{a: a, b: b}]++
	}

	highFreqPairs := make([]freqPair, 0, len(pairCounts))
	for pair, cnt := range pairCounts {
		if cnt < minPairCount {
			continue
		}
		uf.Union(idx[pair.a], idx[pair.b])
		companyEvidenceHits[pair.a]++
		companyEvidenceHits[pair.b]++
		highFreqPairs = append(highFreqPairs, freqPair{a: pair.a, b: pair.b, count: cnt})
	}
	sort.Slice(highFreqPairs, func(i, j int) bool {
		if highFreqPairs[i].count != highFreqPairs[j].count {
			return highFreqPairs[i].count > highFreqPairs[j].count
		}
		if highFreqPairs[i].a != highFreqPairs[j].a {
			return highFreqPairs[i].a < highFreqPairs[j].a
		}
		return highFreqPairs[i].b < highFreqPairs[j].b
	})

	groupNodes := map[int][]string{}
	groupEvidence := map[int][]string{}
	for company := range companyEvidenceHits {
		root := uf.ComponentID(idx[company])
		groupNodes[root] = append(groupNodes[root], company)
	}
	for _, key := range sharedDeviceKeys {
		ownerList := sortedOwnerList(deviceOwners[key])
		root := uf.ComponentID(idx[ownerList[0]])
		groupEvidence[root] = append(groupEvidence[root], deviceLabels[key]+fmt.Sprintf("（%d家）", len(ownerList)))
	}
	for _, pair := range highFreqPairs {
		root := uf.ComponentID(idx[pair.a])
		groupEvidence[root] = append(groupEvidence[root], fmt.Sprintf("高频交易 %s↔%s（%d笔）", pair.a, pair.b, pair.count))
	}

	gangs := make([]evidenceGang, 0, len(groupNodes))
	for root, nodes := range groupNodes {
		if len(nodes) < 2 {
			continue
		}
		sort.Strings(nodes)
		summaries := dedupeStrings(groupEvidence[root])
		sort.Strings(summaries)
		if len(summaries) > 6 {
			summaries = summaries[:6]
		}
		gangs = append(gangs, evidenceGang{
			nodes:           nodes,
			evidenceSummary: summaries,
		})
	}

	sort.Slice(gangs, func(i, j int) bool {
		if len(gangs[i].nodes) == len(gangs[j].nodes) {
			return strings.Join(gangs[i].nodes, ",") < strings.Join(gangs[j].nodes, ",")
		}
		return len(gangs[i].nodes) > len(gangs[j].nodes)
	})
	return gangs, companyEvidenceHits, nil
}

// buildAdjMaps constructs undirected adjacency, directed in/out amounts, and degree counts.
func buildAdjMaps(txns []txnEdge) (
	adj map[string]map[string]struct{},
	nodeIn, nodeOut map[string]float64,
	degree map[string]int,
) {
	adj = map[string]map[string]struct{}{}
	nodeIn = map[string]float64{}
	nodeOut = map[string]float64{}
	degree = map[string]int{}

	for _, t := range txns {
		from := util.NormalizeEntity(t.PayerName, t.PayerID)
		to := util.NormalizeEntity(t.PayeeName, t.PayeeID)
		if from == "UNKNOWN" || to == "UNKNOWN" {
			continue
		}
		nodeOut[from] += t.Amount
		nodeIn[to] += t.Amount
		degree[from]++
		degree[to]++

		if adj[from] == nil {
			adj[from] = map[string]struct{}{}
		}
		adj[from][to] = struct{}{}
		if adj[to] == nil {
			adj[to] = map[string]struct{}{}
		}
		adj[to][from] = struct{}{}
	}
	return
}

// findComponents uses Union-Find to identify connected components.
// Returns components sorted by size descending, skipping single-node components.
func findComponents(adj map[string]map[string]struct{}, allNodes []string) [][]string {
	idx := make(map[string]int, len(allNodes))
	for i, n := range allNodes {
		idx[n] = i
	}
	uf := util.NewUnionFind(len(allNodes))

	for _, n := range allNodes {
		for nb := range adj[n] {
			if j, ok := idx[nb]; ok {
				uf.Union(idx[n], j)
			}
		}
	}

	// group by root
	groups := map[int][]string{}
	for _, n := range allNodes {
		root := uf.ComponentID(idx[n])
		groups[root] = append(groups[root], n)
	}

	result := make([][]string, 0, len(groups))
	for _, g := range groups {
		if len(g) >= 2 {
			result = append(result, g)
		}
	}
	sort.Slice(result, func(i, j int) bool { return len(result[i]) > len(result[j]) })
	return result
}

// computeBetweenness computes (approximate) betweenness centrality using Brandes' algorithm.
// For components with >200 nodes, uses pivot sampling (top-50 by degree).
func computeBetweenness(nodes []string, adj map[string]map[string]struct{}) map[string]float64 {
	bc := make(map[string]float64, len(nodes))
	for _, n := range nodes {
		bc[n] = 0
	}

	nodeSet := map[string]bool{}
	for _, n := range nodes {
		nodeSet[n] = true
	}

	// choose sources
	sources := nodes
	if len(nodes) > 200 {
		// sample top-50 by degree
		sorted := make([]string, len(nodes))
		copy(sorted, nodes)
		sort.Slice(sorted, func(i, j int) bool {
			return len(adj[sorted[i]]) > len(adj[sorted[j]])
		})
		if len(sorted) > 50 {
			sorted = sorted[:50]
		}
		sources = sorted
	}

	scale := float64(len(nodes)) / float64(len(sources))

	for _, s := range sources {
		// BFS from s
		queue := []string{s}
		visited := map[string]bool{s: true}
		dist := map[string]int{s: 0}
		sigma := map[string]int{s: 1}
		pred := map[string][]string{}
		order := []string{}

		for len(queue) > 0 {
			v := queue[0]
			queue = queue[1:]
			order = append(order, v)
			for w := range adj[v] {
				if !nodeSet[w] {
					continue
				}
				if !visited[w] {
					visited[w] = true
					dist[w] = dist[v] + 1
					queue = append(queue, w)
				}
				if dist[w] == dist[v]+1 {
					sigma[w] += sigma[v]
					pred[w] = append(pred[w], v)
				}
			}
		}

		// accumulation
		delta := map[string]float64{}
		for i := len(order) - 1; i >= 0; i-- {
			w := order[i]
			for _, v := range pred[w] {
				delta[v] += (float64(sigma[v]) / float64(max(sigma[w], 1))) * (1 + delta[w])
			}
			if w != s {
				bc[w] += delta[w]
			}
		}
	}

	// scale for sampling
	if len(sources) < len(nodes) {
		for k := range bc {
			bc[k] *= scale
		}
	}

	return bc
}

// classifyRoles assigns leader/core/periphery based on composite score.
func classifyRoles(
	nodes []string,
	bc map[string]float64,
	degree map[string]int,
	nodeIn, nodeOut map[string]float64,
	companyEvidenceHits map[string]int,
) (leader string, core, periphery []string) {
	type nodeScore struct {
		id    string
		score float64
	}

	// normalize
	maxDeg := 0
	for _, n := range nodes {
		if degree[n] > maxDeg {
			maxDeg = degree[n]
		}
	}
	maxBC := 0.0
	for _, n := range nodes {
		if bc[n] > maxBC {
			maxBC = bc[n]
		}
	}
	maxAmt := 0.0
	for _, n := range nodes {
		a := nodeIn[n] + nodeOut[n]
		if a > maxAmt {
			maxAmt = a
		}
	}
	maxEvidence := 0
	for _, n := range nodes {
		if companyEvidenceHits[n] > maxEvidence {
			maxEvidence = companyEvidenceHits[n]
		}
	}

	scores := make([]nodeScore, 0, len(nodes))
	for _, n := range nodes {
		nd := 0.0
		if maxDeg > 0 {
			nd = float64(degree[n]) / float64(maxDeg)
		}
		nb := 0.0
		if maxBC > 0 {
			nb = bc[n] / maxBC
		}
		na := 0.0
		if maxAmt > 0 {
			na = (nodeIn[n] + nodeOut[n]) / maxAmt
		}
		ne := 0.0
		if maxEvidence > 0 {
			ne = float64(companyEvidenceHits[n]) / float64(maxEvidence)
		}
		s := 0.3*nd + 0.25*nb + 0.2*na + 0.25*ne
		scores = append(scores, nodeScore{id: n, score: s})
	}

	sort.Slice(scores, func(i, j int) bool { return scores[i].score > scores[j].score })

	leader = scores[0].id
	leaderScore := scores[0].score
	threshold := leaderScore * 0.4

	core = []string{}
	periphery = []string{}
	for _, s := range scores[1:] {
		if s.score >= threshold && threshold > 0 {
			core = append(core, s.id)
		} else {
			periphery = append(periphery, s.id)
		}
	}
	return
}

// assignDepths runs BFS from the leader to assign depth within a gang.
func assignDepths(leader string, adj map[string]map[string]struct{}, gangNodes []string) map[string]int {
	gangSet := map[string]bool{}
	for _, n := range gangNodes {
		gangSet[n] = true
	}
	depthMap := map[string]int{}
	for _, n := range gangNodes {
		depthMap[n] = -1
	}

	queue := []string{leader}
	depthMap[leader] = 0

	for len(queue) > 0 {
		v := queue[0]
		queue = queue[1:]
		for w := range adj[v] {
			if gangSet[w] && depthMap[w] == -1 {
				depthMap[w] = depthMap[v] + 1
				queue = append(queue, w)
			}
		}
	}
	return depthMap
}

// compositeScore computes a display score for sorting nodes.
func compositeScore(n model.GraphNode) float64 {
	// normalize degree and betweenness on the fly isn't practical here;
	// use raw values with a weight that makes degree dominant for display order
	return float64(n.Degree)*1000 + n.Betweenness + (n.TotalIn+n.TotalOut)/10000
}

func normalizeMinPairCount(v int) int {
	if v <= 0 {
		return 50
	}
	return v
}

// --------------- existing helpers ---------------

func (s *ProfileService) collectInvoiceEvidence(add func(company, kind, normalizedValue, labelValue string)) error {
	rows, err := s.db.Query(`SELECT payload_json FROM raw_invoice`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return err
		}
		record := map[string]string{}
		if err := json.Unmarshal([]byte(raw), &record); err != nil {
			continue
		}

		company := util.NormalizeEntity(
			pickField(record, "销货方名称", "销方名称", "交易户名", "账户开户名称"),
			pickField(record, "销货方纳税人识别号", "销方识别号", "交易证件号", "交易账号", "交易卡号", "开户人证件号码"),
		)
		if company == "UNKNOWN" {
			continue
		}
		add(company, "device_ip", normalizeEvidenceValue("device_ip", pickField(record, "IP", "ip", "IP地址")), pickField(record, "IP", "ip", "IP地址"))
		add(company, "device_mac", normalizeEvidenceValue("device_mac", pickField(record, "MAC", "mac", "MAC地址")), pickField(record, "MAC", "mac", "MAC地址"))
		add(company, "device_board", normalizeEvidenceValue("device_board", pickField(record, "主板序列号")), pickField(record, "主板序列号"))
	}
	return nil
}

func (s *ProfileService) collectTaxpayerEvidence(add func(company, kind, normalizedValue, labelValue string)) error {
	rows, err := s.db.Query(`SELECT payload_json FROM raw_taxpayer`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return err
		}
		record := map[string]string{}
		if err := json.Unmarshal([]byte(raw), &record); err != nil {
			continue
		}

		company := util.NormalizeEntity(
			pickField(record, "纳税人名称", "name", "taxpayerName", "客户名称", "账户开户名称"),
			pickField(record, "纳税人识别号", "社会信用代码", "统一社会信用代码", "证照号码", "开户人证件号码"),
		)
		if company == "UNKNOWN" {
			continue
		}

		personKinds := []struct {
			kind     string
			nameKeys []string
			idKeys   []string
		}{
			{kind: "legal_person", nameKeys: []string{"法定代表人姓名", "法定代表人"}, idKeys: []string{"法定代表人身份证号码"}},
			{kind: "finance_person", nameKeys: []string{"财务负责人姓名", "财务负责人"}, idKeys: []string{"财务负责人身份证件号码", "财务负责人身份证号码"}},
			{kind: "tax_handler", nameKeys: []string{"办税人姓名", "办税人", "代办人姓名"}, idKeys: []string{"办税人身份证件号码", "办税人身份证号码", "代办人证件号码"}},
			{kind: "legal_person", nameKeys: []string{"法人代表"}, idKeys: nil},
		}
		for _, item := range personKinds {
			normalized, label := normalizePersonEvidence(
				pickField(record, item.nameKeys...),
				pickField(record, item.idKeys...),
			)
			add(company, item.kind, normalized, label)
		}

		phoneFields := []string{
			"法定代表人固定电话", "法定代表人移动电话",
			"财务负责人固定电话", "财务负责人移动电话",
			"办税人固定电话", "办税人移动电话",
			"单位电话",
		}
		for _, field := range phoneFields {
			rawPhone := pickField(record, field)
			add(company, "phone", normalizeEvidenceValue("phone", rawPhone), rawPhone)
		}
	}
	return nil
}

func pickField(record map[string]string, keys ...string) string {
	values := make([]string, 0, len(keys))
	for _, key := range keys {
		values = append(values, record[key])
	}
	return util.Pick(values...)
}

func normalizePersonEvidence(name, id string) (string, string) {
	name = strings.TrimSpace(name)
	id = strings.TrimSpace(id)
	if id != "" {
		if name != "" {
			return strings.ToUpper(id), name
		}
		return strings.ToUpper(id), id
	}
	if name != "" {
		return name, name
	}
	return "", ""
}

func normalizeEvidenceValue(kind, raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	switch kind {
	case "device_ip":
		if raw == "0.0.0.0" {
			return ""
		}
		return raw
	case "device_mac":
		replacer := strings.NewReplacer("-", "", ":", "", ".", "", " ", "")
		raw = strings.ToUpper(replacer.Replace(raw))
		if len(raw) < 6 {
			return ""
		}
		return raw
	case "device_board":
		return strings.ToUpper(raw)
	case "phone":
		replacer := strings.NewReplacer("-", "", " ", "", "(", "", ")", "", "+86", "")
		raw = replacer.Replace(raw)
		if len(raw) < 7 {
			return ""
		}
		return raw
	default:
		return raw
	}
}

func sharedEvidenceLabel(kind, labelValue string) string {
	labelValue = strings.TrimSpace(labelValue)
	switch kind {
	case "device_ip":
		return "共享开票IP " + labelValue
	case "device_mac":
		return "共享开票MAC " + labelValue
	case "device_board":
		return "共享主板序列号 " + labelValue
	case "legal_person":
		return "共享法人 " + labelValue
	case "finance_person":
		return "共享财务负责人 " + labelValue
	case "tax_handler":
		return "共享办税人 " + labelValue
	case "phone":
		return "共享联系电话 " + labelValue
	default:
		return "共享证据 " + labelValue
	}
}

func sortedOwnerList(owners map[string]struct{}) []string {
	list := make([]string, 0, len(owners))
	for owner := range owners {
		list = append(list, owner)
	}
	sort.Strings(list)
	return list
}

func (s *ProfileService) Get(taskID string) (model.ProfileResult, bool) {
	s.mu.RLock()
	if v, ok := s.results[taskID]; ok {
		s.mu.RUnlock()
		return v, true
	}
	s.mu.RUnlock()

	var raw string
	err := s.db.QueryRow(`SELECT result_json FROM profile_result WHERE task_id=?`, taskID).Scan(&raw)
	if err != nil {
		return model.ProfileResult{}, false
	}
	var res model.ProfileResult
	if json.Unmarshal([]byte(raw), &res) != nil {
		return model.ProfileResult{}, false
	}
	s.mu.Lock()
	s.results[taskID] = res
	s.mu.Unlock()
	return res, true
}

func (s *ProfileService) LatestTaskID() string {
	var taskID string
	_ = s.db.QueryRow(`SELECT task_id FROM profile_result ORDER BY created_at DESC LIMIT 1`).Scan(&taskID)
	return taskID
}

func (s *ProfileService) queryTxn(req model.ProfileRequest) ([]txnEdge, error) {
	where := `WHERE amount_with_tax >= ?`
	args := []any{req.MinEdgeAmount}

	entryValue := strings.TrimSpace(req.EntryValue)
	entryType := strings.ToLower(strings.TrimSpace(req.EntryType))
	if entryType == "" {
		entryType = "entity"
	}
	if entryValue != "" {
		if entryType == "invoice" {
			like := "%" + entryValue + "%"
			where += ` AND (bill_no LIKE ? OR bill_code LIKE ?)`
			args = append(args, like, like)
		} else {
			like := "%" + entryValue + "%"
			where += ` AND (
				payer_name = ? OR payee_name = ? OR payer_id = ? OR payee_id = ?
				OR payer_name LIKE ? OR payee_name LIKE ? OR payer_id LIKE ? OR payee_id LIKE ?
			)`
			args = append(args, entryValue, entryValue, entryValue, entryValue, like, like, like, like)
		}
	}

	queryWithGoods := fmt.Sprintf(`
		SELECT txn_id,payer_name,payer_id,payee_name,payee_id,amount_with_tax,invoice_time,bill_no,COALESCE(goods_name,'')
		FROM clean_txn
		%s`, where)
	rows, err := s.db.Query(queryWithGoods, args...)
	scanWithGoods := true
	if err != nil {
		// Compatible with legacy DBs that do not yet have goods_name.
		if strings.Contains(strings.ToLower(err.Error()), "no such column: goods_name") {
			queryWithoutGoods := fmt.Sprintf(`
				SELECT txn_id,payer_name,payer_id,payee_name,payee_id,amount_with_tax,invoice_time,bill_no
				FROM clean_txn
				%s`, where)
			rows, err = s.db.Query(queryWithoutGoods, args...)
			if err != nil {
				return nil, err
			}
			scanWithGoods = false
		} else {
			return nil, err
		}
	}
	defer rows.Close()

	txns := make([]txnEdge, 0, 512)
	for rows.Next() {
		var item txnEdge
		var ts sql.NullTime
		if scanWithGoods {
			if err := rows.Scan(&item.TxnID, &item.PayerName, &item.PayerID, &item.PayeeName, &item.PayeeID, &item.Amount, &ts, &item.BillNo, &item.GoodsName); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&item.TxnID, &item.PayerName, &item.PayerID, &item.PayeeName, &item.PayeeID, &item.Amount, &ts, &item.BillNo); err != nil {
				return nil, err
			}
		}
		if ts.Valid {
			item.InvoiceTime = ts.Time
		}
		txns = append(txns, item)
	}
	return txns, nil
}

func (s *ProfileService) queryHourStats() ([]model.HourStat, error) {
	rows, err := s.db.Query(`
		SELECT CAST(strftime('%H', invoice_time) AS INTEGER) AS hh, COUNT(1)
		FROM clean_txn
		WHERE strftime('%H', invoice_time) IS NOT NULL
		GROUP BY hh
		ORDER BY hh`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.HourStat{}
	for rows.Next() {
		var h, c int
		if err := rows.Scan(&h, &c); err != nil {
			return nil, err
		}
		out = append(out, model.HourStat{Hour: h, Count: c})
	}
	return out, nil
}

func (s *ProfileService) queryGeoStats() ([]model.PairStat, error) {
	rows, err := s.db.Query(`SELECT name FROM entity WHERE name <> '' LIMIT 5000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	bucket := map[string]int{}
	for rows.Next() {
		var name string
		_ = rows.Scan(&name)
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		region := "未知"
		runes := []rune(name)
		if len(runes) >= 2 {
			region = string(runes[:2])
		}
		bucket[region]++
	}
	out := make([]model.PairStat, 0, len(bucket))
	for region, count := range bucket {
		out = append(out, model.PairStat{
			Source: region,
			Target: "主体数",
			Count:  count,
			Amount: float64(count),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	if len(out) > 10 {
		out = out[:10]
	}
	return out, nil
}

func topPairStats(links []model.GraphLink, n int) []model.PairStat {
	out := make([]model.PairStat, 0, len(links))
	for _, l := range links {
		out = append(out, model.PairStat{
			Source: l.Source,
			Target: l.Target,
			Count:  l.Count,
			Amount: l.Value,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].Amount > out[j].Amount
		}
		return out[i].Count > out[j].Count
	})
	if len(out) > n {
		return out[:n]
	}
	return out
}

func pruneGraph(graph model.GraphData, maxNodes, maxLinks int) model.GraphData {
	if len(graph.Links) == 0 {
		return model.GraphData{
			Nodes: []model.GraphNode{},
			Links: []model.GraphLink{},
		}
	}

	allowed := map[string]bool{}
	nodes := graph.Nodes
	if len(nodes) > maxNodes {
		nodes = nodes[:maxNodes]
	}
	for _, n := range nodes {
		allowed[n.ID] = true
	}
	links := make([]model.GraphLink, 0, maxLinks)
	for _, l := range graph.Links {
		if allowed[l.Source] && allowed[l.Target] {
			links = append(links, l)
			if len(links) >= maxLinks {
				break
			}
		}
	}

	if len(links) == 0 {
		return model.GraphData{
			Nodes: []model.GraphNode{},
			Links: []model.GraphLink{},
		}
	}

	connected := map[string]bool{}
	for _, l := range links {
		connected[l.Source] = true
		connected[l.Target] = true
	}
	finalNodes := make([]model.GraphNode, 0, len(nodes))
	for _, n := range nodes {
		if connected[n.ID] {
			finalNodes = append(finalNodes, n)
		}
	}
	return model.GraphData{Nodes: finalNodes, Links: links}
}
