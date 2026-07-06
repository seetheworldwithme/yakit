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

## 改 UI 的标准操作流程（SOP）
> 适用于「调布局 / 隐按钮 / 换图标 / 改样式」等高频 UI 改动。准则：**改得准、不崩、可复用**。新开 session 改 UI 一律按此走。

### 改前：探查要全
1. **读全目标文件**（含同名 `.scss`）再动手，不凭片段猜结构。
2. **查全「定义点 + 消费点」**：菜单 / 路由 / 标签 / 图标这类「一处定义多处消费」的，先 grep 全部引用再改。例：顶级标签由 `getDefaultFixedTabs`（钉住）+ `getInitPageCache`（启动开页）双驱动；`HistoryTab` 被 History 与 Analysis 两个页面共用。**漏一处就残影**。
3. **先区分「隐入口」vs「删功能」**：查 `docs/功能裁剪最终方案.md` 的定性（保留 / 不展示）。
   - **隐入口** = 保留路由 + 页面，只去展示入口（tab / 菜单 / 按钮）；功能仍可从其它入口进入。多数情况走这条。
   - **删功能** = 连路由 / 页面 / IPC 一起删；删前**必须做依赖扫描**（`rg "YakitRoute.Xxx|openPage|onMenu\(\{ route"`）。

### 改时：外科式 + 保兼容
1. **外科式 Edit**，不整文件重写；优先保留未触及的 JSX 分支（复制大段 JSX 易出错）。
2. **共享文件保兼容**：`Home.tsx` / `newRoute.tsx` / `MainOperatorContent.tsx` 等是**全变体 / 多模式共享**。当前主要在企业版（`isEnpriTrace()` 分支），但社区版 `isCommunityYakit()`+Scan 的扫描模式、IRify / Memfit 分支的 JSX 仍在同一文件里——**用不到的分支也要原样保留，勿删崩**。
3. **只动 UI 不动逻辑**：保留 state / 事件 / 接口 / 路由。
4. **隐入口要改全所有定义处**（双驱动的两处都改，否则一边残影）。
5. **删 tab / 面板后处理缓存残留**：如 activeKey 历史缓存值要回退到默认 tab，避免空面板；只服务于已删 JSX 的 hook/Provider 若深度集成（多处注册、包裹整页），**只隐展示不刨根**，另行说明。

### 改后：清理 + 验证
1. **顺手清死代码**：删只服务已删 JSX 的 state / handler / ref / import；删前 grep 确认该符号**全文件仅 1 处引用**（= 仅定义处）。若死代码 cascade（hook 还被别处用），只删明显死的局部变量，保留 hook。
2. **验证三板斧**：
   - IDE `getDiagnostics`（项目 `tsconfig` 的 TS server，**权威、等同 tsc**；本机根目录无 `tsc` / `sass` 可执行文件，以此为准）；
   - grep 扫已删标识符的残留引用（应为空）；
   - SCSS 查花括号配平（`{` 数 == `}` 数）。
3. **删 `export` 前**全仓 grep 确认无外部引用（如 `convertToBytes`）。
4. **大段 SCSS 删除**（多块 + 多档 `@media`）：用「按 selector + 花括号配准」的 python 脚本批量删，避免逐块手改导致行号漂移；删完查配平。脚本骨架：遍历行，匹配 `selector {` 起，按 `{`/`}` 计深度到配平，整段删 + 去一个尾空行。
5. 验证通过即 `git commit` 并 `git push` 到 `main`——见下「提交策略」。

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
- **直接在 `main` 上开发并提交**：**不走 feature 分支**，所有改动落在 `main`；验证通过即 `git commit` 并 `git push` 到远端 `main`。推远端是 outward 操作，push 前确认分支与暂存范围无误。
- 仍遵守：外科式改动 + 只动 UI 不动逻辑；提交前自查不卷入无关 WIP。

### 相关 skill
- `ui-tweak`：单页面 / 组件 UI 微调（已适配 Sentinel 主题）。
- `sentinel-rebrand`：按 spec 做系统性换皮改造（组件塑形 / 布局重排）。

注意，在回答之前，一定要说：好的，徐先生。

## graphify（代码知识图谱）

本项目在 `graphify-out/` 维护了一份代码知识图谱，包含 god 节点、社区结构与跨文件关系。

规则：
- 遇到代码库相关问题时，若 `graphify-out/graph.json` 存在，**优先**用 `graphify query "<问题>"` 查询；用 `graphify path "<A>" "<B>"` 查两个对象之间的关系，用 `graphify explain "<概念>"` 聚焦某个概念。它们返回的是裁剪后的子图，通常比 `GRAPH_REPORT.md` 或裸 `grep` 结果小得多。
- 若 `graphify-out/wiki/index.md` 存在，用它做整体导航，优于直接翻源码。
- 只在「需要整体架构审视」或 query / path / explain 仍提供不了足够上下文时，才读 `graphify-out/GRAPH_REPORT.md`。
- 改完代码后无需运行 `graphify update .`；只有用户明确要求更新图谱时才执行。
