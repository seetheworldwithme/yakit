const { app } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

/**
 * Linux 桌面集成（AppImage 交付场景）
 *
 * GNOME dock/应用列表靠窗口 WM_CLASS（实测为 enpritrace，取自二进制名）反查
 * ~/.local/share/applications 下的 desktop 文件来显示图标；AppImage 未经注册时
 * dock 只能显示通用图标。这里在首次启动时自动注册 desktop 入口 + 图标，
 * Icon 用绝对路径（desktop spec 允许），不依赖 icon theme 查找。
 *
 * 仅在打包后的 AppImage 环境执行（process.env.APPIMAGE 存在）；
 * 全流程容错，任何失败只打日志，不影响启动。
 */

/** desktop 文件 id（文件名去后缀），同时作为图标基名 */
const DESKTOP_ID = 'jingyunjia-webvulnscan'
/** 与窗口实际 WM_CLASS 一致（electron-builder extraMetadata.name / 二进制名） */
const STARTUP_WM_CLASS = 'enpritrace'

/** AppImage 内置的 512px 应用图标（由 jingyunjia.icns 转换而来） */
const builtinIconRelPath = path.join('usr', 'share', 'icons', 'hicolor', '512x512', 'apps', 'enpritrace.png')

const buildDesktopEntry = (execPath) => {
  const lines = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${app.getName() === 'enpritrace' ? '靖云甲web应用漏洞扫描' : app.getName()}`,
    'Comment=靖云甲 Web 应用漏洞扫描系统',
    `Exec="${execPath}" %U`,
    'Terminal=false',
    'Categories=Utility;',
    `StartupWMClass=${STARTUP_WM_CLASS}`,
    `X-AppImage-Version=${app.getVersion()}`,
  ]
  return lines.join('\n') + '\n'
}

/** 内容有变化才写盘，避免每次启动都触发桌面环境重扫 */
const writeFileIfChanged = (file, data) => {
  try {
    if (fs.existsSync(file)) {
      const old = fs.readFileSync(file)
      if (old.equals(Buffer.from(data))) return false
    }
    fs.writeFileSync(file, data)
    return true
  } catch (e) {
    console.log(`[desktop-integration] write ${file} failed: ${e?.message || e}`)
    return false
  }
}

const registerDesktopEntry = () => {
  if (process.platform !== 'linux' || !app.isPackaged) return
  const appImagePath = process.env.APPIMAGE
  if (!appImagePath) return // 非 AppImage 运行（开发模式 / 未来 deb 安装）不注册

  try {
    const home = os.homedir()
    const iconDir = path.join(home, '.local', 'share', 'icons', 'hicolor', '512x512', 'apps')
    const iconFile = path.join(iconDir, `${DESKTOP_ID}.png`)
    const appsDir = path.join(home, '.local', 'share', 'applications')
    const desktopFile = path.join(appsDir, `${DESKTOP_ID}.desktop`)

    // 安装图标：优先取 AppImage 内置 512px 图标
    const builtinIcon = path.join(process.env.APPDIR || '', builtinIconRelPath)
    let iconInstalled = fs.existsSync(iconFile)
    if (!iconInstalled && process.env.APPDIR && fs.existsSync(builtinIcon)) {
      fs.mkdirSync(iconDir, { recursive: true })
      iconInstalled = writeFileIfChanged(iconFile, fs.readFileSync(builtinIcon))
    }

    // 注册 desktop 入口；Icon 用绝对路径，图标缺失时仍注册（名称可被后续图标解析）
    fs.mkdirSync(appsDir, { recursive: true })
    const desktopChanged = writeFileIfChanged(desktopFile, Buffer.from(buildDesktopEntry(appImagePath)))
    if (desktopChanged || iconInstalled) {
      console.log(`[desktop-integration] registered ${desktopFile}`)
      // best-effort 刷新缓存；GNOME 对 applications 目录有 inotify 监听，失败无碍
      execFile('update-desktop-database', [appsDir], () => {})
    }
  } catch (e) {
    console.log(`[desktop-integration] register failed: ${e?.message || e}`)
  }
}

module.exports = { registerDesktopEntry }
