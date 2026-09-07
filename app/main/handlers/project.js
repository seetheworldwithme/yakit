const { ipcMain, app } = require('electron')
const fs = require('fs')
const path = require('path')
const { getYakProjects, getEngineLogDir } = require('../filePath')

/** 导出去品牌化重命名的诊断日志，落盘到引擎日志目录便于排查 */
const logExportDebrand = (msg) => {
  try {
    fs.mkdirSync(getEngineLogDir(), { recursive: true })
    fs.appendFileSync(path.join(getEngineLogDir(), 'export-rename.log'), `[${new Date().toISOString()}] ${msg}\n`)
  } catch {}
}

/**
 * 导出项目文件名去品牌化（仅 irify/irifyee）
 * 导出文件名由引擎生成（加密导出 *.yakitproject.enc，明文导出 *.yakitproject），
 * 引擎不提供命名参数，导出完成后原地重命名去掉 yakit 字样。
 * 导入按文件内容解析、不校验扩展名，重命名不影响再次导入。
 * 明文导出时引擎发出 end 后文件句柄可能未立即释放（Windows），失败时自动重试。
 */
const debrandExportedProjectFile = (targetPath, onRenamed) => {
  try {
    const appName = String(app.getName() || '').toLowerCase()
    if (appName !== 'irify' && appName !== 'irifyee') return
    logExportDebrand(`raw TargetPath: ${targetPath}`)
    if (!targetPath || !/yakit/i.test(path.basename(targetPath))) return
    // 引擎返回的可能是相对 projects 目录的相对路径（与 fingerprint/syntaxFlow 下载流一致）
    const absPath = path.isAbsolute(targetPath) ? targetPath : path.join(getYakProjects(), targetPath)
    // 注意不能按扩展名拆分：明文导出 *.yakitproject 的 yakit 在 extname 眼里属于"扩展名"，
    // 必须对完整文件名整体替换（*.yakitproject.enc 与 *.yakitproject 两种命名通吃）
    const name = path.basename(absPath)
    const newName = name.replace(/yakit/gi, '').replace(/^\.+/, '')
    if (!newName || newName === name) {
      logExportDebrand(`skip: nothing to rename: ${name}`)
      return
    }
    const newPath = path.join(path.dirname(absPath), newName)

    let attempts = 0
    const attempt = () => {
      attempts++
      try {
        if (!fs.existsSync(absPath)) {
          logExportDebrand(`skip: file not found: ${absPath}`)
          return
        }
        if (fs.existsSync(newPath)) {
          logExportDebrand(`skip: target already exists: ${newPath}`)
          return
        }
        fs.renameSync(absPath, newPath)
        logExportDebrand(`renamed: ${path.basename(absPath)} -> ${path.basename(newPath)} (attempts=${attempts})`)
        onRenamed && onRenamed(newPath)
      } catch (e) {
        logExportDebrand(`rename failed (attempts=${attempts}): ${e}`)
        if (attempts < 10) setTimeout(attempt, 300)
      }
    }
    attempt()
  } catch (e) {
    logExportDebrand(`debrand failed: ${e}`)
  }
}

module.exports = (win, getClient) => {
  // asyncSetCurrentProject wrapper
  const asyncSetCurrentProject = (params) => {
    return new Promise((resolve, reject) => {
      getClient().SetCurrentProject(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('SetCurrentProject', async (e, params) => {
    return await asyncSetCurrentProject(params)
  })

  // asyncGetCurrentProject wrapper
  const asyncGetCurrentProjectEx = (params) => {
    return new Promise((resolve, reject) => {
      getClient().GetCurrentProjectEx(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('GetCurrentProjectEx', async (e, params) => {
    return await asyncGetCurrentProjectEx(params)
  })

  const asyncGetSSAWorkbenchDashboard = (params) => {
    return new Promise((resolve, reject) => {
      getClient().GetSSAWorkbenchDashboard(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('GetSSAWorkbenchDashboard', async (e, params) => {
    return await asyncGetSSAWorkbenchDashboard(params)
  })

  // asyncGetProjects wrapper
  const asyncGetProjects = (params) => {
    return new Promise((resolve, reject) => {
      getClient().GetProjects(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('GetProjects', async (e, params) => {
    return await asyncGetProjects(params)
  })

  // asyncNewProject wrapper
  const asyncNewProject = (params) => {
    return new Promise((resolve, reject) => {
      getClient().NewProject(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('NewProject', async (e, params) => {
    return await asyncNewProject(params)
  })

  // asyncUpdateProject wrapper
  const asyncUpdateProject = (params) => {
    return new Promise((resolve, reject) => {
      getClient().UpdateProject(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('UpdateProject', async (e, params) => {
    return await asyncUpdateProject(params)
  })

  // asyncIsProjectNameValid wrapper
  const asyncIsProjectNameValid = (params) => {
    return new Promise((resolve, reject) => {
      getClient().IsProjectNameValid(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('IsProjectNameValid', async (e, params) => {
    return await asyncIsProjectNameValid(params)
  })

  // asyncRemoveProject wrapper
  const asyncRemoveProject = (params) => {
    return new Promise((resolve, reject) => {
      getClient().RemoveProject(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('RemoveProject', async (e, params) => {
    return await asyncRemoveProject(params)
  })

  // asyncDeleteProject wrapper
  const asyncDeleteProject = (params) => {
    return new Promise((resolve, reject) => {
      getClient().DeleteProject(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('DeleteProject', async (e, params) => {
    return await asyncDeleteProject(params)
  })

  // asyncGetDefaultProjectEx wrapper
  const asyncGetDefaultProjectEx = (params) => {
    return new Promise((resolve, reject) => {
      getClient().GetDefaultProjectEx(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('GetDefaultProjectEx', async (e, params) => {
    return await asyncGetDefaultProjectEx(params)
  })

  const asyncGetTemporaryProjectEx = (params) => {
    return new Promise((resolve, reject) => {
      getClient().GetTemporaryProjectEx(params, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }
  ipcMain.handle('GetTemporaryProjectEx', async (e, params) => {
    return await asyncGetTemporaryProjectEx(params)
  })

  const handlerHelper = require('./handleStreamWithContext')

  const streamExportProjectMap = new Map()
  ipcMain.handle('cancel-ExportProject', handlerHelper.cancelHandler(streamExportProjectMap))
  ipcMain.handle('ExportProject', (e, params, token) => {
    let stream = getClient().ExportProject(params)
    // 先于 registerHandler 挂监听：捕获引擎返回的目标路径，end 时先重命名再通知渲染进程
    let exportTargetPath = ''
    stream.on('data', (data) => {
      if (data && data.TargetPath) exportTargetPath = data.TargetPath
    })
    stream.on('end', () => {
      debrandExportedProjectFile(exportTargetPath, (newPath) => {
        // 渲染进程记录的是旧路径，重命名成功后补发一次数据事件纠正「打开所在文件夹」的目标
        if (newPath && win && !win.isDestroyed()) {
          win.webContents.send(`${token}-data`, { TargetPath: newPath })
        }
      })
    })
    handlerHelper.registerHandler(win, stream, streamExportProjectMap, token)
  })

  const streamImportProjectMap = new Map()
  ipcMain.handle('cancel-ImportProject', handlerHelper.cancelHandler(streamImportProjectMap))
  ipcMain.handle('ImportProject', (e, params, token) => {
    let stream = getClient().ImportProject(params)
    handlerHelper.registerHandler(win, stream, streamImportProjectMap, token)
  })
}
