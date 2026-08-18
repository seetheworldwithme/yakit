# Yakit 项目启动指南（Agent 背景文件）

本文件为所有 AI Agent（及新开发者）提供项目启动所需的背景知识。
阅读本文件后，你应能独立完成依赖安装与本地开发环境的启动。

## 项目信息

Yakit 是一个基于 Electron + React 的跨平台桌面应用，主要技术栈包括 Electron、React、TypeScript 等。项目通过 Vite 构建渲染端，使用 Yarn 作为包管理器。

## 项目结构

项目由三部分组成：

| 模块 | 路径 | 作用 | 端口 |
| --- | --- | --- | --- |
| Electron 主进程 | `app/main/` | 入口 index.js，承载窗口、IPC、gRPC | - |
| 主渲染端 | `app/renderer/src/main/` | Vite 8 MPA 主界面 | `3000` |
| Link 渲染端 | `app/renderer/engine-link-startup/` | 引擎链接启动页 | `5173` |

> 主进程在开发模式下会分别加载：
> - 主窗口：`http://127.0.0.1:3000`（`app/main/index.js:247`）
> - 引擎链接窗口：`http://127.0.0.1:5173`（`app/main/index.js:143`）
>
> 因此**两个渲染端都必须成功启动后，才能启动 Electron 主进程**，否则窗口会白屏。

## 前置要求

- Node.js（版本以团队约定为准，仓库暂未提供 `.nvmrc`）
- Yarn（本项目使用 `yarn` 作为包管理器，根目录已提供 `yarn.lock`）
- macOS（Apple Silicon / M 芯片）如遇到原生依赖编译失败，可参考 `ELECTRON_GUIDE.md` 执行：
  ```bash
  brew install pkg-config pixman cairo pango
  ```
- 如需从国内镜像安装 Electron，可先 `source ./electron.env` 设置镜像源。

## 依赖安装

项目共有三个需要安装依赖的子项目，**务必按顺序全部安装**：

```bash
# 1. 根目录（Electron 主进程相关依赖，含 electron、electron-builder、concurrently、wait-on 等）
yarn install

# 2. 主渲染端（Vite 8）
yarn install-render
# 等价于：cd app/renderer/src/main && yarn install

# 3. Link 渲染端（Vite）
yarn install-link-render
# 等价于：cd app/renderer/engine-link-startup && yarn install
```


## 启动开发环境

> 开发模式下 Electron 主进程会分别加载主窗口 `http://127.0.0.1:3000` 与引擎链接窗口 `http://127.0.0.1:5173`，因此**两个渲染端都必须先成功启动**，再启动 Electron，否则对应窗口会白屏。

### 启动前依赖检查（重要）

启动项目前，先检查本地依赖是否与仓库一致（尤其是 `git pull` 之后，别人可能新增或升级了依赖）：

```bash
yarn check-deps
```

- 若提示「未安装依赖」：按提示先完成上文「依赖安装」三步曲。
- 若提示「依赖可能有更新」：**使用 `AskUserQuestion` 工具向用户弹选项框确认**是否重新安装对应子项目的依赖，而不是在回复里用文字描述选项让用户再答一遍。选项示例：
  - `重装全部依赖`（按顺序执行 `yarn install` / `yarn install-render` / `yarn install-link-render`）
  - `仅重装有改动的子项目`（按 check-deps 提示的列表）
  - `跳过，直接启动`
- 若提示「依赖一致」：进入启动步骤。但若用户提到最近 `git pull` 过而未重装（见下文「常见问题排查」的盲区），**使用 `AskUserQuestion` 工具弹选项框**询问是否仍重跑依赖三步曲。

> 通用规则：**凡涉及需要用户决策的环节（是否重装依赖、启动哪个版本、是否跳过某步等），一律优先用 `AskUserQuestion` 工具弹出选项框让用户一键选择，不要在回复里用文字罗列选项让用户再答一遍。**

### 启动步骤

> 若用户未指定启动哪个版本，**使用 `AskUserQuestion` 工具弹选项框**让用户选择版本，不要默认替用户决定。
>
> ⚠️ `AskUserQuestion` 每个问题最多只能放 4 个选项（外加自动提供的「Other」自定义输入），而项目共有 6 个版本（见「多版本/多平台变体」表），无法一次性全部展示。采用**分层弹框**策略：
>
> 1. **第一层弹框**：选项只放 4 个主版本——`Yakit`（默认）、`enterprise`（企业版）、`irify`（IRify 社区版）、`memfit`（AI 精简版）。question 文本中完整列出全部 6 个版本名，提示 `simple-enterprise` 与 `irify-enterprise` 会根据后续选择追问。
> 2. **第二层弹框（按需追问）**：
>    - 若用户在第一层选了 `enterprise`，再弹一次选项框，让用户在 `enterprise`（企业版 EE）与 `simple-enterprise`（便携 / 简易企业版 SE）之间二选一。
>    - 若用户在第一层选了 `irify`，再弹一次选项框，让用户在 `irify`（IRify 社区版）与 `irify-enterprise`（IRify 企业版）之间二选一。
>    - 若用户选了 `Yakit` 或 `memfit`，无需追问，直接确定。
> 3. 这样既不超出工具单次 4 选项上限，又能覆盖全部 6 个版本，且用户全程点选、无需手动输入「Other」。

