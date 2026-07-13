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
   - `tsc`（权威）：`cd app/renderer/src/main && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`（根目录无全局 tsc，用 renderer 内这个）；或 IDE `getDiagnostics`；
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

> 🎯 **第一目标（2026-07 澄清）**：竞标审核是**人工肉眼审页面**——每页的**骨架/布局看着完全不一样**才是重点。类名重命名 / 源码指纹 / `detecting-frontend-reskins` 审计分**不是重点**（肉眼看不到，别花时间）。改页优先做可见的布局改动（移面板、换朝向、列表↔卡片/表格、改 chrome），别把精力放在类名命名空间换名上。

- **当前改造方案（本轮唯一事实源）**：`docs/功能改造方案.md`——深空青蓝 + IDE 工作台外壳（5 域：侦收/进攻/检测/扩展/治理）+ 逐页骨架重塑的盘点表与路线（已落地：P0 配色 + 5 域外壳、P1 报文构造台、P2 MITM 控制塔翻顶栏 + 插件抽屉化）。
- **早期设计规格（参考）**：`docs/superpowers/specs/2026-06-30-sentinel-rebrand-design.md`、`docs/superpowers/plans/`（配色阶段已落地，组件/布局阶段以新方案为准）。

### 硬约束

> **范围：全变体统一换皮**——社区版 / 企业版 / IRify / Memfit / EnpriTrace 全部改为 Sentinel（配色 / 形态 / 布局 / 品牌名一致），非仅社区版。

1. **深空青蓝**：主色 `#0EA5E9`、深底 `#0A1929`。**现状**：light/dark 双主题仍在（`theme/yakit.scss` 的 `data-theme='light'|'dark'`），深空青蓝目前只在 **dark** 主题生效（见 #3 的 dark 覆写）；light 主题未动。
2. **颜色必须走 token**：所有颜色用 `var(--Colors-Use-*)`（消费者经 `theme/themeify.scss` 的 `fetch-color()`）。**禁止**在组件 / scss 里硬编码 `#hex` / `rgba`。
3. **取色总闸（已实测，以此为准）**：
   - **主色**：`utils/envfile.tsx` 的 `GetMainColor(theme)` 按变体返回主色 hex → `index.tsx` 调 `applyYakitThemeColors(theme, GetMainColor(theme))` → `@yakit-libs/color` 的 `generateColors(theme, mainColor)` 据此生成全套 `--Colors-Use-Main-*` 注入 `document.documentElement`。**换主色 = 改 `GetMainColor` 的返回值**（按变体分；企业版走 `enterprise`/`simple-enterprise`/`yakit` case）。改完需刷新页面。
   - **底色 / 中性色**：生成器自带的暗灰底不是深蓝。`utils/applyYakitThemeColors.ts` 里在 `applyThemeColors` 之后、`theme === 'dark'` 时**覆写**中性 token（`--Colors-Use-Basic-Background` / `--Colors-Use-Neutral-Bg(-Hover/Pressed)` / `--Colors-Use-Neutral-Border` / `--Colors-Use-Neutral-Text-1/2/3`）到 `#0A1929` 系——**换底色改这张覆写表**。
   - ⚠️ **不存在** `theme/sentinelTheme.ts`（旧文档误指，别再找）。`@yakit-libs/color` 是已编译的 npm 包（`app/renderer/engine-link-startup/node_modules/@yakit-libs/color`），改不动，靠生成后覆写。
4. **只动 UI 不动逻辑**：保留 state / 接口 / 事件 / 路由 / 业务功能。
5. **组件优先 yakitUI**，不混裸 antd；antd 4 深度定制用 `:global` / 自定义类名。
6. **图表配色**（ECharts）：`utils/yakitColorVars.ts` / `GetMainColor` 仍是原基准色，属阶段 3 页面级重配范围。

### 提交策略
- **测试通过即 commit，无需问**：换皮改动只要满足「构建无报错（`tsc` / 启动无错）+ 功能正常（`regression-check.py` 过 / 关键页可点）+ 视觉走查通过」就直接 `git commit`，**不必停下来征求确认**。各 phase 的「Commit」步骤按此执行。
- **直接在 `main` 上开发并提交**：**不走 feature 分支**，所有改动落在 `main`；验证通过即 `git commit` 并 `git push` 到远端 `main`。推远端是 outward 操作，push 前确认分支与暂存范围无误。
- **多窗口并行模式**：可多开 Claude Code 窗口在**同目录同分支(`main`)** 并行改造，关键是**文件不交叉**。每个窗口**只 `git add <自己改的具体文件>`**，**严禁 `git add -A` / `git commit -am` / `git add .`**（会捞走别的窗口半成品）；提交时机错开；共享文件（`package.json` / `tsconfig.json` / `theme/sentinelTheme.ts` / 全局 scss）只由指定窗口动。详见执行手册 §1。
- 仍遵守：外科式改动 + 只动 UI 不动逻辑；提交前自查不卷入无关 WIP。

