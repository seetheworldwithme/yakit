/**
 * 启动窗口展示策略。
 *
 * 所有变体均需在引擎连接成功前保留启动页，以便展示端口冲突、数据库修复、
 * 杀毒软件拦截等可恢复错误；连接成功后由 engineLinkWin-done 统一关闭启动页。
 */
'use strict'

/**
 * 启动阶段不能跳过启动窗口。
 * @param {{ isPackaged: boolean, appName: string }} opts
 * @returns {boolean}
 */
function shouldSkipStartupWindow() {
  return false
}

module.exports = {
  shouldSkipStartupWindow,
}