先同时启动两个渲染端（:3000 主渲染端 + :5173 Link 渲染端）：

```bash
yarn start-renders
# 等价于：concurrently "yarn start-render" "yarn start-link-render"
```

待两个渲染端**真正就绪**后，再启动 Electron 主进程：

```bash
yarn start-electron
```

> ⚠️ **重要：必须确认渲染端「真正就绪」后再启动 Electron，否则窗口会白屏。**
>
> 端口进入 LISTEN 状态 ≠ 渲染端加载完成。Vite / CRA 的 dev server 端口会很快开始监听，但此时首次编译可能尚未结束，Electron 此时加载会拿到不完整的页面导致白屏。
>
> 必须按以下两步确认就绪：
>
> 1. **端口检查**：确认 `3000` 与 `5173` 端口均在监听。
>    ```bash
>    lsof -i :3000 -sTCP:LISTEN
>    lsof -i :5173 -sTCP:LISTEN
>    ```
>
> 2. **内容轮询**：用 `curl` 轮询，直到两端都返回 HTTP 200 且响应体包含有效内容（如 `<script` 或 `<div id="root"`），才说明首次编译完成、页面真正可访问。
>    ```bash
>    # 轮询直到主渲染端（:3000）就绪
>    until curl -s http://127.0.0.1:3000 | grep -qE '<script|<div id="root"'; do sleep 2; done
>
>    # 轮询直到 Link 渲染端（:5173）就绪
>    until curl -s http://127.0.0.1:5173 | grep -qE '<script|<div id="root"'; do sleep 2; done
>    ```
>
> 两端都通过上述检查后，再执行 `yarn start-electron`。

## 多版本/多平台变体

> 依赖安装步骤与版本无关，请先按上文「依赖安装」完成；版本差异只体现在下面的启动 / 构建 / 打包命令上。

项目通过 `--mode` / `env-cmd` 环境切换支持多个发行版本。开发时如无特殊需求，使用默认模式即可。

版本由渲染端注入的 env 决定（主渲染端 `REACT_APP_PLATFORM`、Link 渲染端 `VITE_PLATFORM`），**Electron 主进程不区分版本**，它只加载当前已运行的渲染端地址。

| 版本（脚本后缀） | 产品名 | 性质 | 本地引擎端口 | 同时启动两渲染端 | 构建两渲染端 | 对应平台打包 |
| --- | --- | --- | --- | --- | --- | --- |
| 默认 | Yakit | 社区版 CE | `9011` | `yarn start-renders` | `yarn build-renders` | `pack-mac` / `pack-win` / `pack-linux` |
| `-enterprise` | EnpriTrace | 企业版 EE | `9012` | `yarn start-renders-enterprise` | `yarn build-renders-enterprise` | `pack-*-ee` |
| `-simple-enterprise` | EnpriTraceAgent | 便携 / 简易企业版 SE | `9013` | `yarn start-renders-simple-enterprise` | `yarn build-renders-simple-enterprise` | `pack-*-se` |
| `-irify` | IRify | IRify 社区版 | `9014` | `yarn start-renders-irify` | `yarn build-renders-irify` | `pack-*-irify` |
| `-irify-enterprise` | IRifyEnpriTrace | IRify 企业版 | `9015` | `yarn start-renders-irify-enterprise` | `yarn build-renders-irify-enterprise` | `pack-*-irify-ee` |
| `-memfit` | Memfit AI | AI Agent 精简版 | `9016` | `yarn start-renders-memfit` | `yarn build-renders-memfit` | `pack-*-memfit` |

> 也可以只启动单个渲染端：主渲染端用 `yarn start-render-<后缀>`，Link 渲染端用 `yarn start-link-render-<后缀>`（默认版本无后缀）。

### 启动某个版本（非默认版本无一键 dev）

```bash
# 1. 同时启动该版本的两个渲染端（:3000 主渲染端 + :5173 Link 渲染端）
yarn start-renders-enterprise        # 以企业版为例，其它版本见上表

# 2. 按上文「启动步骤」中的两步法确认两个渲染端真正就绪（端口监听 + curl 拿到有效内容）后，启动 Electron 主进程
yarn start-electron
```

### 各版本功能差异（概要）

