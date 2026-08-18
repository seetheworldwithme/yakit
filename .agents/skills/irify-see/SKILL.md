---
name: irify-see
description: 通过 CDP 读取当前正在运行的 IRify(Electron) 页面——打印 URL/激活域/可见标签/正文摘要、dump 指定选择器的 DOM、并对当前页面截图，从而在不离开终端的情况下"看见"应用当前的真实渲染状态。当用户要求"看看当前页面 / 截个图看看现在的样子 / 读取当前 DOM / 当前页面上 X 显示成什么样 / 改完后帮我看看效果 / 根据现在显示的来调整"等需要观察运行态 UI 的场景时使用。配合 IRify 去品牌化改造做"看页面→改代码→再看页面"的闭环验证。
---

# irify-see — 查看运行中的 IRify 页面

本 skill 调用同目录的 `irify-see.py`（路径 `.agents/skills/irify-see/irify-see.py`），连到 IRify 调试进程的 CDP 端口（9222），把**当前真实运行的页面**变成可读的文本 + 截图。这是做 UI 去品牌改动的"眼睛"——改前看清现状，改后验证效果，不靠猜。

## 前置条件（必须满足，否则脚本报错）

1. **IRify 必须以 debug 命令启动**，才会开放 CDP 9222 端口：
   ```bash
   yarn dev-irify-ee-no-license:debug   # IRify 企业版（免 License），日常调试用这个
   yarn dev-irify:debug                 # IRify 社区版
   ```
   （不要用不带 `:debug` 的命令，那样没有 CDP 端口，脚本连不上。）
2. **应用窗口已打开**且主渲染页（localhost:3000）已加载完成。
3. **Python 依赖**：脚本用到 `websocket-client`。首次报 `ModuleNotFoundError: websocket` 时安装一次：
   ```bash
   pip install websocket-client
   ```

> 注：主进程 `app/main/index.js` 会在**打包版**拦截 `--remote-debugging-port` 等调试开关；dev 模式（未打包）不拦截，`dev-irify:debug` 可正常开放 CDP。

## 呯令

脚本固定从 `.agents/skills/irify-see/irify-see.py` 调用，截图固定输出到脚本同目录 `irify-cdp.png`（gitignore 已忽略）。

| 目的 | 命令 |
|---|---|
| 摘要 + 截图（默认，最常用） | `python3 .agents/skills/irify-see/irify-see.py` |
| 打印完整正文（不截断，用于精读页面文案/结构） | `python3 .agents/skills/irify-see/irify-see.py --full` |
| 额外 dump 某选择器的 outerHTML（前 2000 字符） | `python3 .agents/skills/irify-see/irify-see.py --dom '.ant-tabs-tab-active'` |

> 路径提示：脚本里 CDP 地址 `http://127.0.0.1:9222` 为硬编码，截图路径为脚本同目录。改这两处到脚本顶部常量即可。

## 标准工作流程

### 1. 看清当前页面（改前）
- 先跑默认命令拿到 **URL / 激活域 / 标签 / 正文摘要**，确认现在停在哪个页面、哪个标签。
- 用 **Read 工具打开截图 `irify-cdp.png`**（Read 能直接看图）。截图是肉眼最准的依据，文字摘要用于定位。
- 需要精确定位某块结构时，用 `--dom '<选择器>'` dump 它的 outerHTML，再对应到源码文件。

### 2. 定位 + 改代码
- 根据截图 + DOM + 正文里的关键文案，在 `app/renderer/src/main/src/` 里定位目标文件。
- 改动遵守根目录 `AGENTS.md` 的去品牌化指南：隐藏优先于删除、共享文件用 `isIRify()` 守卫、其它版本分支原样保留、无分号单引号风格。
- 去品牌验证重点：截图里搜 Yakit / yak / IRify / 四维 / megavector 字样与 logo 图形。

### 3. 验证（改后）
- 保存代码后，dev 进程热更新——**稍等 1–2 秒**让页面重渲染。
- 再次 `python3 .agents/skills/irify-see/irify-see.py` + Read 截图，对比改动前后，确认效果符合预期、没有崩布局。
- 不符则回到第 2 步，**不要靠猜**，永远以最新截图为准。

## 常见报错排查

| 报错 | 原因 / 处理 |
|---|---|
| `连不上 CDP(127.0.0.1:9222)` | 没用 `:debug` 命令启动，或应用没起来。用 `yarn dev-irify-ee-no-license:debug`（企业版）或 `yarn dev-irify:debug`（社区版）重启。 |
| `没找到 :3000 主页面 target` | 渲染进程没加载完，或窗口未显示。等应用完全打开后再跑。 |
| `ModuleNotFoundError: No module named 'websocket'` | `pip install websocket-client`。 |
| 截图还是旧画面 | 热更新未完成。等几秒重跑，或 Read 截图前确认文件时间戳已更新。 |

## 与 browser-use 的关系
- **irify-see**：轻量只读探针——一次性拿摘要 + 截图 + DOM，适合高频的"改前看/改后验"闭环，不干扰用户正在操作的窗口。
- **browser-use**：交互式浏览器自动化（点击/输入/导航）——适合需要主动操作流程（如登录、切换页面、走完整业务路径）的场景。本项目是 Electron 客户端，browser-use 无法直接接管 Electron 窗口，日常 UI 验证以 irify-see 为主、browser-use 为辅（如需验证渲染端独立页面 http://127.0.0.1:3000 时可用）。
