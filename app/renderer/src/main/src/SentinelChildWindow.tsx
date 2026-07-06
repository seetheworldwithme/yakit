import React, { useEffect, useMemo, useState } from 'react'
import OpenPacketNewWindow from './components/OpenPacketNewWindow/OpenPacketNewWindow'
import { useDebounceFn, useMemoizedFn } from 'ahooks'
import { coordinate } from './pages/globalVariable'
import TitleBar from './components/BaseTitleBar'
import { RightBugAuditResult, YakitRiskDetails } from './pages/risks/YakitRiskTable/YakitRiskTable'
import styles from './SentinelChildWindow.module.scss'

const { ipcRenderer } = window.require('electron')

interface ParentWindowData {
  type: string
  data: any
}
interface SentinelChildWindowProps {}
const SentinelChildWindow: React.FC<SentinelChildWindowProps> = () => {
  const [parentWinData, setParentWinData] = useState<ParentWindowData>()

  const pullParentData = useMemoizedFn(() => {
    ipcRenderer.send('request-parent-data')
  })

  useEffect(() => {
    pullParentData()
    const offParent = ipcRenderer.on('get-parent-window-data', (_e, data) => {
      setParentWinData(data as ParentWindowData)
    })
    return () => {
      setParentWinData(undefined)
      offParent()
    }
  }, [pullParentData])

  // 全局记录鼠标坐标位置（供右键菜单定位）
  const handleMouseMove = useDebounceFn(
    useMemoizedFn((e: MouseEvent) => {
      const { screenX, screenY, clientX, clientY, pageX, pageY } = e
      coordinate.screenX = screenX
      coordinate.screenY = screenY
      coordinate.clientX = clientX
      coordinate.clientY = clientY
      coordinate.pageX = pageX
      coordinate.pageY = pageY
    }),
    { wait: 50 },
  ).run
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [handleMouseMove])

  const body = useMemo(() => {
    if (!parentWinData) return null
    switch (parentWinData.type) {
      case 'openPacketNewWindow':
        return <OpenPacketNewWindow data={parentWinData.data} />
      case 'openRiskNewWindow':
        return (
          <YakitRiskDetails
            info={parentWinData.data}
            className={styles['sentinel-child-risk']}
            detailClassName={styles['sentinel-child-risk-details']}
            boxStyle={{ flex: 1 }}
          />
        )
      case 'openSSARiskNewWindow':
        return <RightBugAuditResult info={parentWinData.data} boxStyle={{ height: '100%' }} />
      default:
        return null
    }
  }, [parentWinData])

  return (
    <section className={styles['sentinel-child-root']}>
      <header className={styles['sentinel-child-titlebar']}>
        <TitleBar />
      </header>
      <main className={styles['sentinel-child-body']}>{body}</main>
    </section>
  )
}

export default SentinelChildWindow