- **默认 / Yakit**：完整社区版基线，所有功能开放。
- **enterprise / EnpriTrace**：企业版，使用企业 token、企业远端配置、独立的企业数据库 `company-default-yakit.db`。
- **simpleEE / EnpriTraceAgent**：便携 / 简易企业版，隶属企业系（`isEnterpriseOrSimpleEdition()` 为 true）。
- **irify / IRify**：IRify 社区版，紫色主题，含 `irifyHome`、`irifyAiCodeAudit`（AI 代码审计）等专属页面。
- **irifyEnterprise / IRifyEnpriTrace**：IRify 的企业版分支。
- **memfit / Memfit AI**：面向 AI Agent 的精简版，菜单与界面元素最多精简（大量 `!isMemfit()` 守卫）。

## 构建渲染端产物

若需打包发布，需先构建两个渲染端的静态产物，再执行 electron-builder：

```bash
# 构建两个渲染端（默认版本）
yarn build-renders
# 等价于：run-s build-render build-link-render

# 之后使用对应平台的打包命令，例如 macOS：
yarn pack-mac
```

## 常见问题排查

> 当用户带着启动 / 编译报错来询问时，**第一步应先跑 `yarn check-deps` 排查是否由依赖问题引起**，再去看具体报错。
>
> ⚠️ 注意 `yarn check-deps` 的盲区：它通过 `git diff HEAD -- yarn.lock` 判断依赖是否更新，**只能检测工作区未提交的 yarn.lock 改动**。若用户刚 `git pull` 拉到了别人**已提交**的新 yarn.lock 但没重新 `yarn install`，此时新 lock 已进 HEAD，`git diff HEAD` 为空，脚本会误报「依赖一致」而实际 `node_modules` 已滞后。
>
> 因此：**若用户最近 `git pull` 过但没重新安装依赖，即便 `check-deps` 报「依赖一致」，也应使用 `AskUserQuestion` 工具弹选项框**询问用户是否按顺序重跑依赖安装三步曲（`yarn install` / `yarn install-render` / `yarn install-link-render`）后再启动，而不是在回复里用文字描述让用户再答一遍。

- **窗口白屏 / `ERR_CONNECTION_REFUSED`**：对应渲染端未就绪。注意端口监听 ≠ 加载完成，需按「启动步骤」用 `curl` 轮询确认两端返回有效 HTML 后再启动 Electron。
- **启动 / 编译报错（模块找不到、API 报错、语法报错等）**：优先 `yarn check-deps` 排查依赖是否一致；结合上述盲区判断是否需要重装依赖。
- **M1 芯片原生依赖编译失败**：执行 `brew install pkg-config pixman cairo pango`。
- **Electron 下载慢 / 失败**：`source ./electron.env` 后重试。
- **端口被占用**：确认没有残留的 vite / electron 进程，必要时 `lsof -i :3000` / `lsof -i :5173` 排查。

## 代码规范

- 强制使用 LF 换行符。
- 缩进为 2 个空格。
- 代码不使用分号，使用单引号。
- 遵循项目中的 `.prettierrc.js` 和 `.editorconfig`。

### 编码行为准则

旨在减少 LLM 编码中常见错误的行为准则，可与项目特定指令合并使用。

**权衡：** 本准则倾向于"谨慎优于速度"。对于简单任务，请自行判断。

#### 1. 先思考再编码

**"不要假设。不要隐藏困惑。呈现权衡。"**

实现之前：

- 明确陈述假设；如果不确定，就提问。
- 当存在多种理解时，逐一列出而非默默选择。
- 如果存在更简单的方案，直接说明并在必要时提出异议。
- 如果有不明白的地方，停下来指出困惑之处，然后提问。

#### 2. 简洁优先

**"用最少的代码解决问题。不做臆测性编码。"**

- 不实现超出需求的特性。
- 不为仅使用一次的代码做抽象。
- 不添加未经要求的"灵活性"或"可配置性"。
- 不处理不可能发生的错误场景。
- 如果你写了 200 行但 50 行就够了，那就重写。

自检："资深工程师会觉得这过于复杂吗？" 如果是，就简化。

#### 3. 精准改动

**"只改必须改的。只清理自己制造的遗留。"**

编辑现有代码时：

- 不要"改善"相邻的代码、注释或格式。
- 不要重构没有问题的代码。
- 风格优先级：**项目显式代码规范 > 当前文件既有风格 > 个人习惯**。若既有代码与上文「代码规范」冲突，以显式规范为准。
- 如果发现无关的废弃代码，提出来而不是直接删除。

当你的改动产生了孤立的代码时：

- 移除因你的改动而变得未使用的 import/变量/函数。
- 不要移除之前就存在的废弃代码，除非被明确要求。

检验标准："每一行改动都应该能追溯到用户的请求。"

#### 4. 目标驱动执行

**"定义成功标准。循环验证直到通过。"**

将任务转化为可验证的目标：

- "添加校验" → 构造一个非法输入，验证被拦截；而非先去搭建测试基建
- "修复 Bug" → 先复现 Bug 现象，改后再验证现象消失
- "重构 X" → 确认重构前后原有行为不变（手动验证或已有测试通过）

