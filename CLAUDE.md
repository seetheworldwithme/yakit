# Yakit 开发指南

## 项目概览
Yakit 是一款网络安全测试桌面应用，**Electron 27** 架构：
- 主进程（Node 侧）：`app/main/` —— 窗口、IPC、本地能力
- 渲染进程（前端 UI）：`app/renderer/src/main/src/`

> 绝大多数「改页面 / 改组件」任务**只涉及渲染进程**。

## 技术栈（渲染进程）
- React 18 + TypeScript 5（CRA + react-app-rewired）
- UI：**antd 4.21.7** + `@ant-design/icons`
- 自研组件库：**yakitUI**（`@/components/yakitUI/`，43 个组件，覆盖 Button / Modal / Input / Form / Tabs / Drawer / Select 等常用件）
- 状态管理：**zustand**（`@/store`，每个文件一个 store）
- 样式：**Sass**（`.scss`）
- 工具：ahooks、lodash、dayjs
- 路径别名：`@/` → `app/renderer/src/main/src/`
- 国际化：`useI18nNamespaces` + `t()`（`@/i18n`）
- 请求：`NetWorkApi`（`@/services/fetch`）

## 前端目录（`app/renderer/src/main/src/`）
| 目录 | 职责 |
|---|---|
| `pages/` | 页面级组件（如 `Login.tsx`） |
| `components/` | 通用组件；`components/yakitUI/` 为自研组件库 |
| `store/` | zustand 状态 |
| `theme/` `styles/` | 全局主题与样式 |
| `utils/` `services/` | 工具函数与请求封装 |
| `i18n/` `hook/` `routes/` `models/` | 国际化 / hooks / 路由 / 数据模型 |

## 代码风格（强制，见 `.prettierrc.js` / `.cursorrules`）
- **无分号**结尾
- **单引号**（JSX 属性用双引号）
- 2 空格缩进，LF 换行，行宽 120
- 箭头函数参数始终加括号 `(x) =>`；末尾逗号 `all`
- 改完代码用项目的 prettier 规则格式化

## 改 UI 的约定（高频场景）
1. **优先用 yakitUI 组件**（`YakitButton` / `YakitModal` / `YakitInput` / `YakitForm` …），不要混用裸 antd，以保持视觉一致。
2. **样式写同名 `.scss`**：`Foo.tsx` 的样式放在同目录 `Foo.scss`（`import './Foo.scss'`）。深度定制 antd 组件用 `:global` / 自定义类名覆盖，**不要**用 antd 5 的 theme token（本项目是 antd 4）。
3. **只改 UI 不动逻辑**：调整布局 / 样式时，保留现有 state、事件、接口调用。
4. **定位要准**：用文件路径（`pages/Login.tsx`）配合截图指明位置，避免改错文件。

## 开发与预览
- 社区版开发：根目录 `yarn start-render`（react-app-rewired start，保存即热更新）
- 变体：`yarn start-render-enterprise` / `yarn start-render-irify` / `yarn start-render-memfit`
- 改 UI 后保存即可在运行中的应用看到效果，无需重启

## Sentinel 换皮规范（进行中）
本项目正将前端整体改写为 **Sentinel**——企业安全 / 科技蓝大屏风的纯深色产品（保留全部功能，仅改外观）。

- **设计规格（唯一事实源）**：`docs/superpowers/specs/2026-06-30-sentinel-rebrand-design.md`
- **实现计划**：`docs/superpowers/plans/`（阶段 0+1 配色已完成，阶段 2 组件、阶段 3 布局待做）

### 硬约束

> **范围：全变体统一换皮**——社区版 / 企业版 / IRify / Memfit / EnpriTrace 全部改为 Sentinel（配色 / 形态 / 布局 / 品牌名一致），非仅社区版。

1. **纯深色**：主色青蓝 `#0EA5E9`、深底 `#0A1929`。主题切换已移除，**不要恢复** light/dark 切换；`useTheme` 固定 dark。
2. **颜色必须走 token**：所有颜色用 `var(--Colors-Use-*)`。114 个 token 的值定义在 `app/renderer/src/main/src/theme/sentinelTheme.ts`——改色改这里，**禁止**在组件 / scss 里硬编码 `#hex` / `rgba`。
3. **主题注入机制**：`utils/applyYakitThemeColors.ts` → `@yakit-libs/color` 的 `applyThemeColors` 在启动时把 token 注入 `document.documentElement`。**坑**：`generateColors` 的 `mainColorOverride` 只影响 `--yakit-colors-*` 基础色阶，**不影响**前端实际用的 `--Colors-Use-*` 语义色——换语义色必须改 `sentinelTheme.ts`，不要靠传主色。
4. **只动 UI 不动逻辑**：保留 state / 接口 / 事件 / 路由 / 业务功能。
5. **组件优先 yakitUI**，不混裸 antd；antd 4 深度定制用 `:global` / 自定义类名。
6. **图表配色**（ECharts）：`utils/yakitColorVars.ts` / `GetMainColor` 仍是原基准色，属阶段 3 页面级重配范围。

### 提交策略
- **测试通过即 commit，无需问**：换皮改动只要满足「构建无报错（`tsc` / 启动无错）+ 功能正常（`regression-check.py` 过 / 关键页可点）+ 视觉走查通过」就直接 `git commit`，**不必停下来征求确认**。各 phase 的「Commit」步骤按此执行。
- 仍遵守：**不 push**（推远端是 outward 操作，另问）；换皮代码走 feature 分支（不在 `master` 直接堆叠实现提交，文档 / 基线除外）。

### 相关 skill
- `ui-tweak`：单页面 / 组件 UI 微调（已适配 Sentinel 主题）。
- `sentinel-rebrand`：按 spec 做系统性换皮改造（组件塑形 / 布局重排）。
