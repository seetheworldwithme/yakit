# Fund Dataset Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the existing four modules (`数据清洗`, `资金穿透`, `团伙画像`, `一键报告`) support the four `fund/` xlsx files in addition to the current tax files.

**Architecture:** Extend file-type detection and normalization so both tax and fund datasets are converted into the same `clean_txn` and `entity` analysis backbone. Keep penetration/profile/report services shared, but broaden evidence extraction, candidate lookup, and UI copy so they work for tax and fund sources without requiring a separate module set.

**Tech Stack:** Go, SQLite, React, Ant Design, ECharts

---

### Task 1: Lock Fund Cleaning Behavior With Tests

**Files:**
- Modify: `backend/internal/service/clean_service_test.go` or create if absent
- Modify: `backend/internal/service/penetration_service_test.go`
- Modify: `backend/internal/service/profile_service_test.go`

**Step 1: Write the failing tests**

Cover:
- fund transaction detail rows normalize into `clean_txn`
- fund personnel/account/subaccount files are accepted by preview/cleaning
- penetration candidate lookup works for fund entities and transaction identifiers
- profile evidence extraction supports fund IP/MAC and personnel fields

**Step 2: Run tests to verify they fail**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./internal/service -count=1`

Expected: FAIL because current logic is tax-specific.

**Step 3: Implement minimal code**

Change cleaning/detection/lookup/profile logic only enough to satisfy these tests.

**Step 4: Run tests to verify they pass**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./internal/service -count=1`

Expected: PASS

### Task 2: Generalize File Detection And Cleaning

**Files:**
- Modify: `backend/internal/service/clean_service.go`

**Step 1: Detect file kind by headers, not only by filename**

Support at least:
- tax invoice
- tax taxpayer
- fund transaction
- fund personnel
- fund account
- fund subaccount

**Step 2: Normalize fund transaction rows**

Map fund transaction columns into:
- payer/payee names and IDs
- amount
- time
- bill/serial number
- optional goods/remark

**Step 3: Persist auxiliary raw rows**

Store fund personnel/account/subaccount raw rows so later modules can read them.

### Task 3: Make Penetration Generic For Tax And Fund

**Files:**
- Modify: `backend/internal/service/penetration_service.go`
- Modify: `frontend/src/pages/PenetrationPage.jsx`

**Step 1: Candidate lookup**

Lookup entity candidates from `entity` / `clean_txn`, not only `raw_taxpayer`.

**Step 2: Identifier lookup**

Support invoice/bill/serial identifiers from both tax and fund normalized data.

**Step 3: Update UI text**

Use generic wording like “主体” and “票据/流水号”.

### Task 4: Extend Gang Profiling To Fund Evidence

**Files:**
- Modify: `backend/internal/service/profile_service.go`
- Modify: `frontend/src/pages/ProfilePage.jsx`

**Step 1: Add fund evidence extraction**

From fund transaction detail:
- IP地址
- MAC地址
- 交易户名 / 交易账号 / 交易卡号

From fund personnel info:
- 客户名称 / 证照号码
- 代办人姓名 / 代办人证件号码
- 法人代表
- 单位电话

**Step 2: Reuse existing evidence-based gang grouping**

Use shared device/person evidence for both tax and fund datasets.

**Step 3: Update UI description**

Describe support for both tax and fund evidence sources.

### Task 5: Update Cleaning And Report UX

**Files:**
- Modify: `frontend/src/pages/CleanPage.jsx`
- Modify: `frontend/src/pages/HomePage.jsx`
- Modify: `frontend/src/pages/ReportPage.jsx`

**Step 1: Update hints**

Show both tax and fund sample file families.

**Step 2: Keep report generic**

Avoid tax-only wording so the same report works for fund cases.

### Task 6: Verification

**Files:**
- No code changes unless failures appear

**Step 1: Run backend tests**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./... -count=1`

**Step 2: Run frontend build**

Run: `npm run build:frontend`

**Step 3: Summarize residual limitations**

Document any fund-skill indicators that still are not modeled.
