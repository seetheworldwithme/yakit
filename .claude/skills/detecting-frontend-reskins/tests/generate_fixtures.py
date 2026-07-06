#!/usr/bin/env python3
"""Materialize minimal, deterministic fixture projects for test_reskin_audit.

Three pairs, each calibrated to land in a different independence tier:
  identical_*    -> near-identical (only surface text differs) + identity override
  partial_*      -> same skeleton, partial layout/visual divergence (40-69 band)
  independent_*  -> different stacks/dirs/palette (>=70 band)

Re-run after editing to refresh fixtures:
    python3 tests/generate_fixtures.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "fixtures"


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def write_json(path: Path, obj: dict) -> None:
    write(path, json.dumps(obj, indent=2, ensure_ascii=False))


# --------------------------------------------------------------------------- #
# 1. IDENTICAL pair (target: <=39 + identity override)
# --------------------------------------------------------------------------- #

IDENTICAL_PKG = {
    "name": "demo-portal",
    "version": "1.4.7-0626",
    "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "antd": "^4.21.7",
        "zustand": "^4.3.1",
        "axios": "^0.26.1",
    },
}


def identical_home(heading: str) -> str:
    return f"""
import React from 'react'
import {{ Row, Col, Card }} from 'antd'
import {{ useStore }} from '../store/useStore'