> 注：项目已有 Vitest（含 CI `ci-vitest`）。验证时优先跑/更新邻近已有测试；没有现成测试时再手动复现。不要为一次性验证引入新的测试框架或测试依赖。

对于多步骤任务，简要列出计划：

```
1. [步骤] → 验证：[检查方式]
2. [步骤] → 验证：[检查方式]
3. [步骤] → 验证：[检查方式]
```

"明确的成功标准让你可以独立循环迭代。" 模糊的标准如"让它能用"则需要不断确认。

## 关键脚本速查

**公共命令（与版本无关）**：

| 命令 | 作用 |
| --- | --- |
| `yarn install` | 安装根目录依赖 |
| `yarn install-render` | 安装主渲染端依赖 |
| `yarn install-link-render` | 安装 Link 渲染端依赖 |
| `yarn start-electron` | 启动 Electron 主进程（不区分版本） |
| `yarn check-deps` | 检查本地依赖是否与仓库一致（启动前执行） |

**各版本启动 / 构建 / 打包**（默认版本无后缀；后缀取值见「多版本/多平台变体」表）：

| 命令模式 | 作用 |
| --- | --- |
| `yarn start-renders[-<后缀>]` | 同时启动两个渲染端（:3000 + :5173） |
| `yarn start-render[-<后缀>]` | 仅启动主渲染端（:3000） |
| `yarn start-link-render[-<后缀>]` | 仅启动 Link 渲染端（:5173） |
| `yarn build-renders[-<后缀>]` | 构建两个渲染端静态产物 |
| `yarn build-render[-<后缀>]` | 仅构建主渲染端 |
| `yarn build-link-render[-<后缀>]` | 仅构建 Link 渲染端 |
| `yarn pack-mac[-<后缀>]` / `pack-win[-<后缀>]` / `pack-linux[-<后缀>]` | 对应平台打包 |

> 版本后缀对照：默认（无） / `-enterprise`（EE，打包为 `pack-*-ee`）/ `-simple-enterprise`（SE，`pack-*-se`）/ `-irify`（`pack-*-irify`）/ `-irify-enterprise`（`pack-*-irify-ee`）/ `-memfit`（`pack-*-memfit`）。

---

# IRify 去品牌化开发指南（feat/irify-debrand 分支专用）

> 本分支的核心需求：**把 IRify 版本页面上的 irify、yak / Yakit、四维（MegaVector / megavector.cn）等品牌元素（logo、品牌文案、官网外链等）从界面上移除**，重塑为「智能化代码安全检测与验证系统」——电科院品牌、国网绿主题色、无既有品牌印记的全新产品。本文是该需求的代码编写指南，后续所有编码工作以本节为准。

## 分支与远程

- 分支：`feat/irify-debrand`（基于 upstream `master` `3a79d4bd4` 切出）
- 远程：`debrand` → `https://github.com/seetheworldwithme/yakit.git`（本分支 push/pull 均走此远程）
- `origin` 仍指向上游 `yaklang/yakit`，仅用于同步上游更新，**不要把本分支 push 到 origin**

```bash
git push -u debrand feat/irify-debrand   # 首次推送
```

## 改动范围（做什么）

只处理「用户在界面上能看到/点击到」的品牌元素，按优先级分四类：

1. **Logo 图片与图标**：页面上任何位置渲染的 Yakit / yak / IRify 自身 / 四维相关 logo（PNG、SVG、iconfont 自定义 Icon、favicon、任务栏/窗口图标）。
2. **品牌文案**：界面标题、关于页、启动页上出现的「Yakit」「yaklang」「四维」「MegaVector」「yaklang.com」等产品/公司名展示（注意：`YakitForm`、`YakitButton` 等组件库前缀属于代码命名，**不在范围内**，见下文原则 2）。产品名展示的**中枢**在 `utils/envfile.tsx` 的 `getReleaseEditionName()`——改这里一处即可覆盖大多数标题/文案，改完再全局 grep 剩余硬编码点。
3. **品牌外链**：`WebsiteGV` 中指向 yaklang.com、megavector.cn 等官网/关于我们/帮助文档的入口（按钮、菜单项、登录页链接）——直接隐藏入口，而不是只改 URL。
4. **窗口/安装包元信息**：`document.title`、HTML `<title>` / `meta description` / favicon、electron-builder 的 `productName` 等用户可见元信息。

### ⚠️ 两个功能性陷阱（改不好会卡死启动/装不上）

