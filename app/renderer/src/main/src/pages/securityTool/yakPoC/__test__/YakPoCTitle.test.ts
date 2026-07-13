import { describe, expect, it } from 'vitest'
import { getYakPoCPageTitle } from '@/pages/securityTool/yakPoC/YakPoCTitle'

describe('getYakPoCPageTitle', () => {
  it('uses 漏洞详情 for a task opened from the task list', () => {
    expect(getYakPoCPageTitle({ runtimeId: 'task-runtime-id' })).toBe('漏洞详情')
  })

  it('keeps 漏洞检测 for a new scan page', () => {
    expect(getYakPoCPageTitle({ runtimeId: '' })).toBe('漏洞检测')
  })
})
