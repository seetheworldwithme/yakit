/**
 * 启动窗口展示策略
 * 企业版（EnpriTrace / IRifyEnpriTrace / EnpriTraceAgent / Memfit）跳过启动页，
 * 避免等待渲染进程挂载后再隐藏造成双窗口闪现。
 */
'use strict'

// 匹配需要跳过启动页的应用名（企业版变体）
const SKIP_STARTUP_APP_NAMES = ['EnpriTrace', 'IRifyEnpriTrace', 'EnpriTraceAgent', 'Memfit AI']

/**
 * 根据打包状态与应用名判断是否跳过启动窗口
 * @param {{ isPackaged: boolean, appName: string }} opts
 * @returns {boolean}
 */
function shouldSkipStartupWindow({ isPackaged, appName }) {
  if (!isPackaged) {
    return false
  }
  if (!appName || typeof appName !== 'string') {
    return false
  }
  return SKIP_STARTUP_APP_NAMES.some((name) => appName.includes(name))
}

module.exports = {
  shouldSkipStartupWindow,
}
