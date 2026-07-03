# EnpriTrace 企业版跳过启动页方案

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** EnpriTrace 企业版启动时不再显示独立的引擎连接启动窗口（StartupPage），改为直接显示主窗口 + 内置加载蒙层，后台静默完成引擎连接后自动进入主界面。

**Architecture:** 保留 engine-link-startup 渲染进程及其全部引擎连接逻辑不变，仅做三处改动：(1) 主进程对 EnpriTrace 隐藏创建启动窗口；(2) 主进程对 EnpriTrace 立即显示主窗口；(3) UILayout 在挂载时即展示加载蒙层（而非等待 IPC 通知）。引擎连接完成后 IPC 数据照常送达，蒙层消失进入主界面。用户感知：打开应用 → 主窗口(loading) → 主界面。

**Tech Stack:** Electron 27 主进程、React 18、engine-link-startup 独立渲染进程、IPC 通信

---

## 当前架构回顾

```
app.whenReady()
  ├── createEngineLinkWindow()   ← 900x600 独立窗口，加载 engine-link-startup 渲染进程
  │     └── StartupPage 组件 → 引擎自检/连接全流程 → completeEngineLink() IPC
  └── createWindow()             ← 主窗口，show: false，等待 engineLinkWin-done 才 show
        └── UILayout → onFromEngineLinkWindow → NewYakitLoading → WatchDog → engineLink=true → 主内容
```

**关键 IPC 流转：**
```
StartupPage.completeEngineLink({credential})
  → ipc 'engineLinkWin-done' (engineLinkPreload.js)
    → main: winHide(engineLinkWin) + winShow(win) + safeSend(win, 'from-engineLinkWin', data)
      → UILayout: yakitUILayout.onFromEngineLinkWindow() → setShowLoadingPage(true) + setCredential + setKeepalive
        → YaklangEngineWatchDog.onReady → setEngineLink(true) → 渲染主内容
```

---

### Task 1: 主进程 — EnpriTrace 启动窗口设为隐藏

**Files:**
- Modify: `app/main/index.js:112-211` (createEngineLinkWindow 函数)

**Step 1: 修改 createEngineLinkWindow，对 EnpriTrace 默认隐藏**

在 `createEngineLinkWindow()` 函数中，将 BrowserWindow 的 `show` 属性从硬编码 `true` 改为条件判断：

```javascript
// 当前代码（第139行）:
// show: true,

// 改为:
show: !isEnpriTraceBuild(),
```

需要新增 `isEnpriTraceBuild()` 辅助函数，通过环境变量判断当前构建是否为 EnpriTrace 企业版：

```javascript
function isEnpriTraceBuild() {
  return process.env.REACT_APP_PLATFORM === 'enterprise' ||
         process.env.REACT_APP_PLATFORM === 'irify-enterprise'
}
```

**注意:** `process.env.REACT_APP_PLATFORM` 是在构建时由各个变体的 `.env` 文件注入的：
- 企业版: `REACT_APP_PLATFORM=enterprise`
- IRify企业版: `REACT_APP_PLATFORM=irify-enterprise`

**验证:** 确认 `isEnpriTraceBuild()` 函数能正确识别企业版构建。检查项目根目录和各变体目录下的 `.env.*` 文件确认变量名。

---

### Task 2: 主进程 — EnpriTrace 立即显示主窗口

**Files:**
- Modify: `app/main/index.js:541-545` (engineLinkWin-done IPC handler)

**Step 1: 修改 engineLinkWin-done handler，对 EnpriTrace 提前显示主窗口**

当前逻辑：等 engineLinkWin-done IPC 到达后才 winShow(win)。对于隐藏了启动窗口的 EnpriTrace，主窗口需要在启动窗口后台完成后才显示——但我们可以让主窗口更早显示（带 loading 蒙层）。

方案：在 `app.whenReady()` 中，创建完两个窗口后，如果是 EnpriTrace 构建，立即显示主窗口：

