import { describe, expect, it, vi } from 'vitest'
import { queryYakPocGroupsWithDefaultInstall } from '@/pages/securityTool/yakPoC/defaultPluginRecovery'

describe('queryYakPocGroupsWithDefaultInstall', () => {
  it('installs enterprise defaults and queries groups again when the local list is empty', async () => {
    const defaultGroup = [{ Value: '企业默认漏洞插件', Total: 20 }]
    const queryGroups = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(defaultGroup)
    const installDefaults = vi.fn().mockResolvedValue(undefined)

    await expect(queryYakPocGroupsWithDefaultInstall(queryGroups, installDefaults)).resolves.toEqual(defaultGroup)
    expect(installDefaults).toHaveBeenCalledTimes(1)
    expect(queryGroups).toHaveBeenCalledTimes(2)
  })

  it('does not download defaults when local vulnerability groups already exist', async () => {
    const groups = [{ Value: 'SQL注入', Total: 4 }]
    const queryGroups = vi.fn().mockResolvedValue(groups)
    const installDefaults = vi.fn().mockResolvedValue(undefined)

    await expect(queryYakPocGroupsWithDefaultInstall(queryGroups, installDefaults)).resolves.toEqual(groups)
    expect(installDefaults).not.toHaveBeenCalled()
    expect(queryGroups).toHaveBeenCalledTimes(1)
  })
})
