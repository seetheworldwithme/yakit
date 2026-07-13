import { describe, expect, it } from 'vitest'
import { getTaskDetailHTTPFlowOptions } from '../PluginExecuteResult.utils'

describe('getTaskDetailHTTPFlowOptions', () => {
  it('uses the simplified traffic view only for task-list detail pages', () => {
    expect(getTaskDetailHTTPFlowOptions(false)).toEqual({
      hideDataCard: false,
      hideConsoleTab: false,
      httpTabName: undefined,
      defaultExcludeColumnsKey: undefined,
      showActionIcons: true,
    })

    expect(getTaskDetailHTTPFlowOptions(true)).toEqual({
      hideDataCard: true,
      hideConsoleTab: true,
      httpTabName: '流量信息',
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
    })
  })
})