```javascript
// app.whenReady() 中，createEngineLinkWindow() 和 createWindow() 之后（约第708行）:
createEngineLinkWindow()
createWindow()

// 新增: EnpriTrace 立即显示主窗口
if (isEnpriTraceBuild()) {
  winShow(win, false)  // 直接显示，不等 ready-to-show
}
```

同时修改 `engineLinkWin-done` handler，确保非 EnpriTrace 行为不变：

```javascript
// 当前代码（第541-545行）:
ipcMain.handle('engineLinkWin-done', async (event, data) => {
  winHide(engineLinkWin)
  winShow(win, readyWinShow)
  safeSend(win, 'from-engineLinkWin', data)
})

// 改为:
ipcMain.handle('engineLinkWin-done', async (event, data) => {
  if (engineLinkWin && !engineLinkWin.isDestroyed()) {
    winHide(engineLinkWin)
  }
  // EnpriTrace 的主窗口已经提前显示了，不需要再 show
  // 但仍需确保窗口可见
  if (!isEnpriTraceBuild()) {
    winShow(win, readyWinShow)
  }
  safeSend(win, 'from-engineLinkWin', data)
})
```

**验证:** 
- EnpriTrace: 应用启动后主窗口立即可见（显示 UILayout 的默认空状态或 loading）
- 其他版本: 行为完全不变，仍然等启动窗口完成后才显示主窗口

---

### Task 3: UILayout — EnpriTrace 挂载时立即展示 Loading 蒙层

**Files:**
- Modify: `app/renderer/src/main/src/components/layout/UILayout.tsx:184-211` (showLoadingPage 初始化与 onFromEngineLinkWindow effect)

**Step 1: 对 EnpriTrace 默认开启 showLoadingPage**

当前 `showLoadingPage` 初始值为 `false`，只在收到 `onFromEngineLinkWindow` IPC 后才设为 `true`。对 EnpriTrace，改为初始即为 `true`：

```tsx
// 当前代码（第185行）:
const [showLoadingPage, setShowLoadingPage] = useState<boolean>(false)

// 改为:
import { isEnpriTrace } from '@/utils/envfile'
// ...
const [showLoadingPage, setShowLoadingPage] = useState<boolean>(isEnpriTrace())
```

**Step 2: 对 EnpriTrace 设置初始加载文案**

```tsx
// 当前代码（第187行）:
const [newCheckLog, setNewCheckLog] = useState<string[]>([])

// 改为:
const [newCheckLog, setNewCheckLog] = useState<string[]>(
  isEnpriTrace() ? ['正在初始化引擎连接...'] : []
)
```

**Step 3: 保持 onFromEngineLinkWindow 回调不变**

`onFromEngineLinkWindow` 的回调逻辑保持不变——当 IPC 数据到达时，它仍会更新 credential、yakitStatus、keepalive 等。由于 `showLoadingPage` 已经是 `true`，`setShowLoadingPage(true)` 是幂等的，不会有问题。

**验证:**
- EnpriTrace 启动后主窗口立即显示 NewYakitLoading 蒙层，文案 "正在初始化引擎连接..."
- 引擎连接 IPC 到达后，蒙层状态正常更新，WatchDog 探活成功后进入主界面
- 其他版本行为不变

---

### Task 4: 清理 — 启动窗口关闭后销毁（仅 EnpriTrace）

**Files:**
- Modify: `app/main/index.js:541-545` (engineLinkWin-done handler)

**Step 1: EnpriTrace 完成后销毁启动窗口而非仅隐藏**

由于 EnpriTrace 的启动窗口始终不可见，完成后应彻底销毁以释放资源：

```javascript
ipcMain.handle('engineLinkWin-done', async (event, data) => {
  if (engineLinkWin && !engineLinkWin.isDestroyed()) {
    if (isEnpriTraceBuild()) {
      engineLinkWin.close()  // 触发 closed 事件，engineLinkWin = null
    } else {
      winHide(engineLinkWin)
    }
  }
  if (!isEnpriTraceBuild()) {
    winShow(win, readyWinShow)
  }
  safeSend(win, 'from-engineLinkWin', data)
})
```