### 相关 skill
- `ui-tweak`：单页面 / 组件 UI 微调（已适配 Sentinel 主题）。
- `sentinel-rebrand`：按 spec 做系统性换皮改造（组件塑形 / 布局重排）。
- `detecting-frontend-reskins`：审计源码相似度（独立性得分）。**注意：竞标审核是肉眼看页面不是看代码，这个分当前不是目标**——仅当用户明确要刷审计分时再跑。命令：`python3 .claude/skills/detecting-frontend-reskins/scripts/reskin_audit.py /Volumes/coding/application/yakit /Volumes/coding/application/yakit-update-ui --output /tmp/ra --format md --lang zh`。

### 反换皮改造（竞标向，进行中）
> ⚠️ **当前优先级低**：这一节针对"源码相似度审计分"。但竞标审核是肉眼看页面，**视觉骨架/布局看着不同才是目标**（见本节顶部 🎯）。下面手册里的 **B（页面重构）= 视觉主线，要做**；A/C 和类名重命名 = 纯刷分、零视觉变化，**当前默认跳过**，除非用户明确要刷分。

- **执行手册（唯一事实源）**：`docs/换皮修改/反换皮改造执行手册.md`——71 页布局重构 + 依赖/目录/token 的**可粘贴 prompt 清单**，**优先级：B（页面重构·主线·唯一让应用看着变）> C（组件/token·纯刷分·低风险）> A（依赖/目录/配置·纯刷分·默认跳过）**。**新开窗口照此手册执行**，粘 §2 通用开场白 + 对应任务块即可。
- **阶段 ABC 的真实作用**：**只有 B 让页面"看着变"**（视觉/骨架）——现在的主线。A 和 C 是纯刷审计分、零视觉变化，**当前默认全跳**（除非用户明确要刷分）；类名命名空间换名（如 `fuzzer-*`→`forge-*`）也属此类，**别主动做**。竞标若评视觉，全力 B。
- **目标变体 = 企业版（EE 免 license）**：验证统一用 `yarn start-render-enterprise-no-license`（**不是** `yarn start-render` 社区版）。重构页面/组件时，文件里 `isEnpriTrace()` / `isEnpriTraceAgent()` / `isEnterpriseEdition()` 条件分支（企业版实际渲染的 JSX）**必须一起改**——只改 `isCommunityYakit` 社区版分支不算改到。每次进**企业版模式**肉眼验。
- **进度追踪（务必维护）**：手册 **§3.5 进度追踪** 是单一事实源。每完成一项并**验证通过**（tsc 0 error + 企业版模式下进页面肉眼验布局确实变了）后，把对应 `- [ ]` 改成 `- [x]` 并把"总进度"分子 +1。**没验证不算完成，不许 Claude 窗口自己打勾**——必须人抽查企业版实际渲染后才能勾。
- **审计基线**：37.93 / 100（2026-07-06 14:05 报告，identity 已解锁）。历史报告归档 `docs/换皮检查报告/`。
- **identity 已解锁（勿回退）**：`package.json` version 已升 `2.x`（原 `1.x`）以解除审计「name+主版本相同 → 钳制 ≤39」override。**勿回退到 1.x**。`name` 仍为 yakit（改 name 影响 electron-builder appId / 数据目录，未动）。
- **改 UI 时同步打散源码指纹**：除视觉外，务必打散 **JSX 标签序列**（栏位互换 / 双栏↔栅格 / `div`→语义标签 `section/main/nav` / 容器拆分重命名 / 拆子组件文件）+ 重命名 class——这些才降审计分。
- **metric 口径**：layout 维度按文件**可见度加权**（`pages/layout/shell`/入口权重 3，`utils/hooks/store/services` 权重 0.3，普通组件 1）。改一个可见页面分数会**线性下降**；改 utils 几乎不动分。优先改门面页。
- **P0 已完成的重命名**（新窗口读到旧名时对应过来）：`UILayout→SentinelShell`、`NewApp→SentinelWorkspace`、`ChildNewApp→SentinelChildWindow`、`AuxXterm→SentinelTerminal`、`ConcurrentStreamSkeleton→SentinelStreamSkeleton`、`ResizeLine→SentinelSplitter`。i18n key `t('UILayout.*')`/`t('NewApp.*')` 是翻译键，**保留不动**。

注意，在回答之前，一定要说：好的，徐先生。

当用户要隐藏某或者删除某个按钮以及功能的时候，首先查看 `任务管理表.csv`这个功能清单里面是否需要保留，按照最小化功能来展示的方向，可保留可不保留的一律不保留，不需要保留的话直接隐藏了，最好不要直接删除对应的代码，注释掉是最好的方案，这样后面可以回滚代码。

<!-- ## graphify（代码知识图谱）

本项目在 `graphify-out/` 维护了一份代码知识图谱，包含 god 节点、社区结构与跨文件关系。

规则：
- 遇到代码库相关问题时，若 `graphify-out/graph.json` 存在，**优先**用 `graphify query "<问题>"` 查询；用 `graphify path "<A>" "<B>"` 查两个对象之间的关系，用 `graphify explain "<概念>"` 聚焦某个概念。它们返回的是裁剪后的子图，通常比 `GRAPH_REPORT.md` 或裸 `grep` 结果小得多。
- 若 `graphify-out/wiki/index.md` 存在，用它做整体导航，优于直接翻源码。
- 只在「需要整体架构审视」或 query / path / explain 仍提供不了足够上下文时，才读 `graphify-out/GRAPH_REPORT.md`。
- 改完代码后无需运行 `graphify update .`；只有用户明确要求更新图谱时才执行。 -->