1. **软件更新检查**：启动页（Link 渲染端）会向 yaklang 服务器检查 Yakit 软件更新。若本地版本号与线上不一致，会弹**强制升级弹窗并阻塞启动**，且弹窗本身就是 Yakit 品牌暴露点。需让 IRify 版本跳过启动时更新检查（参考落点：`engine-link-startup/src/pages/StartupPage/components/LocalEngine/index.tsx`，SE 版已有跳过先例可对照；升级弹窗 `components/layout/update/DownloadYakit.tsx` 一并处理）。
2. **安装器脚本**：electron-builder 之外还有 NSIS 安装脚本（`build/` 下的 `.nsh`）可能含 yakit 品牌文案与「迁移 yakit-projects」等提示，打包前需一并检查。

## 不做什么（负面清单）

- **不重命名代码标识符**：`yakitUI` 组件库、`YakitXxx` 组件名、`yak` 开头的函数/IPC 通道/文件名保持原样。本需求是「视觉去品牌」，不是代码级重命名，避免海量无意义 churn。
- **不破坏功能**：去掉 logo 后布局不能塌陷（占位尺寸、flex 布局要跟手调整）；与引擎通信、升级检测等使用 yaklang 字样的**内部 IPC / 协议逻辑**不动。
- **不动其它版本的构建**：默认版 / enterprise / memfit 等其它 5 个版本理论上仍应可构建。共享代码中的品牌展示点优先用 `isIRify()`（`app/renderer/src/main/src/utils/envfile.tsx`）守卫，仅 IRify 路径下去品牌；IRify 专属文件可直接改。

## 品牌触点地图（已勘察，改动时按图索骥）

> 用 `rg -i "yakit|yaklang|irify|megavector|四维"` 可复核，以下为主要落点：

### 资产文件

| 位置 | 内容 |
| --- | --- |
| `app/assets/` | 打包用 logo：`yakitlogo.*`、`yakiteelogo.*`、`yakitselogo.*`、`memfitlogo.*`、`irify-close.png` 等（由 `packageScript/electron-builder.config.js` 按 PLATFORM 挑选） |
| `app/renderer/src/main/public/` | `favicon.ico`、`yaklogo.png`、`icons/icon.png`、`icons/favicon.svg` |
| `app/renderer/src/main/src/assets/yakitLogo.png` | 主渲染端 Yakit logo，被 `FuncDomain.tsx`、插件模板等多处引用 |
| `app/renderer/engine-link-startup/src/assets/` | `YakitLogo.png`、`IRifyLogo.png`、`yakitEE*`、`yakitSE*`、`irify-right.png` 等启动页品牌图 |

### 代码落点（主渲染端 `app/renderer/src/main/src/`）

| 文件 | 作用 |
| --- | --- |
| `utils/envfile.tsx` | 版本判定（`isIRify()`）与产品名映射，去品牌守卫的基础设施 |
| `utils/logo.ts` | `YakLogoData` 内联 SVG 图形数据 |
| `enums/website.ts` | `WebsiteGV`：`OfficialWebsite`（yaklang.com）、`AboutUsWebsite`（megavector.cn）等外链枚举 |
| `components/layout/FuncDomain.tsx` | 左侧导航/主框架，引用 `YakitLogo`、`WebsiteGV`（版本历史等入口） |
| `components/layout/HelpDoc/HelpDoc.tsx` | 帮助文档入口，跳转 yaklang 文档与关于我们 |
| `components/layout/update/DownloadYakit.tsx` | 升级弹窗中的官网地址展示 |
| `assets/newIcon.tsx`（`YakitLogoSvgIcon`）、`assets/icons.tsx`（`OfficialYakitLogoIcon`） | SVG 形式的 logo 图标组件 |
| `pages/irifyHome/` | IRify 专属首页（本分支的主战场之一） |
| `pages/softwareSettings/SoftwareSettings.tsx` | 设置页用 `YakitLogoSvgIcon` 做图标 |
| `pages/plugins/*funcTemplate*.tsx`、`baseTemplate.tsx` | 插件卡片默认 icon 兜底用 Yakit logo |
| `newApp/NewApp.tsx:304` 附近 | 动态设置 `document.title`（`app-html-title`） |
| `index.html` | `<meta name="description" content="Yakit">`、favicon 引用、初始 title |

### 代码落点（Link 渲染端 `app/renderer/engine-link-startup/src/`）

| 文件 | 作用 |
| --- | --- |
| `pages/StartupPage/index.tsx` | 启动页主体，引用 `irifyRight`、`IRifyLogo` 等品牌图 |
| `pages/StartupPage/components/YakitLoading/` | 加载动画品牌元素 |
| `pages/StartupPage/components/UpdateYakitHint/` | 升级提示品牌文案 |
| `App.tsx:17` 附近 | 启动窗口 title 设置 |
| `index.html` | `<title>Loading...</title>` 与 favicon |

### 主进程与打包配置