export const Home: React.FC = () => {{
  const user = useStore((s) => s.user)
  return (
    <div className="home-wrapper">
      <header className="home-header">
        <h1>{{heading}}</h1>
        <nav className="home-nav">
          <a href="/dashboard">Dashboard</a>
          <a href="/settings">Settings</a>
        </nav>
      </header>
      <main className="home-main">
        <Row gutter={{16}}>
          <Col span={{8}}><Card title="Panel A" /></Col>
          <Col span={{8}}><Card title="Panel B" /></Col>
          <Col span={{8}}><Card title="Panel C" /></Col>
        </Row>
      </main>
      <footer className="home-footer">© Demo 2026</footer>
    </div>
  )
}}
"""


IDENTICAL_THEME = """
:root {
  --App-Color-Primary: #1890ff;
  --App-Color-Bg: #ffffff;
  --App-Spacing-Base: 8px;
}
.home-wrapper { padding: 16px; background: var(--App-Color-Bg); }
.home-header { display: flex; justify-content: space-between; }
.home-nav a { margin-right: 12px; color: var(--App-Color-Primary); }
.home-footer { margin-top: 24px; font-size: 12px; }
@media (max-width: 768px) { .home-nav { display: none; } }
"""


def build_identical(suffix: str, heading: str) -> None:
    base = ROOT / f"identical_{suffix}"
    write_json(base / "package.json", IDENTICAL_PKG)
    write(base / "tsconfig.json", '{"compilerOptions": {"strict": true, "jsx": "react-jsx"}}')
    write(base / "src/main.tsx", "import React from 'react'\nimport { Home } from './pages/Home'\nReact.render(<Home />, document.getElementById('root'))\n")
    write(base / "src/pages/Home.tsx", identical_home(heading))
    write(base / "src/store/useStore.ts", "import { create } from 'zustand'\nexport const useStore = create(() => ({ user: null }))\n")
    write(base / "src/styles/theme.scss", IDENTICAL_THEME)


# --------------------------------------------------------------------------- #
# 2. PARTIAL pair (target: 40-69; same skeleton, diverged layout/visual)
# --------------------------------------------------------------------------- #

PARTIAL_PKG_A = {
    "name": "partial-app-a",
    "version": "2.1.0",
    "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0", "antd": "^4.21.7", "zustand": "^4.3.1", "axios": "^0.26.1"},
}
PARTIAL_PKG_B = {
    "name": "partial-app-b",  # different name -> no identity override
    "version": "2.1.0",
    "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0", "antd": "^4.21.7", "zustand": "^4.3.1", "axios": "^0.26.1"},
}


PARTIAL_HOME_A = """
import React from 'react'
import { Row, Col, Card } from 'antd'
export const Home: React.FC = () => (
  <div className="layout-shell">
    <aside className="side-rail">
      <ul className="side-menu"><li className="item-active">Overview</li><li>Reports</li></ul>
    </aside>
    <section className="content-area">
      <header className="content-header"><h1>Dashboard</h1></header>
      <Row gutter={16}>
        <Col span={12}><Card title="Revenue" /></Col>
        <Col span={12}><Card title="Active Users" /></Col>
      </Row>
    </section>
  </div>
)
"""

# partial_b: rearranged JSX (Tab bar instead of side rail), renamed classes, different panel order
PARTIAL_HOME_B = """
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
      <header className="stage-title"><h1>Console</h1></header>
      <Card title="Active Users" />
      <Card title="Revenue" />
    </main>
  </div>
)
"""

PARTIAL_THEME_A = """
:root {
  --App-Color-Primary: #1890ff;
  --App-Color-Bg: #ffffff;
  --App-Spacing-Base: 8px;
}
.layout-shell { display: flex; padding: 16px; background: var(--App-Color-Bg); }
.side-rail { width: 200px; }
.side-menu .item-active { color: var(--App-Color-Primary); }
.content-header h1 { font-size: 20px; }
@media (max-width: 768px) { .layout-shell { flex-direction: column; } }
"""

# partial_b theme: same scale, different primary color + renamed tokens (keeps typography/spacing overlap, drops color/token-name overlap)
PARTIAL_THEME_B = """
:root {
  --Brand-Tone-Accent: #722ed1;
  --Brand-Tone-Surface: #fafafa;
  --Brand-Spacing-Base: 8px;
}
.frame-canvas { display: flex; flex-direction: column; padding: 16px; background: var(--Brand-Tone-Surface); }
.tab-bar { border-bottom: 1px solid #e8e8e8; }
.stage-title h1 { font-size: 20px; }
@media (min-width: 992px) { .frame-canvas { padding: 24px; } }
"""

PARTIAL_BTN_A = """
import React from 'react'
export const ActionButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button className="action-btn" onClick={onClick}>{label}</button>
)
"""

# partial_b button: different prop shape + internal structure -> different fingerprint
PARTIAL_BTN_B = """
import React from 'react'
interface Props { text: string; onActivate: () => void }
export const FlatButton: React.FC<Props> = (props) => {
  const { text, onActivate } = props
  return <span className="flat-cta" role="button" tabIndex={0} onClick={onActivate}>{text}</span>
}
"""

PARTIAL_API_A = "import axios from 'axios'\nexport const fetchRevenue = () => axios.get('/api/v1/revenue/summary')\nexport const fetchUsers = () => axios.get('/api/v1/users/active')\n"
PARTIAL_API_B = "import axios from 'axios'\nexport const loadRevenueReport = () => axios.get('/api/v2/report/revenue')\nexport const loadActiveAccounts = () => axios.get('/api/v2/report/accounts')\n"


def build_partial(suffix: str, pkg, home, theme, btn, api) -> None:
    base = ROOT / f"partial_{suffix}"
    write_json(base / "package.json", pkg)
    write(base / "tsconfig.json", '{"compilerOptions": {"strict": true, "jsx": "react-jsx"}}')
    write(base / "src/main.tsx", "import React from 'react'\nimport { Home } from './pages/Home'\nReact.render(<Home />, document.getElementById('root'))\n")
    write(base / "src/pages/Home.tsx", home)
    write(base / "src/components/Button.tsx", btn)
    write(base / "src/services/api.ts", api)
    write(base / "src/store/useStore.ts", "import { create } from 'zustand'\nexport const useStore = create(() => ({ session: null }))\n")
    write(base / "src/styles/theme.scss", theme)


# --------------------------------------------------------------------------- #
# 3. INDEPENDENT pair (target: >=70; different stacks/dirs/palette)
# --------------------------------------------------------------------------- #

INDEPENDENT_PKG_A = {
    "name": "nova-portal",
    "version": "3.0.0",
    "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0", "vite": "^5.0.0", "zustand": "^4.3.1", "ky": "^1.2.0"},
}
INDEPENDENT_PKG_B = {
    "name": "apollo-console",
    "version": "0.9.0",
    "dependencies": {"vue": "^3.4.0", "pinia": "^2.1.0", "nuxt": "^3.8.0"},
}

# CAPPED pair: different stacks (raw score high), but same package name + major
# version -> identity override must clamp total to <=39. Tests the cap mechanic.
CAPPED_PKG_A = {
    "name": "shared-product",
    "version": "2.0.0",
    "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0", "vite": "^5.0.0", "zustand": "^4.3.1", "ky": "^1.2.0"},
}
CAPPED_PKG_B = {
    "name": "shared-product",  # same name + major(2) as A -> override fires
    "version": "2.5.0",
    "dependencies": {"vue": "^3.4.0", "pinia": "^2.1.0", "nuxt": "^3.8.0"},
}

INDEPENDENT_A_HOME = """
import React from 'react'
import { usePortalStore } from '../state/portalStore'
export const Dashboard: React.FC = () => {
  const metrics = usePortalStore((s) => s.metrics)
  return (
    <section className="nova-grid">
      <article className="nova-card"><h2>Telemetry</h2><p>{metrics.latency}ms</p></article>
      <article className="nova-card"><h2>Throughput</h2><p>{metrics.rps} rps</p></article>
    </section>
  )
}
"""

INDEPENDENT_A_THEME = """
:root {
  --Nova-Bg-Deep: #0A1929;
  --Nova-Accent-Cyan: #0EA5E9;
  --Nova-Grid-Gap: 12px;
}
.nova-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--Nova-Grid-Gap); background: var(--Nova-Bg-Deep); }
.nova-card { color: var(--Nova-Accent-Cyan); font-family: 'Inter', sans-serif; }
@media (min-width: 1280px) { .nova-grid { grid-template-columns: repeat(3, 1fr); } }
"""

INDEPENDENT_B_HOME = """
<template>
  <div class="apollo-stack">
    <section class="apollo-block" v-for="item in items" :key="item.id">
      <h3>{{ item.label }}</h3>
      <span class="apollo-value">{{ item.value }}</span>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useConsoleStore } from '../stores/console'
