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
      defaultExcludeColumnsKey: undefined,
      showActionIcons: true,
    }
  }

  return {
    hideDataCard: true,
    hideConsoleTab: true,
    httpTabName: '流量信息',
    defaultExcludeColumnsKey: taskDetailHTTPFlowExcludeColumns,
    showActionIcons: false,
  }
}