| 文件 | 作用 |
| --- | --- |
| `app/main/index.js` | 窗口创建、标题栏 close 按钮图片（`yakit-close.png` / `irify-close.png`）、`yakit-window-state.json` 等用户可见产物名；**打包版拦截调试开关的逻辑不动**（dev 不受影响） |
| `packageScript/electron-builder.config.js` | `case 'irify'` / `case 'irifyEE'`：`productName: 'IRify'/'IRifyEnpriTrace'`、`appId: 'io.yaklang.irify'`、图标文件挑选 |
| `packageScript/.env-cmdrc` | `IRify: { PLATFORM: "irify" }` 等模式注入（机制本身不动，仅知晓） |
| `build/` 下 NSIS `.nsh` 安装脚本 | 安装界面文案（yakit 品牌字、yakit-projects 迁移提示等），打包前检查 |

## 改动手法约定

1. **「隐藏」优先于「删除」**：品牌展示点优先用条件渲染（`isIRify() ? null : <原内容>`）或**注释掉**（便于回滚）的方式处理；确属 IRify 专属且无复用价值的资产可直接删除引用。目的是控制 diff 规模、保持可回溯。
2. **占位而非留洞**：logo 移除后若布局依赖其尺寸（如侧边栏顶部、卡片角标），保留等尺寸空白占位或调整布局，验收标准是「看起来本来就没有」，而不是「这里被抠掉了一块」。
3. **新品牌电科院**：本分支的目标品牌是**电科院**，logo 源图为 `app/assets/brand/电科院LOGO.jpg`。替换时按「品牌资产与替换策略」一节执行，禁止再展示 Yakit / IRify / 四维相关图形。
4. **守卫用现成 API**：`import { isIRify } from '@/utils/envfile'`，不要自己解析 env。

### 品牌资产与替换策略（电科院 logo）

**源图**：`app/assets/brand/电科院LOGO.jpg`（2512×521 横版组合 logo，JPEG **白底无透明通道**）。这是唯一品牌源图，**不要在页面/打包配置里直接引用这张 jpg**——它有白底、比例极宽，直接用会在深色背景处露白边、在方形图标槽位里变形。

**派生图生成约定**（用 `sips` / 预览 / Figma 等工具从源图派生，派生图放 `app/assets/brand/` 下，命名带用途）：

| 用途 | 派生要求 | 建议落位 |
| --- | --- | --- |
| 界面横版 logo（侧边栏顶/登录页/启动页） | **透明背景 PNG**（抠掉白底），保留完整图文组合，按槽位比例缩放 | `app/assets/brand/diankeyuan-logo.png` |
| 深色背景用横版 | 同上，且文字/图形须为浅色可读（源图为深色图文则直接可用；若不可读需出深色版） | `app/assets/brand/diankeyuan-logo-dark.png` |
| 方形图标（favicon、安装包/任务栏图标、窗口图标） | 从源图**裁出图形部分**（或居中放完整 logo 加留白），导出多尺寸（16/32/64/128/256/512 及 `.ico` / `.icns`）。注意：**打包用 `diankeyuan.ico` 的各帧须合成不透明白底**（Windows 桌面/任务栏图标透明背景不美观）；favicon 等 in-app PNG 仍用透明底 | `app/assets/brand/diankeyuan-icon-*.png` → 再转 `.ico` / `.icns` |

**替换落点**（按上文触点地图，把 Yakit/IRify logo 的引用改为指向派生图，`isIRify()` 守卫只影响 IRify 路径）：

1. 主渲染端：`components/layout/FuncDomain.tsx`（侧边栏 `YakitLogo`）、`pages/Login.tsx` 等登录页、插件模板默认 icon 兜底、`public/favicon.ico`。
2. Link 渲染端（启动页）：`pages/StartupPage/index.tsx`（`IRifyLogo` / `irifyRight` 等）。
3. 打包图标：`packageScript/electron-builder.config.js` 的 `case 'irify'` / `case 'irifyEE'` —— 不要覆盖 `yakitsslogo*` 等共享文件（SE 版共用会波及），改为新增电科院图标文件并把 `files` 与图标路径指过去。
4. 窗口图标/标题栏：`app/main/index.js` 引用的图标路径（按需指到新图标）。

**验收**：每个替换点用 irify-see 截图确认——白底不外露、不变形、深色主题下可读；`yarn build-renders-irify` 构建通过。

### 主题色：国网绿

