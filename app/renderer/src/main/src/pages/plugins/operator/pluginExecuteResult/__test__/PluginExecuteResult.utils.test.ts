import { describe, expect, it } from 'vitest'
import { getTaskDetailHTTPFlowOptions } from '../PluginExecuteResult.utils'

describe('getTaskDetailHTTPFlowOptions', () => {
  it('uses the simplified traffic view only for task-list detail pages', () => {
    expect(getTaskDetailHTTPFlowOptions(false)).toEqual({
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
    })

    expect(getTaskDetailHTTPFlowOptions(true)).toEqual({
      hideDataCard: true,
      hideConsoleTab: true,
      httpTabName: '流量信息',
      riskTabName: '漏洞',
      defaultExcludeColumnsKey: [
        'Tags',
        'BodyLength',
        'HtmlTitle',
        'GetParamsTotal',
        'ContentType',
        'PathSuffix',
        'DurationMs',
        'RequestSizeVerbose',
      ],
      showActionIcons: false,
      showHistorySearchHint: false,
      showFavorites: false,
      resetQueryOnRefresh: true,
      hostColumnWidth: 134,
      compactRiskDetail: true,
    })
  })
})
