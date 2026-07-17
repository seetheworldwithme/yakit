function clearWindowRenderState(targetWindow, renderMap, messageQueue) {
  if (!targetWindow) return

  renderMap.delete(targetWindow.id)
  messageQueue.delete(targetWindow.id)
}

function closeWindow(targetWindow, removeCloseListeners) {
  if (!targetWindow || targetWindow.isDestroyed()) return

  if (removeCloseListeners) {
    targetWindow.removeAllListeners('close')
  }
  targetWindow.close()
}

module.exports = { clearWindowRenderState, closeWindow }
