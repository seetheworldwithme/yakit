# YakPoC Plugin List Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all filter and selection-summary controls from the YakPoC inline plugin group list, while aligning the list width with the scan target input.

**Architecture:** Keep the existing group data/query and card selection behavior intact. Remove only the filter JSX from `PluginGroupByKeyWord`; scope the width override to the YakPoC inline form node so shared plugin-list views are unchanged.

**Tech Stack:** React 18, TypeScript, antd 4 Form, yakitUI, Sass.

---

### Task 1: Remove the inline filter controls

**Files:**
- Modify: `app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.tsx:539-586`
- Modify: `app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.module.scss:131-164`

**Step 1: Add a focused structural regression check**

Run: `rg -n "header-search|filter-body|YakitInput.Search" app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.tsx`

Expected: existing filter JSX is found before the change.

**Step 2: Remove the filter JSX**

Delete the `filter-wrapper` JSX from `PluginGroupByKeyWord`; preserve the group-card list, selection handler, expansion handler, data query and empty state.

**Step 3: Remove presentation-only dead styles/imports**

Remove styles and imports that are used only by the deleted filter area. Retain data-query state because initial queries and task restoration still depend on it.

**Step 4: Verify the structural check**

Run: `rg -n "header-search|filter-body|YakitInput.Search" app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.tsx`

Expected: no matching filter JSX.

### Task 2: Align the inline list width and verify UI

**Files:**
- Modify: `app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.module.scss:268-285`

**Step 1: Make the inline node consume the form wrapper width**

Set `.inline-plugin-group` and its immediate plugin-list wrapper to `width: 100%`; retain its two-column grid and expanded-card full-row behavior.

**Step 2: Type-check**

Run: `yarn ci:tsc`

Expected: exit code 0.

**Step 3: Verify in the running Electron app**

Open 漏洞检测 and confirm the removed controls are absent, the group cards align with the scan target input, and selecting/expanding a card still works.

**Step 4: Commit only task files**

Run: `git add app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.tsx app/renderer/src/main/src/pages/securityTool/yakPoC/YakPoC.module.scss && git commit -m "refactor(ui): simplify YakPoC plugin group list"`