- **取色依据**：电科院 logo 的主色系为**深青绿色**（像素统计峰值 `#005858`，向亮处过渡到 `#478989`）。
- **国网绿定义**（本分支沿用）：**主色 `#00A860`（国网绿标准色）**；与 logo 深青 `#005858` 同属绿系但更明快，作为 UI 强调色可读性更好。
- **改法（总闸，一处生效）**：`utils/envfile.tsx` 的 `GetMainColor(theme)`——当前 IRify 返回紫色（dark `#B081FF` / light `#6A44A9`），改为返回国网绿（建议 dark `#2BD588` / light `#00A860`，light/dark 用同一主色也可，以 irify-see 实测对比度为准）。`index.tsx` 会经 `applyYakitThemeColors` → `@yakit-libs/color` 的 `generateColors` 生成全套 `--Colors-Use-Main-*` token 注入，**改返回值即可，不要去逐个改 CSS 里的颜色**。
- **注意**：`GetMainColor` 是**全变体共享**的 switch——只改 `case 'irify'` / `case 'irify-enterprise'` 两个分支，其它版本（yakit 橙 / memfit 蓝）的返回值**原样保留**。
- **图表配色**：ECharts 等图表默认取色若仍显示旧紫色，属页面级重配范围，改时用 irify-see 逐页核实。
- **Link 渲染端（启动页）主题色**：`engine-link-startup/src/utils/theme.ts` 有独立的主题定义，需同步检查是否需要跟随改绿。
- **验收**：light/dark 双主题下，侧边栏选中态、按钮、链接、focus 态、图表主色均为国网绿系；无紫色残留（`rg -i "B081FF|6A44A9"` 的硬编码点单独排查，含 SCSS）。

### 产品名：智能化代码安全检测与验证系统

- **改法（中枢，一处生效）**：`utils/envfile.tsx` 的 `getReleaseEditionName()`——`IRify` case 返回 `'智能化代码安全检测与验证系统'`，`IRifyEnpriTrace` case 返回 `'智能化代码安全检测与验证系统'`（企业版可带后缀，如「（企业版）」，到时按需定）。
- **⚠️ 注意：名字不only是文案，还是跨进程查找键**。`getReleaseEditionName()` 的返回值会被传给主进程，作为以下两处的 **map 查找键**，改了字符串但没同步这些键会导致版本检查/升级下载 fallback 到 Yakit 社区版逻辑：
  - `app/main/uiOperate/yaklangAndYakit.js:57` 与 `app/main/newUiOperate/yaklangAndYakit.js:57` 的 `versionFetchers` 表：`'IRify-EnpriTrace': fetchLatestYakitIRifyEEVersion`（还有 `'IRify'`、`'Yakit'` 等键同理）
  - 传递链路：Link 渲染端 `pages/StartupPage/grpc.ts` 调 `getReleaseEditionName()` → IPC `fetch-latest-yakit-version` → 主进程按名字查表
- **处理规则**：改 `getReleaseEditionName()` 的 IRify 两个 case 时，**同步**修改主进程两个 `yaklangAndYakit.js` 里 `versionFetchers` 的对应键（新旧键都保留亦可：把新产品名也映射到 `fetchLatestYakitIRifyEEVersion` / `fetchLatestYakitIRifyVersion`，旧键暂留不删，便于回滚）。
- **`app/main/handlers/utils/network.js:300` 的 `IRifyEE.name: 'IRifyEnpriTrace'` 不改**——它用于拼 OSS 升级包下载 URL（`.../svip/{version}/IRifyEnpriTrace-{version}-...dmg`），是 yaklang 服务器上的真实文件名，改了会 404。
- **注意**：`getReleaseEditionName` 是**全变体共享**的 switch，只改 IRify 两个 case，其它版本返回值不动。**Link 渲染端有同名函数**（`engine-link-startup/src/utils/envfile.tsx:19` 的 `getReleaseEditionName`，同样返回 `'IRify-EnpriTrace'`），启动页的提示文案用它的返回值（如「未关闭{产品名}再次连接引擎」），**两处都要改**。
- **改完后全局 grep 硬编码**：`rg -n "IRify" app/renderer/src/main/src app/renderer/engine-link-startup/src`（排除 `isIRify()` 等代码标识符），页面上残留的「IRify」/「IRify-EnpriTrace」展示文案逐个处理（启动页、关于、登录页、`document.title` 等）。
- **短名/标题场景**：产品名较长，`document.title`、窗口标题、启动页大标题等空间受限处可用短名「智能代码安全检测」或按截图实测调整，避免截断换行。
- **验收**：界面标题、窗口标题、启动页、登录页等处不再出现「IRify」「IRify-EnpriTrace」字样；`rg` 展示文案级残留为零；启动页版本检查仍走 IRify EE 通道（控制台无 fallback 到 Yakit 的迹象）。

## 改 UI 的标准操作流程（SOP）

> 适用于「隐 logo / 隐品牌文案 / 隐入口」等高频改动。准则：**改得准、不崩、可回滚**。

### 改前：探查要全

1. **读全目标文件**（含同名 `.scss`）再动手，不凭片段猜结构。
2. **查全「定义点 + 消费点」**：菜单 / 路由 / 标签 / 图标这类「一处定义多处消费」的，先 `rg` 全部引用再改（如顶级标签由钉住 + 启动开页双驱动）。**漏一处就残影**。
3. **先区分「隐入口」vs「删功能」**：隐入口 = 保留路由 + 页面，只去展示入口；删功能 = 连路由 / 页面一起删，删前必须做依赖扫描（`rg "YakitRoute.Xxx|openPage|onMenu"`）。本分支以**隐入口**为主。

