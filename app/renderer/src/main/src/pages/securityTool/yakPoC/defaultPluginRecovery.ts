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

  await saveGroup({
    Filter: {
      Pagination: {
        Page: 1,
        Limit: includedScriptNames.length,
        Order: 'asc',
        OrderBy: 'script_name',
      },
      Type: pluginType,
      IncludedScriptNames: includedScriptNames,
      IsMITMParamPlugins: 2,
    },
    SaveGroup: [DEFAULT_BUNDLED_YAK_POC_GROUP],
    RemoveGroup: [],
    PageId: pageId,
  })
}

export const queryYakPocGroupsWithRecovery = async <T>(
  queryGroups: () => Promise<T[]>,
  installBundled: () => Promise<void>,
  installOnline: () => Promise<void>,
): Promise<T[]> => {
  const groups = await queryGroups()
  if (groups.length > 0) return groups

  try {
    await installBundled()
  } catch (error) {}

  const bundledGroups = await queryGroups()
  if (bundledGroups.length > 0) return bundledGroups

  await installOnline()
  return await queryGroups()
}
