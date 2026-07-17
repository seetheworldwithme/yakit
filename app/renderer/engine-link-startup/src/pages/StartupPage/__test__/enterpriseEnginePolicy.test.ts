import { describe, expect, it } from 'vitest'
import { getEnterpriseBuiltInEngineAction } from '../enterpriseEnginePolicy'

describe('getEnterpriseBuiltInEngineAction', () => {
  it.each(['install', 'old_version', 'skipAgreement_Install', 'allow-secret-error'] as const)(
    '企业版状态为 %s 时自动恢复内置引擎并重启',
    (status) => {
      expect(getEnterpriseBuiltInEngineAction(true, status)).toBe('restore-and-relaunch')
    },
  )

  it('企业版检测到内置引擎更新时自动恢复并继续连接', () => {
    expect(getEnterpriseBuiltInEngineAction(true, 'update_yak')).toBe('restore-and-continue')
  })

  it('非企业版保留现有交互式更新流程', () => {
    expect(getEnterpriseBuiltInEngineAction(false, 'update_yak')).toBeNull()
  })

  it('企业版正常连接状态不触发内置引擎恢复', () => {
    expect(getEnterpriseBuiltInEngineAction(true, 'link')).toBeNull()
  })
})
