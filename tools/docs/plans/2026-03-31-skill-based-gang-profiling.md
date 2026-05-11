# Skill-Based Gang Profiling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework gang profiling so gang membership is derived from device and taxpayer-person evidence from raw tax data, while transaction edges remain a visualization and amount-statistics layer.

**Architecture:** Extract invoice device fingerprints and taxpayer registration identities from `raw_invoice` and `raw_taxpayer`, normalize them into reusable evidence keys, then cluster companies via shared evidence using Union-Find. Build the profile result from those evidence-based gangs and annotate the existing transaction graph with the resulting gang IDs for display, ranking, and reporting.

**Tech Stack:** Go, SQLite, React, Ant Design, ECharts

---

### Task 1: Lock Behavior With Backend Tests

**Files:**
- Modify: `backend/internal/service/profile_service_test.go`

**Step 1: Write the failing test**

Add tests covering:
- companies sharing invoice device evidence are grouped into one gang
- companies sharing taxpayer personnel evidence are grouped into one gang
- gangs are not created only because unrelated companies transact on the same graph

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./internal/service -run TestRun_ -count=1`

Expected: FAIL because current implementation derives gangs from transaction connected components only.

**Step 3: Write minimal implementation**

Implement evidence extraction and gang clustering in `ProfileService`.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./internal/service -run TestRun_ -count=1`

Expected: PASS

### Task 2: Implement Evidence Extraction

**Files:**
- Modify: `backend/internal/service/profile_service.go`

**Step 1: Add helpers to read raw JSON payloads**

Parse device fields from `raw_invoice.payload_json` and taxpayer personnel/phone fields from `raw_taxpayer.payload_json`.

**Step 2: Normalize evidence keys**

Create normalized keys for:
- invoice device: IP / MAC / motherboard serial
- legal representative
- finance owner
- tax handler
- phone numbers

**Step 3: Cluster companies**

Union companies that share any evidence key, track evidence types per gang, and generate evidence summaries for UI/report use.

**Step 4: Keep transaction graph as presentation layer**

Assign `gangId` to transaction graph nodes and links only after evidence-based gangs are built.

### Task 3: Update Result Model And Reporting

**Files:**
- Modify: `backend/internal/model/types.go`
- Modify: `backend/internal/service/report_service.go`

**Step 1: Extend gang output**

Add fields for evidence summary and evidence counts.

**Step 2: Update report copy**

Describe gangs as identified by shared device/person evidence, not only by transaction graph topology.

### Task 4: Update Frontend Presentation

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/components/GraphView.jsx`

**Step 1: Update page description**

Explain that gangs are identified from shared equipment and tax-registration personnel evidence.

**Step 2: Show evidence summaries**

Expose evidence tags or text in gang overview and node tooltips.

**Step 3: Preserve graph filtering**

Continue filtering transaction graph by the evidence-based `gangId`.

### Task 5: Verification

**Files:**
- No code changes required unless failures appear

**Step 1: Run service tests**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./internal/service -count=1`

**Step 2: Run broader backend tests if needed**

Run: `GOCACHE=/tmp/go-build GOTOOLCHAIN=go1.24.4 go test ./... -count=1`

**Step 3: Document residual limitations**

Call out that the skill also mentions工商关联等更深层能力; those remain future work unless their source data is ingested.
