import React, { useRef } from 'react'
import SentinelTerminal, { type SentinelTerminalRef, useTerminalStream } from '@/auxWindow/components/SentinelTerminal'
import styles from '@/auxWindow/styles/terminalPage.module.scss'

interface AiChatLogProps {
  windowId: string
}

const AiChatLog: React.FC<AiChatLogProps> = ({ windowId }) => {
  const terminalRef = useRef<SentinelTerminalRef>(null)

  useTerminalStream(windowId, terminalRef)

  return (
    <div className={styles['aux-terminal-page']}>
      <SentinelTerminal ref={terminalRef} terminalOptions={{ convertEol: true, scrollback: 500 }} />
    </div>
  )
}

export default AiChatLog
