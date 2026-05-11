# Anti-Fraud Workbench (MVP)

Desktop anti-fraud analysis tool with 4 modules:

1. Data Cleaning
2. Fund Penetration
3. Gang Profiling
4. One-click Report

## Stack

- Desktop shell: Electron
- Frontend: React + Ant Design + ECharts
- Backend: Go (REST + SSE)
- DB: SQLite

## Quick Start

1. Start backend:

```bash
npm run dev:backend
```

2. Start desktop app and frontend:

```bash
npm run dev
```

App URL in dev is served by Vite and loaded in Electron.

## API

- `POST /clean/preview`
- `POST /clean/run`
- `GET /clean/stream/{taskID}`
- `GET /clean/result/{taskID}`
- `POST /penetration/run`
- `GET /penetration/graph/{taskID}`
- `POST /profile/run`
- `GET /profile/result/{taskID}`
- `POST /report/generate`

## Input Baseline

Sample tax files under `tax/`:

- `tax/专票购方.xlsx`
- `tax/专票销方.xlsx`
- `tax/普票购方.xlsx`
- `tax/纳税人信息.xlsx`
