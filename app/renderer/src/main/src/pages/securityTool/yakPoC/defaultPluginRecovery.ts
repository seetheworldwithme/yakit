import { randomString } from '@/utils/randomUtil'

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

export const queryYakPocGroupsWithDefaultInstall = async <T>(
  queryGroups: () => Promise<T[]>,
  installDefaults: () => Promise<void>,
): Promise<T[]> => {
  const groups = await queryGroups()
  if (groups.length > 0) return groups

  await installDefaults()
  return await queryGroups()
}
