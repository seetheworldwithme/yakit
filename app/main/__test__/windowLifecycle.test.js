import { describe, expect, it, vi } from 'vitest'
import { clearWindowRenderState, closeWindow } from '../windowLifecycle'

describe('window lifecycle helpers', () => {
  it('ignores a startup window that has already been destroyed', () => {
    const renderMap = new Map([[1, true]])
    const messageQueue = new Map([[1, [{ channel: 'ready' }]]])

    expect(() => clearWindowRenderState(null, renderMap, messageQueue)).not.toThrow()
    expect(renderMap.has(1)).toBe(true)
    expect(messageQueue.has(1)).toBe(true)
  })

  it('removes the close interceptor before closing during app exit', () => {
    const removeAllListeners = vi.fn()
    const close = vi.fn()
    const targetWindow = {
      isDestroyed: () => false,
      removeAllListeners,
      close,
    }

    closeWindow(targetWindow, true)

    expect(removeAllListeners).toHaveBeenCalledWith('close')
    expect(close).toHaveBeenCalledOnce()
  })
})
