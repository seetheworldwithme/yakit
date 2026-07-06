import React from 'react'
import { Row, Col, Card } from 'antd'
import { useStore } from '../store/useStore'

export const Home: React.FC = () => {
  const user = useStore((s) => s.user)
  return (
    <div className="home-wrapper">
      <header className="home-header">
        <h1>{heading}</h1>
        <nav className="home-nav">
          <a href="/dashboard">Dashboard</a>
          <a href="/settings">Settings</a>
        </nav>
      </header>
      <main className="home-main">
        <Row gutter={16}>
          <Col span={8}>
            <Card title="Panel A" />
          </Col>
          <Col span={8}>
            <Card title="Panel B" />
          </Col>
          <Col span={8}>
            <Card title="Panel C" />
          </Col>
        </Row>
      </main>
      <footer className="home-footer">© Demo 2026</footer>
    </div>
  )
}
