const taskDetailHTTPFlowExcludeColumns = [
  'Tags',
  'BodyLength',
  'HtmlTitle',
  'GetParamsTotal',
  'ContentType',
  'PathSuffix',
  'DurationMs',
  'RequestSizeVerbose',
]

export const getTaskDetailHTTPFlowOptions = (isTaskDetail: boolean) => {
  if (!isTaskDetail) {
    return {
      hideDataCard: false,
      hideConsoleTab: false,
      httpTabName: undefined,
      riskTabName: undefined,
      defaultExcludeColumnsKey: undefined,
      showActionIcons: true,
      showHistorySearchHint: true,
      showFavorites: true,
      resetQueryOnRefresh: false,
      hostColumnWidth: undefined,
      compactRiskDetail: false,
    }
  }

  return {
    hideDataCard: true,
    hideConsoleTab: true,
    httpTabName: '流量信息',
    riskTabName: '漏洞',
    defaultExcludeColumnsKey: taskDetailHTTPFlowExcludeColumns,
    showActionIcons: false,
    showHistorySearchHint: false,
    showFavorites: false,
    resetQueryOnRefresh: true,
    hostColumnWidth: 134,
    compactRiskDetail: true,
  }
}
