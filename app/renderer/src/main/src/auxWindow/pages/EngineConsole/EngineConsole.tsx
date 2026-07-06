import React, { useRef } from 'react'
import SentinelTerminal, { type SentinelTerminalRef, useTerminalStream } from '@/auxWindow/components/SentinelTerminal'
import { setClipboardText } from '@/utils/clipboard'
import styles from '@/auxWindow/styles/terminalPage.module.scss'

interface EngineConsoleProps {
  windowId: string
}

const EngineConsole: React.FC<EngineConsoleProps> = ({ windowId }) => {
  const terminalRef = useRef<SentinelTerminalRef>(null)

  useTerminalStream(windowId, terminalRef)

  return (
    <div className={styles['aux-terminal-page']}>
      <SentinelTerminal
        ref={terminalRef}
        terminalOptions={{ convertEol: true }}
        onKeyEvent={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.code === 'KeyC') {
            const selection = terminalRef.current?.terminal.getSelection()
            if (selection) {
              setClipboardText(selection)
              return false
            }
          }
          return true
        }}
      />
    </div>
  )
}

export default EngineConsole
