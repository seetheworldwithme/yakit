/** 漏洞与风险离线 HTML 导出模板 */
interface RiskHtmlLabels {
  heading: string
  search: string
  noData: string
  details: string
  id: string
  title: string
  type: string
  level: string
  ip: string
  url: string
  tags: string
  discoveryTime: string
  request: string
  response: string
  description: string
  solution: string
  parameter: string
  payload: string
  source: string
}

const getOfflineHtmlTemplate = (labels: RiskHtmlLabels) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>靖云甲web应用漏洞扫描</title>
  <style>
    :root { color-scheme: light; font-family: 'Microsoft YaHei', Arial, sans-serif; color: #172033; background: #f4f7fb; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { max-width: 1440px; margin: 0 auto; }
    h1 { margin: 0; font-size: 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .brand { color: #1677ff; font-size: 14px; font-weight: 600; }
    .search { width: min(360px, 100%); padding: 9px 12px; border: 1px solid #cfd8e6; border-radius: 6px; font: inherit; }
    .table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
    table { width: 100%; border-collapse: collapse; min-width: 1000px; }
    th, td { padding: 11px 12px; border-bottom: 1px solid #edf1f6; text-align: left; vertical-align: top; }
    th { background: #f7f9fc; color: #4b5b73; font-weight: 600; white-space: nowrap; }
    tbody tr.data-row { cursor: pointer; }
    tbody tr.data-row:hover { background: #f3f8ff; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 12px; white-space: nowrap; }
    .level-info { background: #4caf78; }.level-low { background: #e69a38; }.level-medium { background: #e47732; }.level-high { background: #d94b4b; }.level-critical { background: #a51d1d; }
    .details td { padding: 0; background: #fbfcfe; }.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 18px; }
    .detail-item { min-width: 0; }.detail-item.wide { grid-column: 1 / -1; }.detail-label { display: block; margin-bottom: 4px; color: #65758d; font-size: 12px; font-weight: 600; }.detail-value { overflow-wrap: anywhere; white-space: pre-wrap; }
    pre { max-height: 300px; margin: 0; padding: 12px; overflow: auto; border-radius: 4px; background: #172033; color: #edf4ff; font: 12px/1.5 Consolas, monospace; white-space: pre-wrap; }
    .empty { padding: 36px; color: #65758d; text-align: center; }
    @media (max-width: 720px) { body { padding: 12px; }.header { align-items: stretch; flex-direction: column; }.detail-grid { grid-template-columns: 1fr; }.detail-item.wide { grid-column: auto; } }
  </style>
</head>
<body>
  <main>
    <div class="header">
      <div><div class="brand">靖云甲web应用漏洞扫描</div><h1>${labels.heading}</h1></div>
      <input id="search" class="search" type="search" placeholder="${labels.search}" />
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>${labels.id}</th><th>${labels.title}</th><th>${labels.type}</th><th>${labels.level}</th><th>${
          labels.ip
        }</th><th>${labels.url}</th><th>${labels.tags}</th><th>${labels.discoveryTime}</th></tr></thead>
        <tbody id="risk-list"></tbody>
      </table>
      <div id="empty" class="empty" hidden>${labels.noData}</div>
    </div>
  </main>
  <script src="./data.js"></script>
  <script>
    (function () {
      var sourceData = typeof initData !== 'undefined' && Array.isArray(initData) ? initData : []
      var list = document.getElementById('risk-list')
      var empty = document.getElementById('empty')
      var search = document.getElementById('search')
      var labels = ${JSON.stringify(labels)}
      var expandedId = null

      function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value).replace(/[&<>'"]/g, function (character) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]
        })
      }

      function severityInfo(value) {
        var level = String(value || '').toLowerCase()
        if (['fatal', 'critical', 'panic'].indexOf(level) >= 0) return { text: '严重', className: 'level-critical' }
        if (level === 'high') return { text: '高危', className: 'level-high' }
        if (['middle', 'warn', 'warning', 'medium'].indexOf(level) >= 0) return { text: '中危', className: 'level-medium' }
        if (level === 'low') return { text: '低危', className: 'level-low' }
        return { text: '信息', className: 'level-info' }
      }

      function formatTime(value) {
        var timestamp = Number(value)
        if (!timestamp) return '-'
        if (timestamp < 100000000000) timestamp *= 1000
        var date = new Date(timestamp)
        return isNaN(date.getTime()) ? String(value) : date.toLocaleString()
      }

      function cell(value) { return '<td>' + escapeHtml(value || '-') + '</td>' }
      function detail(label, value, wide) {
        return '<div class="detail-item' + (wide ? ' wide' : '') + '"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-value">' + escapeHtml(value || '-') + '</div></div>'
      }
      function codeDetail(label, value) {
        if (!value) return ''
        return '<div class="detail-item wide"><span class="detail-label">' + escapeHtml(label) + '</span><pre>' + escapeHtml(value) + '</pre></div>'
      }
      function rowDetails(item) {
        return '<tr class="details"><td colspan="8"><div class="detail-grid">' +
          detail(labels.description, item.Description, true) + detail(labels.solution, item.Solution, true) +
          detail(labels.parameter, item.Parameter) + detail(labels.payload, item.Payload) +
          detail(labels.source, item.FromYakScript) + codeDetail(labels.request, item.RequestString) + codeDetail(labels.response, item.ResponseString) +
          '</div></td></tr>'
      }
      function render() {
        var keyword = search.value.trim().toLowerCase()
        var data = sourceData.filter(function (item) { return !keyword || JSON.stringify(item).toLowerCase().indexOf(keyword) >= 0 })
        list.innerHTML = data.map(function (item) {
          var id = item.Id || item.Hash || ''
          var severity = severityInfo(item.Severity)
          var row = '<tr class="data-row" data-id="' + escapeHtml(id) + '">' + cell(item.Id) + cell(item.TitleVerbose || item.Title) + cell(item.RiskTypeVerbose || item.RiskType) +
            '<td><span class="tag ' + severity.className + '">' + escapeHtml(severity.text) + '</span></td>' + cell(item.IP) + cell(item.Url) + cell(String(item.Tags || '').replace(/\\|/g, ', ')) + cell(formatTime(item.CreatedAt)) + '</tr>'
          return row + (String(expandedId) === String(id) ? rowDetails(item) : '')
        }).join('')
        empty.hidden = data.length > 0
      }
      list.addEventListener('click', function (event) {
        var row = event.target.closest('.data-row')
        if (!row) return
        expandedId = String(expandedId) === row.dataset.id ? null : row.dataset.id
        render()
      })
      search.addEventListener('input', render)
      render()
    })()
  </script>
</body>
</html>`

export const getHtmlTemplate = () =>
  getOfflineHtmlTemplate({
    heading: '漏洞与风险台账',
    search: '搜索漏洞信息',
    noData: '暂无漏洞信息',
    details: '详情',
    id: '编号',
    title: '标题',
    type: '类型',
    level: '风险等级',
    ip: 'IP',
    url: 'URL',
    tags: '标签',
    discoveryTime: '发现时间',
    request: '请求报文',
    response: '响应报文',
    description: '漏洞描述',
    solution: '修复建议',
    parameter: '参数',
    payload: 'Payload',
    source: '漏洞检测来源',
  })

export const getHtmlZhTWTemplate = () =>
  getOfflineHtmlTemplate({
    heading: '漏洞與風險台帳',
    search: '搜尋漏洞資訊',
    noData: '暫無漏洞資訊',
    details: '詳情',
    id: '編號',
    title: '標題',
    type: '類型',
    level: '風險等級',
    ip: 'IP',
    url: 'URL',
    tags: '標籤',
    discoveryTime: '發現時間',
    request: '請求報文',
    response: '回應報文',
    description: '漏洞描述',
    solution: '修復建議',
    parameter: '參數',
    payload: 'Payload',
    source: '漏洞檢測來源',
  })

export const getHtmlEnTemplate = () =>
  getOfflineHtmlTemplate({
    heading: 'Vulnerability Risk Ledger',
    search: 'Search vulnerability information',
    noData: 'No vulnerability information',
    details: 'Details',
    id: 'ID',
    title: 'Title',
    type: 'Type',
    level: 'Severity',
    ip: 'IP',
    url: 'URL',
    tags: 'Tags',
    discoveryTime: 'Discovery Time',
    request: 'Request',
    response: 'Response',
    description: 'Description',
    solution: 'Solution',
    parameter: 'Parameter',
    payload: 'Payload',
    source: 'Detection Source',
  })
