import React from 'react'
import { SettingOutlined } from '@ant-design/icons'
import { DomainKey, WorkbenchDomain } from './domainMap'
import './DomainTopBar.scss'

export interface DomainTopBarProps {
  domains: WorkbenchDomain[]
  active: DomainKey
  onSelect: (key: DomainKey) => void
}

export const DomainTopBar: React.FC<DomainTopBarProps> = React.memo((props) => {
  const { domains, active, onSelect } = props
  return (
    <header className="wb-topbar">
      <div className="wb-domains">
        {domains.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`wb-domain-tab${d.key === active ? ' wb-domain-tab-active' : ''}`}
            onClick={() => onSelect(d.key)}
          >
            <span className="wb-domain-icon">{d.icon}</span>
            <span className="wb-domain-label">{d.label}</span>
          </button>
        ))}
      </div>
      <div className="wb-topbar-right">
        <span className="wb-conn-dot" />
        <span className="wb-conn-text">已连接</span>
        <span className="wb-icon-btn">
          <SettingOutlined />
        </span>
      </div>
    </header>
  )
})
