import { type RefObject, useEffect } from 'react'
import { yakitAuxWindow } from '@/services/electronBridge'
import { AUX_XTERM_THEME_SYNC } from '@/auxWindow/utils/applyAuxThemeColors'
import { getTerminalTheme } from './terminalTheme'
import type { SentinelTerminalRef } from './SentinelTerminal'

export type TerminalStreamPayload = {
  type?: string
  data?: unknown
}

/** 把终端应用到最新本地主题（由 applyAuxThemeColors 触发的同步事件） */
const refreshTheme = (ref: RefObject<SentinelTerminalRef | null>) => {
  const terminal = ref.current?.terminal
  if (terminal) terminal.options.theme = getTerminalTheme()
}

/** 处理一条来自主窗的推送消息 */
type PayloadApplier = (payload: TerminalStreamPayload, ref: RefObject<SentinelTerminalRef | null>) => void

const PAYLOAD_HANDLERS: Record<string, PayloadApplier> = {
  // IPC 协议字段值保持不变；仅本地派发结构重组
  'xterm-data': (payload, ref) => {
    if (typeof payload.data === 'string') ref.current?.terminal.write(payload.data)
  },
  'ai-chat-log-data': (payload, ref) => {
    if (typeof payload.data === 'string') ref.current?.terminal.write(payload.data)
  },
  'ai-chat-log-clear': (_payload, ref) => ref.current?.terminal.clear(),
}

const dispatchPayload = (payload: TerminalStreamPayload, ref: RefObject<SentinelTerminalRef | null>) => {
  const handle = payload.type ? PAYLOAD_HANDLERS[payload.type] : undefined
  if (handle) handle(payload, ref)
}

export const useTerminalStream = (windowId: string, terminalRef: RefObject<SentinelTerminalRef | null>) => {
  useEffect(() => {
    if (!windowId) return

    const onThemeSync = () => refreshTheme(terminalRef)

    let announced = false
    // 终端实例就绪前主动告知主窗「可推送」，用递归 setTimeout 节流探测直到成功
    const announceReady = () => {
      if (announced || !terminalRef.current?.terminal) return
      announced = true
      yakitAuxWindow.ready(windowId)
    }
    let timer: number | undefined
    const scheduleAnnounce = () => {
      announceReady()
      if (announced) return
      timer = window.setTimeout(scheduleAnnounce, 50)
    }

    const offPush = yakitAuxWindow.onPush((msg) => {
      if (msg.windowId !== windowId) return
      dispatchPayload((msg.payload || {}) as TerminalStreamPayload, terminalRef)
    })

    const offInit = yakitAuxWindow.onInit((msg) => {
      if (msg.windowId !== windowId) return
      refreshTheme(terminalRef)
    })

    window.addEventListener(AUX_XTERM_THEME_SYNC, onThemeSync)
    scheduleAnnounce()

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      offPush()
      offInit()
      window.removeEventListener(AUX_XTERM_THEME_SYNC, onThemeSync)
    }
  }, [windowId, terminalRef])
}
