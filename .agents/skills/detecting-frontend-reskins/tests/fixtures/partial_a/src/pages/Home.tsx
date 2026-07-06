import React from 'react'
import { Row, Col, Card } from 'antd'
export const Home: React.FC = () => (
  <div className="layout-shell">
    <aside className="side-rail">
      <ul className="side-menu">
        <li className="item-active">Overview</li>
        <li>Reports</li>
      </ul>
    </aside>
    <section className="content-area">
      <header className="content-header">
        <h1>Dashboard</h1>
      </header>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Revenue" />
        </Col>
        <Col span={12}>
          <Card title="Active Users" />
        </Col>
      </Row>
    </section>
  </div>
)
