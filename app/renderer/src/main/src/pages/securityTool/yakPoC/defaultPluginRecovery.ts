import { randomString } from '@/utils/randomUtil'
import type { QueryYakScriptRequest, QueryYakScriptsResponse, SaveYakScriptGroupRequest } from '@/pages/invoker/schema'

interface DefaultPluginDownloadRequest {
  ListType: string
  PluginType: string[]
  Official: boolean[]
}

interface IpcRendererLike {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  once: (channel: string, listener: (...args: unknown[]) => void) => void
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => void
}

type QueryScripts = (query: QueryYakScriptRequest, hiddenError?: boolean) => Promise<QueryYakScriptsResponse>

type SaveGroup = (params: SaveYakScriptGroupRequest) => Promise<null>

export const DEFAULT_BUNDLED_YAK_POC_GROUP = '企业默认漏洞插件'
export const LEGACY_BUNDLED_YAK_POC_GROUPS = [DEFAULT_BUNDLED_YAK_POC_GROUP, '内置漏洞插件']

/**
 * Keep the offline presentation consistent with the enterprise service bundle:
 * yakit-enterprise/backend/default-plugins/groups.json.
 */
export const BUNDLED_YAK_POC_GROUPS: Record<string, readonly string[]> = {
  Java: [
    'Fastjson 综合检测',
    'SQL注入-Path参数注入',
    'SQL注入-UNION注入-MD5函数',
    'SQL注入-高危Header注入',
    'SSTI Expr 服务器模版表达式注入',
    'Shiro 指纹识别 + 弱密码检测',
    'Shiro 自定义检测',
    '基础 XSS 检测',
  ],
  SQL注入: [
    'SQL注入-MySQL-ErrorBased',
    'SQL注入-Path参数注入',
    'SQL注入-UNION注入-MD5函数',
    'SQL注入-堆叠注入',
    'SQL注入-时间盲注-Sleep',
    'SQL注入-高危Header注入',
  ],
  安全产品: [
    'HTTP请求走私',
    'SQL注入-MySQL-ErrorBased',
    'SQL注入-时间盲注-Sleep',
    'SSRF HTTP Public',
    'Swagger JSON 泄漏',
  ],
  '远程代码执行（扫描）': [
    'Fastjson 综合检测',
    'SSRF HTTP Public',
    'Shiro 指纹识别 + 弱密码检测',
    'Shiro 自定义检测',
    '开放 URL 重定向漏洞',
  ],
  PHP: ['SSTI Expr 服务器模版表达式注入', '基础 XSS 检测', '多认证综合越权测试'],
  XSS: ['基础 XSS 检测', '文件包含'],
  FastJSON: ['Fastjson 综合检测'],
  IIS: ['Fastjson 综合检测'],
  Shiro: ['Shiro 指纹识别 + 弱密码检测'],
  Spring: ['Fastjson 综合检测'],
}

export const installDefaultYakPocPlugins = (
  request: DefaultPluginDownloadRequest,
  renderer?: IpcRendererLike,
): Promise<void> => {
  const ipcRenderer = renderer || window.require('electron').ipcRenderer
  const taskToken = `yak-poc-default-${randomString(24)}`

  return new Promise((resolve, reject) => {
    const endChannel = `${taskToken}-end`
    const errorChannel = `${taskToken}-error`

    const cleanup = () => {
      ipcRenderer.removeListener(endChannel, handleEnd)
      ipcRenderer.removeListener(errorChannel, handleError)
    }
    const handleEnd = () => {
      cleanup()
      resolve()
    }
    const handleError = (_event: unknown, error: unknown) => {
      cleanup()
      reject(new Error(String(error || '安装默认漏洞插件失败')))
    }

    ipcRenderer.once(endChannel, handleEnd)
    ipcRenderer.once(errorChannel, handleError)
    ipcRenderer.invoke('DownloadOnlinePlugins', request, taskToken).catch((error) => {
      cleanup()
      reject(error)
    })
  })
}

export const installBundledYakPocPlugins = async (
  pageId: string,
  pluginType: string,
  queryScripts: QueryScripts,
  saveGroup: SaveGroup,
): Promise<void> => {
  const response = await queryScripts(
    {
      Pagination: {
        Page: 1,
        Limit: 10000,
        Order: 'asc',
        OrderBy: 'script_name',
      },
      Type: pluginType,
      IsMITMParamPlugins: 2,
    },
    true,
  )
  const allowedTypes = new Set(pluginType.split(','))
  const includedScriptNames = (response.Data || [])
    .filter((plugin) => plugin.IsCorePlugin && allowedTypes.has(plugin.Type))
    .map((plugin) => plugin.ScriptName)

  if (includedScriptNames.length === 0) return

  const buildFilter = (scriptNames: string[]): QueryYakScriptRequest => ({
    Pagination: {
      Page: 1,
      Limit: scriptNames.length,
      Order: 'asc',
      OrderBy: 'script_name',
    },
    Type: pluginType,
    IncludedScriptNames: scriptNames,
    IsMITMParamPlugins: 2,
  })
  const availablePluginNames = new Set(includedScriptNames)
  const availableGroups = Object.entries(BUNDLED_YAK_POC_GROUPS)
    .map(([group, scriptNames]) => ({
      group,
      scriptNames: scriptNames.filter((scriptName) => availablePluginNames.has(scriptName)),
    }))
    .filter((item) => item.scriptNames.length > 0)

  if (availableGroups.length === 0) return

  await saveGroup({
    Filter: buildFilter(includedScriptNames),
    SaveGroup: [],
    RemoveGroup: [...LEGACY_BUNDLED_YAK_POC_GROUPS],
    PageId: pageId,
  })

  for (const { group, scriptNames } of availableGroups) {
    await saveGroup({
      Filter: buildFilter(scriptNames),
      SaveGroup: [group],
      RemoveGroup: [],
      PageId: pageId,
    })
  }
}

const isLegacyBundledGroup = (value?: string) => {
  return LEGACY_BUNDLED_YAK_POC_GROUPS.includes(value || '')
}

const withoutLegacyBundledGroups = <T extends { Value?: string }>(groups: T[]) => {
  return groups.filter((group) => !isLegacyBundledGroup(group.Value))
}

export const queryYakPocGroupsWithRecovery = async <T extends { Value?: string }>(
  queryGroups: () => Promise<T[]>,
  installBundled: () => Promise<void>,
  installOnline: () => Promise<void>,
): Promise<T[]> => {
  const groups = await queryGroups()
  if (groups.length > 0 && withoutLegacyBundledGroups(groups).length === groups.length) return groups

  try {
    await installBundled()
  } catch (error) {}

  const bundledGroups = withoutLegacyBundledGroups(await queryGroups())
  if (bundledGroups.length > 0) return bundledGroups

  await installOnline()
  return withoutLegacyBundledGroups(await queryGroups())
}
