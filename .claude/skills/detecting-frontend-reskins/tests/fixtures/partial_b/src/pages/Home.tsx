import React from 'react'
import { Tabs, Card } from 'antd'
export const Home: React.FC = () => (
  <div className="frame-canvas">
    <nav className="tab-bar">
      <Tabs defaultActiveKey="overview">
        <Tabs.TabPane key="overview" tab="Overview" />
        <Tabs.TabPane key="reports" tab="Reports" />
      </Tabs>
    </nav>
    <main className="panel-stage">
      <header className="stage-title">
        <h1>Console</h1>
      </header>
      <Card title="Active Users" />
      <Card title="Revenue" />
    </main>
  </div>
)
