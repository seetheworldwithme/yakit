---
name: sentinel-rebrand
description: 按 Sentinel 换皮 spec 对 yakit 前端做系统性改造——组件视觉塑形（圆角/阴影/间距/字号）、布局骨架重排、品牌门面替换。当用户要求"按 Sentinel 规范改造组件/页面/布局"、"执行换皮阶段 2/3"、"批量对齐组件形态"等系统性换皮工作时使用。标准流程：读 spec 与 sentinelTheme → 颜色走 token → 套用形态/布局规则 → 只动 UI → 验证。
---

# sentinel-rebrand — Sentinel 换皮系统改造

本 skill 用于 yakit 前端（`app/renderer/src/main/src/`）的**系统性换皮改造**（区别于 `ui-tweak` 的单点微调）。改造依据是 Sentinel 设计规格，保证整站视觉一致。

## 前置：必读
- **设计规格（唯一事实源）**：`docs/superpowers/specs/2026-06-30-sentinel-rebrand-design.md`
  - 第 3.2 节：114 个 token 色板
  - 第 3.3 节：组件形态规则（圆角 / 阴影 / 间距 / 字号）
  - 第 4 节：布局骨架（左功能栏 + 顶部状态条 + tab 工作区）
- **色板定义**：`@/theme/sentinelTheme.ts`
- **项目约定**：根目录 `CLAUDE.md`（含「Sentinel 换皮规范」）

## 硬约束（与 CLAUDE.md 一致）
1. 纯深色，不恢复 light/dark 切换。
2. 颜色走 `var(--Colors-Use-*)`，禁止硬编码色值；改色改 `sentinelTheme.ts`。
3. 只动 UI，不动 state / 接口 / 事件 / 路由 / 业务。
4. 组件优先 yakitUI；antd 4 用 `:global` 覆盖，不用 antd 5 token。

## 工作流程

### 1. 明确改造对象与阶段
- **阶段 2（组件视觉）**：yakitUI 43 组件塑形 + `theme/componentsTheme/` 对齐。套用 spec 第 3.3 节：
  - 圆角：tag `4` / 按钮 `6` / 卡片·输入 `8` / 大容器·弹窗 `12`
  - 阴影：静态 `0 1px 3px rgba(0,0,0,.4)`；悬浮 `0 4px 12px rgba(0,0,0,.5)`；激活/聚焦发光 `0 0 14px rgba(14,165,233,.35)`
  - 间距：4 基准网格 `4/8/12/16/24/32`
  - 字号：`14` 正文基准
- **阶段 3（布局结构）**：主布局重排为「左功能栏 + 顶部状态条 + tab 工作区」。
  - `components/layout/UILayout.tsx` 只做应用外壳和顶部状态条，不接入 `PublicMenu` / `HeardMenu`。
  - `pages/MainOperator.tsx` 是菜单 + `MainOperatorContent` tab 工作区的真实父级，在这里建立「左栏 + 右工作区」。
  - `pages/layout/HeardMenu`（企业版）在原组件内从顶部横排改为纵向左栏，保留专家/扫描/简易模式、导航数据库合并、自定义菜单、JSON 导入、插件下载补齐、路由打开逻辑。
  - `pages/layout/publicMenu`（社区版）在原组件内纵向化，保留软模式、常用插件、Codec/DNSLog、SecurityExpert、Memfit 分支。
  - 禁止新建通用 `LayoutSidebar` 去包装 `HeardMenu` / `PublicMenu`，二者不是纯菜单数据组件。
  - 品牌门面（`pages/Login.tsx` / `NewYakitLoading.tsx` / 窗口标题 / favicon → Sentinel）+ 逐页面收尾。

### 2. 定位与读取
- Grep / Glob 定位目标组件 / 页面及其同名 `.scss`。
- 读现有代码，识别需塑形 / 重排的点（硬编码色、旧圆角 / 阴影、旧布局结构）。

### 3. 改造（遵守 spec）
- **颜色**：硬编码 `#hex` / `rgba` → `var(--Colors-Use-*)`。
- **形态**：按第 3.3 节套圆角 / 阴影 / 间距；优先复用 SCSS 变量，无则新增集中变量（`$radius-*` / `$space-*`），不散落硬编码。
- **布局**：按第 4 节骨架调整；保留交互逻辑与数据流。
- **品牌**：用户可见文案「Yakit」→「Sentinel」（仅显示文案，不改变量名 / 类名 / `yakit` 前缀模块路径）。

### 4. 验证
- `yarn start-render` 热更新，肉眼检查目标组件 / 页面三态（default / hover / focus / active / disabled）。
- DevTools 确认 token：`getComputedStyle(document.documentElement).getPropertyValue('--Colors-Use-Main-Primary')` 应为 `#0EA5E9`。
- grep 校验改造范围无硬编码色残留。
- 功能回归：相关交互行为不变。

### 5. 收尾
- 列出改动文件清单与每处改动的 spec 依据（对应哪一节）。
- 提示预览方式与下一步。
