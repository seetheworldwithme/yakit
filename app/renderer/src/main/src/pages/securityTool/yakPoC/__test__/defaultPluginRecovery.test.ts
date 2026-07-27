import { describe, expect, it, vi } from 'vitest'
import {
  installBundledYakPocPlugins,
  queryYakPocGroupsWithRecovery,
} from '@/pages/securityTool/yakPoC/defaultPluginRecovery'

describe('queryYakPocGroupsWithRecovery', () => {
  it('uses bundled core plugins before trying the enterprise service', async () => {
    const defaultGroup = [{ Value: '企业默认漏洞插件', Total: 20 }]
    const queryGroups = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(defaultGroup)
    const installBundled = vi.fn().mockResolvedValue(undefined)
    const installOnline = vi.fn().mockResolvedValue(undefined)

    await expect(queryYakPocGroupsWithRecovery(queryGroups, installBundled, installOnline)).resolves.toEqual(
      defaultGroup,
    )
    expect(installBundled).toHaveBeenCalledTimes(1)
    expect(installOnline).not.toHaveBeenCalled()
    expect(queryGroups).toHaveBeenCalledTimes(2)
  })

  it('falls back to the enterprise service when the engine has no bundled vulnerability plugins', async () => {
    const defaultGroup = [{ Value: '企业默认漏洞插件', Total: 20 }]
    const queryGroups = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(defaultGroup)
    const installBundled = vi.fn().mockResolvedValue(undefined)
    const installOnline = vi.fn().mockResolvedValue(undefined)

    await expect(queryYakPocGroupsWithRecovery(queryGroups, installBundled, installOnline)).resolves.toEqual(
      defaultGroup,
    )
    expect(installBundled).toHaveBeenCalledTimes(1)
    expect(installOnline).toHaveBeenCalledTimes(1)
    expect(queryGroups).toHaveBeenCalledTimes(3)
  })

  it('does not install anything when local vulnerability groups already exist', async () => {
    const groups = [{ Value: 'SQL注入', Total: 4 }]
    const queryGroups = vi.fn().mockResolvedValue(groups)
    const installBundled = vi.fn().mockResolvedValue(undefined)
    const installOnline = vi.fn().mockResolvedValue(undefined)

    await expect(queryYakPocGroupsWithRecovery(queryGroups, installBundled, installOnline)).resolves.toEqual(groups)
    expect(installBundled).not.toHaveBeenCalled()
    expect(installOnline).not.toHaveBeenCalled()
    expect(queryGroups).toHaveBeenCalledTimes(1)
  })
})

describe('installBundledYakPocPlugins', () => {
  it('creates a page-local group from executable bundled core vulnerability plugins', async () => {
    const queryScripts = vi.fn().mockResolvedValue({
      Data: [
        { ScriptName: 'Fastjson 综合检测', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'Nuclei 默认检测', Type: 'nuclei', IsCorePlugin: true },
        { ScriptName: '用户自建插件', Type: 'mitm', IsCorePlugin: false },
        { ScriptName: '核心编解码器', Type: 'codec', IsCorePlugin: true },
      ],
    })
    const saveGroup = vi.fn().mockResolvedValue(null)

    await installBundledYakPocPlugins('poc-page-1', 'mitm,port-scan,nuclei', queryScripts, saveGroup)

    expect(queryScripts).toHaveBeenCalledWith(
      expect.objectContaining({
        Type: 'mitm,port-scan,nuclei',
        IsMITMParamPlugins: 2,
      }),
      true,
    )
    expect(saveGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        PageId: 'poc-page-1',
        SaveGroup: ['企业默认漏洞插件'],
        Filter: expect.objectContaining({
          IncludedScriptNames: ['Fastjson 综合检测', 'Nuclei 默认检测'],
        }),
      }),
    )
  })
})
