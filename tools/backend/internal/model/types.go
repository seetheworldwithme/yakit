package model

type CleanRequest struct {
	Paths []string `json:"paths"`
}

type FilePreview struct {
	Path        string         `json:"path"`
	Kind        string         `json:"kind"`
	Rows        int            `json:"rows"`
	FieldSample []string       `json:"fieldSample"`
	Issues      map[string]int `json:"issues"`
}

type CleanPreviewResponse struct {
	Files         []FilePreview   `json:"files"`
	TotalRows     int             `json:"totalRows"`
	FieldMappings map[string]bool `json:"fieldMappings"`
}

type CleanResult struct {
	TaskID       string            `json:"taskId"`
	BeforeRows   int               `json:"beforeRows"`
	AfterRows    int               `json:"afterRows"`
	NullFields   int               `json:"nullFields"`
	Duplicates   int               `json:"duplicates"`
	AbnormalRows int               `json:"abnormalRows"`
	SkippedVoid  int               `json:"skippedVoid"`
	Issues       map[string]int    `json:"issues"`
	Errors       []string          `json:"errors"`
	SourceFiles  []string          `json:"sourceFiles"`
	Metrics      map[string]string `json:"metrics"`
}

type TaskEvent struct {
	TaskID   string `json:"taskId"`
	Status   string `json:"status"`
	Step     string `json:"step"`
	Message  string `json:"message"`
	Progress int    `json:"progress"`
}

type PenetrationRequest struct {
	EntryType   string  `json:"entryType"`
	EntryValue  string  `json:"entryValue"`
	MaxHops     int     `json:"maxHops"`
	Direction   string  `json:"direction"`
	BranchLimit int     `json:"branchLimit"`
	NodeLimit   int     `json:"nodeLimit"`
	EdgeLimit   int     `json:"edgeLimit"`
	MinAmount   float64 `json:"minAmount"`
	StartDate   string  `json:"startDate"`
	EndDate     string  `json:"endDate"`
}

type GraphNode struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	Category    string  `json:"category"`
	TotalIn     float64 `json:"totalIn"`
	TotalOut    float64 `json:"totalOut"`
	Degree      int     `json:"degree"`
	Depth       int     `json:"depth"`
	GangID      int     `json:"gangId,omitempty"`
	Betweenness float64 `json:"betweenness,omitempty"`
	Role        string  `json:"role,omitempty"`
}

type GraphLink struct {
	Source     string   `json:"source"`
	Target     string   `json:"target"`
	Value      float64  `json:"value"`
	Count      int      `json:"count"`
	Label      string   `json:"label"`
	IsBackflow bool     `json:"isBackflow"`
	GoodsNames []string `json:"goodsNames"`
	GangID     int      `json:"gangId,omitempty"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}

type PenetrationResult struct {
	TaskID    string    `json:"taskId"`
	Entry     string    `json:"entry"`
	MaxHops   int       `json:"maxHops"`
	Direction string    `json:"direction"`
	Truncated bool      `json:"truncated,omitempty"`
	TrimNote  string    `json:"trimNote,omitempty"`
	Summary   string    `json:"summary"`
	Graph     GraphData `json:"graph"`
	NodeSize  int       `json:"nodeSize"`
	EdgeSize  int       `json:"edgeSize"`
}

type ProfileRequest struct {
	MinEdgeAmount float64 `json:"minEdgeAmount"`
	MinPairCount  int     `json:"minPairCount,omitempty"`
	EntryType     string  `json:"entryType,omitempty"`
	EntryValue    string  `json:"entryValue,omitempty"`
}

type RoleGroup struct {
	Role    string   `json:"role"`
	Members []string `json:"members"`
}

type PairStat struct {
	Source string  `json:"source"`
	Target string  `json:"target"`
	Count  int     `json:"count"`
	Amount float64 `json:"amount"`
}

type HourStat struct {
	Hour  int `json:"hour"`
	Count int `json:"count"`
}

type ProfileResult struct {
	TaskID            string      `json:"taskId"`
	RoleGroups        []RoleGroup `json:"roleGroups"`
	KeyNodes          []GraphNode `json:"keyNodes"`
	FrequentContacts  []PairStat  `json:"frequentContacts"`
	ActiveByHour      []HourStat  `json:"activeByHour"`
	Geography         []PairStat  `json:"geography"`
	Graph             GraphData   `json:"graph"`
	OrganizationBrief string      `json:"organizationBrief"`
	Gangs             []GangInfo  `json:"gangs,omitempty"`
	GangCount         int         `json:"gangCount,omitempty"`
}

type GangInfo struct {
	GangID          int      `json:"gangId"`
	Label           string   `json:"label"`
	Size            int      `json:"size"`
	Leader          string   `json:"leader"`
	CoreMembers     []string `json:"coreMembers"`
	Periphery       []string `json:"periphery"`
	TotalAmount     float64  `json:"totalAmount"`
	EdgeCount       int      `json:"edgeCount"`
	EvidenceSummary []string `json:"evidenceSummary,omitempty"`
}

type ReportRequest struct {
	PenetrationTaskID string `json:"penetrationTaskId"`
	ProfileTaskID     string `json:"profileTaskId"`
	OutputPath        string `json:"outputPath"`
}

type ReportResponse struct {
	TaskID      string `json:"taskId"`
	OutputPath  string `json:"outputPath"`
	DownloadURL string `json:"downloadUrl"`
}