**注意:** `engineLinkWin.close()` 会触发 `close` 事件，该事件的 handler 中有 `e.preventDefault()` 并发送 `'close-engineLinkWin-renderer'` 给渲染进程。由于窗口即将销毁，这个 preventDefault 可能导致窗口不关闭。需要处理这个问题：

```javascript
// 方案: 在 close 事件中判断是否为 EnpriTrace 主动销毁
let forceCloseEngineLinkWin = false

// 在 engineLinkWin-done 中:
if (isEnpriTraceBuild()) {
  forceCloseEngineLinkWin = true
  engineLinkWin.close()
}

// 修改 close 事件 handler（第200-206行）:
engineLinkWin.on('close', (e) => {
  if (forceCloseEngineLinkWin) {
    return  // 允许关闭
  }
  e.preventDefault()
  state.saveState(engineLinkWin)
  if (engineLinkWin.isVisible()) {
    engineLinkWin.webContents.send('close-engineLinkWin-renderer')
  }
})
```

或者更简单的方式——直接调用 `destroy()` 而非 `close()`：

```javascript
if (isEnpriTraceBuild() && engineLinkWin && !engineLinkWin.isDestroyed()) {
  engineLinkWin.destroy()
  engineLinkWin = null
}
```

`destroy()` 强制销毁窗口，不触发 close 事件，更干净。

**最终 engineLinkWin-done handler:**

```javascript
ipcMain.handle('engineLinkWin-done', async (event, data) => {
  if (engineLinkWin && !engineLinkWin.isDestroyed()) {
    if (isEnpriTraceBuild()) {
      engineLinkWin.destroy()
      engineLinkWin = null
    } else {
      winHide(engineLinkWin)
    }
  }
  if (!isEnpriTraceBuild()) {
    winShow(win, readyWinShow)
  }
  safeSend(win, 'from-engineLinkWin', data)
})
```

**验证:**
- EnpriTrace: 启动窗口不可见且完成后销毁，任务管理器中不应残留
- 其他版本: 行为不变

---

## 不改动的部分（重要边界）

以下内容**完全不改动**，确保安全：

| 组件 | 原因 |
|---|---|
| `engine-link-startup/` 敲个目录 | 全部保留，只是窗口不可见 |
| `StartupPage` 组件逻辑 | 全部保留，后台正常运行 |
| `LocalEngine` / `RemoteEngine` / `YaklangEngineWatchDog` | 全部保留 |
| `grpc.ts` gRPC 接口调用 | 全部保留 |
| `completeEngineLink` IPC 机制 | 全部保留 |
| `NewYakitLoading` 组件 | 无需改动，UILAYOUT 传入新 props 即可 |
| `EnterpriseJudgeLogin` | 不受影响 |
| 社区版/IRify/Memfit/SE 版本 | 完全不受影响，通过 `isEnpriTraceBuild()` 条件守护 |

---

## 用户感知变化对比

### Before（当前）
```
用户双击 EnpriTrace
  → 白屏 ~1s
  → 弹出 900x600 启动窗口（EnpriTrace Logo + "为网络安全而生"）
  → "开始检查随机密码模式中..." （~2-5s）
  → "准备开始启动连接引擎" （~2-3s）
  → 3秒倒计时 "立即进入(3s)..."
  → 启动窗口消失，主窗口出现
  → NewYakitLoading 蒙层闪过
  → 主界面
```

### After（改造后）
```
用户双击 EnpriTrace
  → 主窗口直接出现（带 NewYakitLoading 蒙层，显示 "正在初始化引擎连接..."）
  → 后台静默完成引擎自检+连接（~5-10s，窗口一直显示 loading）
  → IPC 到达 → WatchDog 探活 → 蒙层消失
  → 主界面
```

---

## 测试计划

1. **构建验证**: `yarn start-render-enterprise` 确认无编译报错
2. **功能验证**:
   - 启动后主窗口直接出现（无独立启动窗口）
   - Loading 蒙层正常显示
   - 引擎连接成功后自动进入主界面
   - License 登录流程正常（如果启用）
   - 远程模式切换正常
   - 引擎断连重连正常
3. **回归验证**: `yarn start-render`（社区版）确认行为未变
