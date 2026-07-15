# Enterprise Plugin Repository Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bind Yakit Enterprise's plugin repository to the configured private-domain server and expose a server-admin plugin repository for inventory management.

**Architecture:** Reuse the existing enterprise server's compatible `/api/plugins`, `/api/plugins/search`, `/api/plugins/download`, and `/api/plugins` deletion APIs. The Yakit desktop client already persists the private-domain URL into its online profile; make the plugin synchronization path use that profile consistently, then add an admin page that operates on the same backend records rather than introducing another plugin store.

**Tech Stack:** Electron, React 18, TypeScript, antd 4, yakitUI, Go, GORM, go-swagger.

---

### Task 1: Verify the existing private-domain plugin contract

**Files:**
- Modify: none
- Verify: `app/renderer/src/main/src/components/ConfigPrivateDomain/ConfigPrivateDomain.tsx`, `app/renderer/src/main/src/pages/plugins/utils.ts`, `app/renderer/src/main/src/pages/plugins/pluginUploadHooks.ts`

**Step 1: Verify the configured private-domain flow**

Confirm that enterprise login writes the private-domain URL and token into the engine online profile, and that list, local upload, and batch download reuse that profile.

**Step 2: Verify the running service contract**

Run authenticated requests against `GET /api/plugins` and `POST /api/plugins/download` with `listType: "mine"`.

Expected: both endpoints authenticate with the enterprise token and return the server's plugin records.

**Step 3: Preserve the existing desktop implementation**

Do not introduce a parallel client endpoint: the Yakit engine already calls this API contract after `SetOnlineProfile`.

**Step 4: Verify the desktop user journey**

Run Yakit Enterprise, sign in to the configured private domain, upload one non-core local plugin from `本地`, then use `我的` to download it back to the local list.

Expected: the record is visible in the server repository and the downloaded plugin appears locally.

### Task 2: Add the enterprise admin plugin repository page

**Files:**
- Create: `/Volumes/coding/GO/4dogs/yakit-enterprise/frontend/src/pages/PluginRepository/PluginRepository.tsx`
- Create: `/Volumes/coding/GO/4dogs/yakit-enterprise/frontend/src/pages/PluginRepository/PluginRepository.module.scss`
- Modify: `/Volumes/coding/GO/4dogs/yakit-enterprise/frontend/src/admin/config/component.tsx`
- Modify: `/Volumes/coding/GO/4dogs/yakit-enterprise/frontend/src/admin/config/menuConfig.tsx`
- Test: `/Volumes/coding/GO/4dogs/yakit-enterprise/frontend/src/pages/PluginRepository/PluginRepository.test.tsx`

**Step 1: Write the failing test**

Render the repository page with a token-bearing API client and assert that it requests the server list, displays returned plugins, and exposes a confirmation-gated delete action.

**Step 2: Run test to verify it fails**

Run: `yarn test --watchAll=false PluginRepository.test.tsx`

Expected: FAIL because the repository page does not exist.

**Step 3: Write minimal implementation**

Create a dense Sentinel-styled inventory page with search, ownership/visibility/status indicators, pagination, refresh, and safe single/batch deletion. Add the `插件仓库` sidebar item and `/admin/plugin-repository` route. Use the already authenticated admin token in request data, matching the server's existing plugin handlers.

**Step 4: Run test to verify it passes**

Run: `yarn test --watchAll=false PluginRepository.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git -C /Volumes/coding/GO/4dogs/yakit-enterprise add frontend/src/pages/PluginRepository frontend/src/admin/config/component.tsx frontend/src/admin/config/menuConfig.tsx
git -C /Volumes/coding/GO/4dogs/yakit-enterprise commit -m "feat: add enterprise plugin repository admin"
```

### Task 3: Verify against the running enterprise service

**Files:**
- Modify: none

**Step 1: Verify authentication and server contracts**

Use the configured private-domain server to log in, then verify `GET /api/plugins` and `POST /api/plugins/download` with an authenticated `mine` request.

**Step 2: Verify desktop path**

Run Yakit Enterprise, configure the private domain, sign in, upload one non-core local plugin from `本地`, then visit `我的` and perform one-key download. Confirm the downloaded plugin appears in the local list.

**Step 3: Verify server-admin path**

Run the server frontend, open `插件仓库`, confirm the uploaded record appears, and test its management actions with a non-production plugin.

**Step 4: Commit only scoped files**

Review both worktrees separately, stage only the planned files, and commit after the focused tests/builds pass.