const store = useConsoleStore()
const items = ref(store.summary)
</script>
"""

INDEPENDENT_B_THEME = """
:root {
  --Apollo-Surface-Main: #F7F9FC;
  --Apollo-Brand-Emerald: #16A34A;
  --Apollo-Stack-Space: 16px;
}
.apollo-stack { display: flex; flex-direction: column; gap: var(--Apollo-Stack-Space); background: var(--Apollo-Surface-Main); }
.apollo-block { border-left: 3px solid var(--Apollo-Brand-Emerald); font-family: 'Source Han Sans', sans-serif; }
@media (max-width: 600px) { .apollo-stack { gap: 8px; } }
"""


def build_independent_a() -> None:
    base = ROOT / "independent_a"
    write_json(base / "package.json", INDEPENDENT_PKG_A)
    write(base / "vite.config.ts", "export default { root: 'src' }")
    write(base / "src/main.tsx", "import React from 'react'\nimport { Dashboard } from './views/Dashboard'\nReact.render(<Dashboard />, document.getElementById('root'))\n")
    write(base / "src/views/Dashboard.tsx", INDEPENDENT_A_HOME)
    write(base / "src/ui/Card.tsx", "import React from 'react'\nexport const Tile: React.FC = ({ children }) => <div className=\"nova-card\">{children}</div>\n")
    write(base / "src/state/portalStore.ts", "import { create } from 'zustand'\nexport const usePortalStore = create(() => ({ metrics: { latency: 12, rps: 900 } }))\n")
    write(base / "src/styles/theme.scss", INDEPENDENT_A_THEME)


def build_independent_b() -> None:
    base = ROOT / "independent_b"
    write_json(base / "package.json", INDEPENDENT_PKG_B)
    write(base / "nuxt.config.ts", "export default defineNuxtConfig({ ssr: true })")
    write(base / "src/pages/Overview.vue", INDEPENDENT_B_HOME)
    write(base / "src/components/Panel.vue", "<template><div class=\"apollo-block\"><slot /></div></template>\n")
    write(base / "src/stores/console.ts", "import { defineStore } from 'pinia'\nexport const useConsoleStore = defineStore('console', () => ({ summary: [] }))\n")
    write(base / "src/styles/theme.scss", INDEPENDENT_B_THEME)


# --------------------------------------------------------------------------- #
# 4. CAPPED pair (different stacks -> raw high, but same name+major -> cap<=39)
# --------------------------------------------------------------------------- #

def build_capped_a() -> None:
    base = ROOT / "capped_a"
    write_json(base / "package.json", CAPPED_PKG_A)
    write(base / "vite.config.ts", "export default { root: 'src' }")
    write(base / "src/main.tsx", "import React from 'react'\nimport { Dashboard } from './views/Dashboard'\nReact.render(<Dashboard />, document.getElementById('root'))\n")
    write(base / "src/views/Dashboard.tsx", INDEPENDENT_A_HOME)
    write(base / "src/ui/Card.tsx", "import React from 'react'\nexport const Tile: React.FC = ({ children }) => <div className=\"nova-card\">{children}</div>\n")
    write(base / "src/state/portalStore.ts", "import { create } from 'zustand'\nexport const usePortalStore = create(() => ({ metrics: { latency: 12, rps: 900 } }))\n")
    write(base / "src/styles/theme.scss", INDEPENDENT_A_THEME)


def build_capped_b() -> None:
    base = ROOT / "capped_b"
    write_json(base / "package.json", CAPPED_PKG_B)
    write(base / "nuxt.config.ts", "export default defineNuxtConfig({ ssr: true })")
    write(base / "src/pages/Overview.vue", INDEPENDENT_B_HOME)
    write(base / "src/components/Panel.vue", "<template><div class=\"apollo-block\"><slot /></div></template>\n")
    write(base / "src/stores/console.ts", "import { defineStore } from 'pinia'\nexport const useConsoleStore = defineStore('console', () => ({ summary: [] }))\n")
    write(base / "src/styles/theme.scss", INDEPENDENT_B_THEME)


def main() -> None:
    build_identical("a", "Welcome to Demo Portal")
    build_identical("b", "Welcome to Demo Portal")  # truly identical content; override via same name+major
    build_partial("a", PARTIAL_PKG_A, PARTIAL_HOME_A, PARTIAL_THEME_A, PARTIAL_BTN_A, PARTIAL_API_A)
    build_partial("b", PARTIAL_PKG_B, PARTIAL_HOME_B, PARTIAL_THEME_B, PARTIAL_BTN_B, PARTIAL_API_B)
    build_independent_a()
    build_independent_b()
    build_capped_a()
    build_capped_b()
    print(f"fixtures materialized under {ROOT}")


if __name__ == "__main__":
    main()
