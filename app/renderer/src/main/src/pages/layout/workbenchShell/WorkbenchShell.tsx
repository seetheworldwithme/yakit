import React, { useMemo, useState } from 'react'
import { YakitRoute } from '@/enums/yakitRoute'
import { DomainKey, WORKBENCH_DOMAINS } from './domainMap'
import { DomainTopBar } from './DomainTopBar'
import { DomainRail } from './DomainRail'
import { StatusBar } from './StatusBar'
import './WorkbenchShell.scss'

export interface WorkbenchShellProps {
  onOpenRoute: (route: YakitRoute) => void
  style?: React.CSSProperties
  children: React.ReactNode
}

// 深蓝工作台外壳：顶栏(5 域) + 左 rail(域内模块) + 中央工作区 + 状态栏
export const WorkbenchShell: React.FC<WorkbenchShellProps> = React.memo((props) => {
  const { onOpenRoute, style, children } = props
  const [activeDomain, setActiveDomain] = useState<DomainKey>('strike')
  const domain = useMemo(
    () => WORKBENCH_DOMAINS.find((d) => d.key === activeDomain) || WORKBENCH_DOMAINS[0],
    [activeDomain],
  )

  return (
    <section className="wb-shell" style={style}>
      <DomainTopBar domains={WORKBENCH_DOMAINS} active={activeDomain} onSelect={setActiveDomain} />
      <div className="wb-body">
        <DomainRail domain={domain} onOpenRoute={onOpenRoute} />
        <main className="wb-workspace">{children}</main>
      </div>
      <StatusBar />
    </section>
  )
})
