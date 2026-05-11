# Penetration Drill-Down Interaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the penetration graph into a progressive drill-down view so users can follow one path at a time without losing context.

**Architecture:** Keep the backend penetration result unchanged and build the drill-down interaction entirely on the frontend. The page will derive a filtered subgraph from the full result based on the current breadcrumb path, then render only the path nodes, their direct next-hop nodes, and any backflow edges whose endpoints are already visible.

**Tech Stack:** React 18, Ant Design, ECharts custom series, node:test

---

### Interaction Design

1. Initial state

- After a penetration task finishes, only the root node and its first-layer direct downstream nodes are treated as expanded.
- The current focus node defaults to the root node.
- The graph keeps the root-to-right reading direction.

2. Progressive expansion

- Clicking a visible node sets it as the current focus node.
- If the clicked node is deeper than the current breadcrumb tail, the breadcrumb extends to that node.
- Clicking an ancestor in the breadcrumb truncates the breadcrumb back to that node.
- The visible graph is rebuilt from the breadcrumb, not from a global “expand all” state.

3. Visible content rules

- Always show breadcrumb path nodes.
- For every node in the breadcrumb, show its direct forward children.
- Only show backflow edges when both endpoints are already visible.
- Do not show unrelated branches outside the breadcrumb context.

4. Clarity aids

- Add a breadcrumb bar above the graph.
- Add a “重置到第一层” control.
- Add a current-focus detail panel with three sections:
  - 直接流入
  - 直接流出
  - 疑似回流/回环
- Make graph node clicks drive the breadcrumb and detail panel together.

### Task 1: Pure Drill-Down Derivation Helpers

**Files:**
- Create: `frontend/src/components/penetrationDrilldown.js`
- Create: `frontend/src/components/penetrationDrilldown.test.mjs`

**Step 1: Write the failing test**

Add tests for:
- default root path selection
- visible node/link filtering from a breadcrumb path
- path rebuilding when clicking a deeper node
- relation summary buckets for current focus node

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/penetrationDrilldown.test.mjs`

**Step 3: Write minimal implementation**

Implement helpers to:
- index graph nodes and links
- compute root ids
- compute a forward path from root to a clicked node
- build visible subgraph from a breadcrumb path
- summarize current node inbound/outbound/backflow relations

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/penetrationDrilldown.test.mjs`

### Task 2: Wire Drill-Down Into Penetration Page

**Files:**
- Modify: `frontend/src/pages/PenetrationPage.jsx`

**Step 1: Write the failing test**

Add or extend a pure helper test to assert:
- initial breadcrumb uses the root node
- clicking a node updates the derived path and visible graph
- resetting returns to first layer

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/penetrationDrilldown.test.mjs`

**Step 3: Write minimal implementation**

Update the page to:
- initialize breadcrumb path after penetration result arrives
- derive filtered graph and current-node relation buckets
- render breadcrumb, reset button, and detail cards
- pass node-click handler into `GraphView`

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/penetrationDrilldown.test.mjs`

### Task 3: Make Graph Nodes Clickable In Hierarchy Mode

**Files:**
- Modify: `frontend/src/components/GraphView.jsx`
- Modify: `frontend/src/components/graphHierarchyCustomSeries.js`
- Modify: `frontend/src/components/graphHierarchyCustomSeries.test.mjs`

**Step 1: Write the failing test**

Add tests for:
- hierarchy custom option preserving node item identity for click handling
- selected/focus node visual emphasis if implemented

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/graphHierarchyCustomSeries.test.mjs`

**Step 3: Write minimal implementation**

Expose enough custom-series metadata for click resolution and add `onNodeClick` support to `GraphView`.

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/graphHierarchyCustomSeries.test.mjs`

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run targeted tests**

Run:
- `node --test frontend/src/components/penetrationDrilldown.test.mjs`
- `node --test frontend/src/components/graphHierarchyCustomSeries.test.mjs frontend/src/components/graphHierarchySimplify.test.mjs frontend/src/components/graphOrthogonalOverlay.test.mjs`

**Step 2: Run frontend build**

Run: `npm run build:frontend`
