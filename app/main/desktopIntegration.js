const { app } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

/**
 * Linux 桌面集成（AppImage 交付场景）
 *
 * GNOME dock/应用列表靠窗口 WM_CLASS（实测为 enpritrace，取自二进制名）关联
 * ~/.local/share/applications 下的 desktop 文件来显示图标；AppImage 未经注册时
 * dock 只能显示通用齿轮图标。这里在首次启动时自动注册 desktop 入口 + 图标。
 *
 * 关联三保险（命中优先级从高到低）：
 *   1. desktop 文件名 = WM_CLASS（enpritrace.desktop，shell 的 heuristic 直查）
 *   2. StartupWMClass=enpritrace
 *   3. X-GNOME-WMClass=enpritrace
 * Icon 用主题名，png 装入 ~/.local/share/icons/hicolor/512x512/apps/，
 * activities 搜索/收藏夹/dock 均走主题查找。
 *
 * 仅在打包后的 AppImage 环境执行（process.env.APPIMAGE 存在）；
 * 全流程容错，任何失败只打日志，不影响启动。
 */

/** desktop 文件 id（文件名去后缀），与窗口 WM_CLASS 一致，保证 shell 直查命中 */
const DESKTOP_ID = 'enpritrace'
/** 图标主题名（hicolor 下的 png 基名），对外不暴露 enpritrace 字样 */
const ICON_NAME = 'jingyunjia-webvulnscan'
/** 旧版注册过的 desktop id，改名后清理，避免应用列表出现重复条目 */
const LEGACY_DESKTOP_IDS = ['jingyunjia-webvulnscan']
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
    `Icon=${ICON_NAME}`,
    'Terminal=false',
    'Categories=Utility;',
    `StartupWMClass=${STARTUP_WM_CLASS}`,
    `X-GNOME-WMClass=${STARTUP_WM_CLASS}`,
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
    const iconFile = path.join(iconDir, `${ICON_NAME}.png`)
    const appsDir = path.join(home, '.local', 'share', 'applications')
    const desktopFile = path.join(appsDir, `${DESKTOP_ID}.desktop`)

    // 清理旧版本注册的 desktop 条目（id 改名遗留）
    for (const legacyId of LEGACY_DESKTOP_IDS) {
      const legacyFile = path.join(appsDir, `${legacyId}.desktop`)
      if (fs.existsSync(legacyFile)) {
        try {
          fs.unlinkSync(legacyFile)
        } catch (e) {
          console.log(`[desktop-integration] remove legacy ${legacyFile} failed: ${e?.message || e}`)
        }
      }
    }

    // 安装图标：取 AppImage 内置 512px 图标装入 hicolor
    const builtinIcon = path.join(process.env.APPDIR || '', builtinIconRelPath)
    let iconInstalled = fs.existsSync(iconFile)
    if (!iconInstalled && process.env.APPDIR && fs.existsSync(builtinIcon)) {
      fs.mkdirSync(iconDir, { recursive: true })
      iconInstalled = writeFileIfChanged(iconFile, fs.readFileSync(builtinIcon))
    }

    // 注册 desktop 入口
    fs.mkdirSync(appsDir, { recursive: true })
    const desktopChanged = writeFileIfChanged(desktopFile, Buffer.from(buildDesktopEntry(appImagePath)))
    if (desktopChanged || iconInstalled) {
      console.log(`[desktop-integration] registered ${desktopFile} icon=${ICON_NAME}`)
      // best-effort 刷新缓存；GNOME 对 applications 目录有 inotify 监听，失败无碍
      execFile('update-desktop-database', [appsDir], () => {})
    }
  } catch (e) {
    console.log(`[desktop-integration] register failed: ${e?.message || e}`)
  }
}

module.exports = { registerDesktopEntry }