### 改时：外科式 + 保兼容

1. **外科式 Edit**，不整文件重写；优先保留未触及的 JSX 分支（复制大段 JSX 易出错）。
2. **共享文件保兼容**：`Home.tsx` / `newRoute.tsx` / `MainOperatorContent.tsx` / `FuncDomain.tsx` 等是**全变体共享**。IRify 之外其它版本（社区版 / EE / SE / memfit）的 JSX 分支**原样保留，勿删勿改**——品牌点用 `isIRify()` 守卫只影响 IRify 路径。
3. **只动 UI 不动逻辑**：保留 state / 事件 / 接口 / 路由。
4. **隐入口要改全所有定义处**（双驱动的两处都改，否则一边残影）。

### 改后：清理 + 验证（三板斧）

1. **tsc**（权威）：`cd app/renderer/src/main && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
2. **grep 残留**：扫已隐去/已删标识符的残留引用（应为空）
3. **SCSS 配平**：若动了 `.scss`，查花括号配平（`{` 数 == `}` 数）
4. 删 `export` 前全仓 grep 确认无外部引用；顺手清只服务已隐 JSX 的 state / handler / import（删前确认全文件仅 1 处引用）。

## 开发调试与闭环验证

### 启动 IRify（dev）

```bash
yarn dev-irify                        # 社区版 dev：起 IRify 两渲染端 + Electron
yarn dev-irify:debug                  # 同上，Electron 开 CDP 9222（供 irify-see 连接）
yarn dev-irify-ee-no-license          # IRify 企业版（免 License）dev
yarn dev-irify-ee-no-license:debug    # 同上，开 CDP 9222 —— 常用调试命令
```

> 企业版 no-license 的原理：主渲染端 env 多注入 `REACT_APP_REQUIRE_ENTERPRISE_LICENSE=false`（复用 `enterpriseNoLicense` env 段），跳过 `EnterpriseJudgeLogin` 的 License 校验页；Link 端与普通 IRify EE 相同。IRify EE 属企业系（`isEnterpriseEdition()` 为 true），走企业登录/独立企业数据库路径。
>
> 日常改 UI 用 `:debug` 一步到位：渲染端热更新 + CDP 可连。主进程只在**打包版**拦截 `--remote-debugging-port`，dev 模式不拦截。
> 等价手动方式：`yarn start-render-irify-enterprise-no-license` + `yarn start-link-render-irify-enterprise`，待 :3000 与 :5173 就绪（端口监听 + curl 出有效 HTML）后 `yarn start-electron:debug`。

### irify-see skill（改前看 / 改后验的眼睛）

```bash
python3 .agents/skills/irify-see/irify-see.py            # 摘要 + 截图（默认）
python3 .agents/skills/irify-see/irify-see.py --full     # 完整正文
python3 .agents/skills/irify-see/irify-see.py --dom SEL  # dump 选择器 outerHTML
```

闭环流程：**irify-see 看现状 → 改代码 → 热更新稍等 1–2 秒 → irify-see 再看 + Read 截图对比**。不靠猜，以最新截图为准。截图与正文里重点搜 Yakit / yak / IRify / 四维 / megavector 字样与 logo。

> browser-use 仍可用但为辅：本项目是 Electron 客户端，browser-use 无法接管 Electron 窗口；仅在验证渲染端独立页面（http://127.0.0.1:3000）或需要交互式走流程时使用。

## 进度追踪

去品牌改动跨多批次/多会话，进度以 `docs/irify-debrand-progress.md`（勾选清单）为单一事实源：每完成一项并**人工验证通过**（截图确认 + 三板斧通过）后打勾，未验证不算完成。首批清单条目即下方「验证方式」的检查项。

## 验证方式

每完成一批改动，用 debug 方式启动走一遍冒烟（详见上文「开发调试与闭环验证」）：

```bash
yarn dev-irify:debug
```

检查清单（同时是 `docs/irify-debrand-progress.md` 的首批条目）：

- [ ] 启动页（Link 渲染端）：无 Yakit / IRify logo、无品牌文案与外链
- [ ] 主界面：侧边栏、首页（irifyHome）、设置页、关于/帮助入口无任何品牌痕迹
- [ ] 窗口标题、任务栏图标、favicon 无品牌信息
- [ ] 抽查插件商店卡片、升级弹窗、登录/用户菜单等次级页面
- [ ] 功能冒烟：引擎连接、页面切换、打开 Web Fuzzer 等核心路径不报错
- [ ] `yarn build-renders-irify` 构建通过（提交前必跑）

## 提交约定

- 遵循仓库既有 commit 风格（中文、简短、如 `fix: ...` / 功能描述），可用 `/commit-msg` skill 生成。
- 按触点分批提交（如「启动页去品牌」「主界面导航去品牌」「打包元信息」），便于回溯与 review。
