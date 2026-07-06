---
name: yakit-horizontal-subnav
description: Use when modifying the Yakit frontend to move page-internal left vertical sub-navigation, side rail buttons, left tabs, or stacked tool buttons into a horizontal row below workspace tabs, especially in History, Web Fuzzer, MITM, and similar workbench pages.
---

# Yakit Horizontal Subnav

## Overview

Use this for Yakit/Sentinel layout tweaks where a page has a narrow left column of feature buttons and the target layout places those buttons in one horizontal row below the main workspace tabs. Preserve behavior; only move presentation and the related content region.

## Core Rule

Treat the old left column as a page-level sub-navigation, not as a global sidebar. Move the navigation controls and their controlled panel together:

- The nav row belongs directly under the page/workspace tab bar.
- The selected nav panel belongs below that row.
- The primary work area should remain below or beside the selected panel according to the existing page behavior.
- Do not change colors, state names, route names, IPC calls, request logic, or plugin execution logic.

## Locate The Pattern

Search for visible labels and layout clues:

```bash
rg "网站树|筛选|规则数据|AI|配置|规则|热加载|序列|组并发" app/renderer/src/main/src
rg "tabBarPosition=['\"]left|writing-mode|vertical|side|sider|left.*menu|sub.*menu" app/renderer/src/main/src
```

Then read the component and its same-name `.scss`. In this project, the relevant code is usually under `app/renderer/src/main/src/pages/` and may be nested under History, HTTP Fuzzer, MITM, or layout/workbench components.

## Migration Workflow

1. Identify the active key state and item list.
   - Keep the existing `activeKey`, `selectKey`, `currentTab`, or equivalent state.
   - If labels/icons are inline JSX, extract only enough structure to render the same controls horizontally.

2. Split the old left layout into three conceptual blocks.
   - `subnav-row`: the clickable buttons that used to be vertical.
   - `subnav-panel`: the content controlled by those buttons.
   - `main-content`: the existing table/editor/result area.

3. Move `subnav-row` immediately below the workspace tab strip.
   - For History, this means below `首页 / History / ...`.
   - For Web Fuzzer, this means below the request tab strip such as `1 / 3 / ...`.
   - The row should span the content width used by the page toolbar, not remain inside a narrow left column.

4. Move the controlled display area below `subnav-row`.
   - If the old left column contained both buttons and a panel, only the buttons become the row.
   - The panel content should render in the content area under the row, using the same selected key logic.

5. Replace side-by-side shell CSS with column-first CSS.

Before:

```scss
.workbench-body {
  display: flex;
}

.subnav-left {
  width: 24px;
  flex-shrink: 0;
}
```

After:

```scss
.workbench-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.subnav-row {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  overflow-x: auto;
}

.workbench-content {
  display: flex;
  min-height: 0;
  flex: 1;
}
```

Use existing color tokens and class names where possible. Do not introduce new colors for this layout-only change.

## JSX Shape

Prefer this structure when refactoring:

```tsx
<div className="page-workbench">
  <div className="page-tabs">{/* existing tabs */}</div>
  <div className="page-subnav-row">
    {subNavItems.map((item) => (
      <button
        key={item.key}
        className={classNames('page-subnav-item', {active: activeKey === item.key})}
        onClick={() => setActiveKey(item.key)}
      >
        {item.icon}
        <span>{item.label}</span>
      </button>
    ))}
  </div>
  <div className="page-workbench-content">
    <div className="page-subnav-panel">{renderSubNavPanel(activeKey)}</div>
    <div className="page-main-content">{/* existing table/editor/result */}</div>
  </div>
</div>
```

Use the page's existing button component if it already has one. Do not replace yakitUI/antd components unless the current page pattern requires it.

## Common Mistakes

- Moving only the buttons but leaving the selected panel in the old left column.
- Putting the row inside the global left menu instead of inside the active page workspace.
- Hard-coding a new width that makes tables/editors overflow.
- Deleting state or effects because they looked tied to the old layout.
- Changing colors while doing the layout move.
- Leaving old vertical CSS such as `writing-mode`, fixed `width: 24px`, or rotated labels active.

## Verification

After editing, check at least:

- The original buttons still switch the same panels.
- The row sits under the correct tab strip, not under the global app header.
- The controlled panel is below the row.
- Main tables/editors still resize with `min-height: 0` and no double scrollbars.
- No unrelated color changes appear in the diff.

Useful commands:

```bash
yarn tsc --noEmit
rg "writing-mode|tabBarPosition=['\"]left|width:\\s*24px" app/renderer/src/main/src
```
