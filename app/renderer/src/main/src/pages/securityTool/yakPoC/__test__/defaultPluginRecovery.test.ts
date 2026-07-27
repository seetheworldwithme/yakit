import { describe, expect, it, vi } from 'vitest'
import {
  installBundledYakPocPlugins,
  queryYakPocGroupsWithRecovery,
} from '@/pages/securityTool/yakPoC/defaultPluginRecovery'

describe('queryYakPocGroupsWithRecovery', () => {
  it('uses bundled core plugins before trying the enterprise service', async () => {
    const defaultGroup = [{ Value: 'Java', Total: 8 }]
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
    const defaultGroup = [{ Value: 'Java', Total: 8 }]
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

  it('migrates the legacy generic bundled group to classified groups', async () => {
    const legacyGroup = [{ Value: '企业默认漏洞插件', Total: 17 }]
    const classifiedGroups = [
      { Value: 'Java', Total: 8 },
      { Value: 'SQL注入', Total: 6 },
    ]
    const queryGroups = vi.fn().mockResolvedValueOnce(legacyGroup).mockResolvedValueOnce(classifiedGroups)
    const installBundled = vi.fn().mockResolvedValue(undefined)
    const installOnline = vi.fn().mockResolvedValue(undefined)

    await expect(queryYakPocGroupsWithRecovery(queryGroups, installBundled, installOnline)).resolves.toEqual(
      classifiedGroups,
    )
    expect(installBundled).toHaveBeenCalledTimes(1)
    expect(installOnline).not.toHaveBeenCalled()
    expect(queryGroups).toHaveBeenCalledTimes(2)
  })
})

describe('installBundledYakPocPlugins', () => {
  it('creates the same classified groups and counts as the enterprise service', async () => {
    const queryScripts = vi.fn().mockResolvedValue({
      Data: [
        { ScriptName: 'Fastjson 综合检测', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'HTTP请求走私', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SQL注入-MySQL-ErrorBased', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SQL注入-Path参数注入', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SQL注入-UNION注入-MD5函数', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SQL注入-堆叠注入', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SQL注入-时间盲注-Sleep', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SQL注入-高危Header注入', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SSRF HTTP Public', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'SSTI Expr 服务器模版表达式注入', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'Shiro 指纹识别 + 弱密码检测', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'Shiro 自定义检测', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: 'Swagger JSON 泄漏', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: '基础 XSS 检测', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: '多认证综合越权测试', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: '开放 URL 重定向漏洞', Type: 'mitm', IsCorePlugin: true },
        { ScriptName: '文件包含', Type: 'mitm', IsCorePlugin: true },
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

    const savedGroupCounts = Object.fromEntries(
      saveGroup.mock.calls.flatMap(([request]) =>
        request.SaveGroup.map((group) => [group, request.Filter.IncludedScriptNames?.length || 0]),
      ),
    )

    expect(savedGroupCounts).toEqual({
      Java: 8,
      SQL注入: 6,
      安全产品: 5,
      '远程代码执行（扫描）': 5,
      PHP: 3,
      XSS: 2,
      FastJSON: 1,
      IIS: 1,
      Shiro: 1,
      Spring: 1,
    })
    expect(saveGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        PageId: 'poc-page-1',
        SaveGroup: [],
        RemoveGroup: ['企业默认漏洞插件', '内置漏洞插件'],
        Filter: expect.objectContaining({
          IncludedScriptNames: expect.arrayContaining([
            'Fastjson 综合检测',
            'SQL注入-UNION注入-MD5函数',
            '基础 XSS 检测',
          ]),
        }),
      }),
    )
  })
})
