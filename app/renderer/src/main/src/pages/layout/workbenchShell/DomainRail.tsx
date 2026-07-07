import React from 'react'
import { YakitRoute } from '@/enums/yakitRoute'
import { WorkbenchDomain, moduleIcon } from './domainMap'
import './DomainRail.scss'

export interface DomainRailProps {
  domain: WorkbenchDomain
  onOpenRoute: (route: YakitRoute) => void
}

export const DomainRail: React.FC<DomainRailProps> = React.memo((props) => {
  const { domain, onOpenRoute } = props
  return (
    <nav className="wb-rail">
      <div className="wb-rail-head">
        <span className="wb-rail-head-icon">{domain.icon}</span>
        <span className="wb-rail-head-label">{domain.label}</span>
      </div>
      <ul className="wb-rail-list">
        {domain.modules.map((m) => (
          <li key={m.route} className="wb-rail-item" onClick={() => onOpenRoute(m.route)}>
            <span className="wb-rail-item-icon">{moduleIcon(m.route)}</span>
            <span className="wb-rail-item-label">{m.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  )
})
