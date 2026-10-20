import { randomString } from '@/utils/randomUtil'
import { yakitNotify } from '@/utils/notification'

const { ipcRenderer } = window.require('electron')

interface SaveYakScriptToOnlineResponse {
  Progress: number
  Message: string
  MessageType: string
}

/** 是否有同步任务正在进行 */
let syncing = false
/** 本应用会话内是否已自动同步过(防止 userInfo 抖动反复触发，手动入口不受限) */
let autoSyncedThisSession = false

/** 分页拉取本地内置插件(is_core_plugin 且未忽略)的名字 */
const fetchCorePluginNames = async (): Promise<string[]> => {
  const names: string[] = []
  let page = 1
  const limit = 100
  // guard 上限 100 页，防御异常数据导致死循环
  for (let guard = 0; guard < 100; guard++) {
    const res: any = await ipcRenderer.invoke('QueryYakScript', {
      Pagination: { Page: page, Limit: limit, Order: 'desc', OrderBy: 'updated_at' },
      IsIgnore: false,
    })
    const data: any[] = res?.Data || []
    data.forEach((i) => {
      if (i?.IsCorePlugin && i?.ScriptName) names.push(i.ScriptName)
    })
    const total = Number(res?.Total) || 0
    if (data.length === 0 || page * limit >= total) break
    page++
  }
  return names
}

/**
 * 把本地内置插件同步(上传)到企业插件仓库：
 * 服务端对同名内置插件按名字原地更新内容，不存在的新建——
 * 引擎更新内置插件后重跑一次即可让服务端保持一致。
 */
export const syncBuiltinPluginsToServer = async (opts?: { silent?: boolean }): Promise<boolean> => {
  const silent = !!opts?.silent
  if (syncing) {
    if (!silent) yakitNotify('info', '内置插件同步进行中，请稍候')
    return false
  }
  syncing = true
  const finish = (ok: boolean): boolean => {
    syncing = false
    return ok
  }
  try {
    const names = await fetchCorePluginNames()
    if (names.length === 0) {
      if (!silent) yakitNotify('info', '本地暂无内置插件可同步')
      return finish(false)
    }
    if (!silent) yakitNotify('info', `开始同步 ${names.length} 个内置插件到企业插件仓库`)
    return await new Promise<boolean>((resolve) => {
      const taskToken = randomString(40)
      let errorCount = 0
      const cleanup = () => {
        ipcRenderer.invoke('cancel-SaveYakScriptToOnline', taskToken)
        ipcRenderer.removeAllListeners(`${taskToken}-data`)
        ipcRenderer.removeAllListeners(`${taskToken}-end`)
        ipcRenderer.removeAllListeners(`${taskToken}-error`)
      }
      ipcRenderer.on(`${taskToken}-data`, (_, data: SaveYakScriptToOnlineResponse) => {
        if (data?.MessageType === 'error') errorCount++
      })
      ipcRenderer.on(`${taskToken}-end`, () => {
        cleanup()
        if (errorCount > 0) {
          yakitNotify('error', `内置插件同步完成：成功 ${names.length - errorCount} 个，失败 ${errorCount} 个`)
          resolve(finish(false))
        } else {
          // 静默模式(登录自动同步)不弹「完成」通知，同步照常进行
          if (!silent) yakitNotify('success', `内置插件同步完成：共 ${names.length} 个`)
          resolve(finish(true))
        }
      })
      ipcRenderer.on(`${taskToken}-error`, (_, e) => {
        cleanup()
        yakitNotify('error', '内置插件同步异常:' + e)
        resolve(finish(false))
      })
      ipcRenderer.invoke('SaveYakScriptToOnline', { ScriptNames: names, IsPrivate: false }, taskToken).catch((e) => {
        cleanup()
        yakitNotify('error', '内置插件同步失败:' + e)
        resolve(finish(false))
      })
    })
  } catch (e) {
    yakitNotify('error', '内置插件同步失败:' + e)
    return finish(false)
  }
}

/** 登录成功后自动同步一次(每个应用会话只自动跑一次；手动入口可随时重跑) */
export const autoSyncBuiltinPluginsOnLogin = () => {
  if (autoSyncedThisSession || syncing) return
  autoSyncedThisSession = true
  // 静默同步：不弹「开始/完成」通知，仅失败时提示
  syncBuiltinPluginsToServer({ silent: true })
}
