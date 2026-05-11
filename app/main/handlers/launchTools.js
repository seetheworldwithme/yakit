const electronFull = require('electron')
const { ipcMain, shell } = electronFull
const { exec } = require('child_process')
const path = require('path')
const { assertTrustedAppSender } = require('../security')

const VALID_PAGE_KEYS = new Set(['clean', 'penetration', 'profile', 'report', ''])

const TOOLS_WEB_URL = process.env.TOOLS_WEB_URL || 'http://localhost:18888'

const DESKTOP_APP_NAMES = ['jztools', 'anti-fraud-workbench']

function findDesktopApp() {
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  for (const appName of DESKTOP_APP_NAMES) {
    let appPath
    if (isMac) {
      appPath = `/Applications/${appName}.app`
    } else if (isWin) {
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
      appPath = path.join(programFiles, `${appName}`, `${appName}.exe`)
      // Will fall through to try x86 if the above doesn't exist
      if (!require('fs').existsSync(appPath)) {
        appPath = path.join(programFilesX86, `${appName}`, `${appName}.exe`)
      }
    } else {
      // Linux
      appPath = `/usr/bin/${appName}`
      if (!require('fs').existsSync(appPath)) {
        appPath = `/opt/${appName}/${appName}`
      }
    }
    if (appPath && require('fs').existsSync(appPath)) {
      return appPath
    }
  }
  return null
}

function launchDesktopApp(pageKey) {
  return new Promise((resolve, reject) => {
    const appPath = findDesktopApp()
    if (!appPath) {
      reject(new Error('未找到 Tools 桌面应用'))
      return
    }

    let cmd
    const isMac = process.platform === 'darwin'

    if (isMac && appPath.endsWith('.app')) {
      cmd = `open "${appPath}" --args --page=${pageKey}`
    } else {
      cmd = `"${appPath}" --page=${pageKey}`
    }

    exec(cmd, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

module.exports = (win, getClient) => {
  ipcMain.handle('shell-launch-tools-app', async (e, pageKey) => {
    assertTrustedAppSender(e, 'shell-launch-tools-app')

    if (!VALID_PAGE_KEYS.has(pageKey)) {
      throw new Error(`无效的 pageKey: ${pageKey}`)
    }

    // Web mode: open browser
    const url = pageKey ? `${TOOLS_WEB_URL}/#/${pageKey}` : `${TOOLS_WEB_URL}/`
    try {
      await shell.openExternal(url)
    } catch (err) {
      // Fallback to desktop mode
      await launchDesktopApp(pageKey)
    }
  })
}
