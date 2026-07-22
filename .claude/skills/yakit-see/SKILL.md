---
name: yakit-see
description: 通过 CDP 读取当前正在运行的 Yakit(Electron/Sentinel) 页面——打印 URL/激活域/可见标签/正文摘要、dump 指定选择器的 DOM、并对当前页面截图，从而让 Claude Code 在不离开终端的情况下"看见"应用当前的真实渲染状态。当用户要求"看看当前页面 / 截个图看看现在的样子 / 读取当前 DOM / 当前页面上 X 显示成什么样 / 改完后帮我看看效果 / 根据现在显示的来调整"等需要观察运行态 UI 的场景时使用。配合 ui-tweak / sentinel-rebrand 做"看页面→改代码→再看页面"的闭环验证。
---

# yakit-see — 查看运行中的 Yakit 页面

本 skill 调用同目录的 `yakit-see.py`（路径 `.claude/skills/yakit-see/yakit-see.py`），连到 Yakit 调试进程的 CDP 端口（9222），把**当前真实运行的页面**变成 Claude 可读的文本 + 截图。这是在 Claude Code 里做 UI 改动的"眼睛"——改前看清现状，改后验证效果。

## 前置条件（必须满足，否则脚本报错）

1. **Yakit 必须以 debug 命令启动**，才会开放 CDP 9222 端口：
   ```bash
   yarn run dev:full-enterprise-no-license:debug
   ```
   （不要用不带 `:debug` 的命令，那样没有 CDP 端口，脚本连不上。）
2. **应用窗口已打开**且主渲染页（localhost:3000）已加载完成。
3. **Python 依赖**：脚本用到 `websocket-client`。首次报 `ModuleNotFoundError: websocket` 时安装一次：
   ```bash
   pip install websocket-client
   ```

## 命令

脚本固定从 `.claude/skills/yakit-see/yakit-see.py` 调用，截图固定输出到 `/tmp/yakit-cdp.png`。

| 目的 | 命令 |
|---|---|
| 摘要 + 截图（默认，最常用） | `python3 .claude/skills/yakit-see/yakit-see.py` |
| 打印完整正文（不截断，用于精读页面文案/结构） | `python3 .claude/skills/yakit-see/yakit-see.py --full` |
| 额外 dump 某选择器的 outerHTML（前 2000 字符） | `python3 .claude/skills/yakit-see/yakit-see.py --dom '.ant-tabs-tab-active'` |

> 路径提示：脚本里 CDP 地址 `http://127.0.0.1:9222`、截图路径 `/tmp/yakit-cdp.png` 均为硬编码，改这两处到脚本顶部常量即可。

## 标准工作流程

### 1. 看清当前页面（改前）
- 先跑默认命令拿到 **URL / 激活域 / 标签 / 正文摘要**，确认现在停在哪个页面、哪个标签。
- 用 **Read 工具打开 `/tmp/yakit-cdp.png`** 看截图（Claude Code 的 Read 能直接看图）。截图是肉眼最准的依据，文字摘要用于定位。
- 需要精确定位某块结构时，用 `--dom '<选择器>'` dump 它的 outerHTML，再对应到源码文件。

### 2. 定位 + 改代码
- 根据截图 + DOM + 正文里的关键文案，用 Grep/Glob 在 `app/renderer/src/main/src/` 里定位目标文件（如 `pages/Login.tsx`）。
- 改动遵守 `CLAUDE.md`：优先 yakitUI、样式写同名 `.scss`、只动 UI 不动逻辑、无分号风格。
- 这一步可叠加 `ui-tweak`（单页微调）或 `sentinel-rebrand`（系统性换皮）skill 的方法。

### 3. 验证（改后）
- 保存代码后，dev 进程热更新——**稍等 1–2 秒**让页面重渲染。
- 再次 `python3 .claude/skills/yakit-see.py` + Read 截图，对比改动前后，确认效果符合预期、没有崩布局。
- 不符则回到第 2 步，**不要靠猜**，永远以最新截图为准。

## 常见报错排查

| 报错 | 原因 / 处理 |
|---|---|
| `连不上 CDP(127.0.0.1:9222)` | 没用 `:debug` 命令启动，或应用没起来。用 `yarn run dev:full-enterprise-no-license:debug` 重启。 |
| `没找到 :3000 主页面 target` | 渲染进程没加载完，或窗口未显示。等应用完全打开后再跑。 |
| `ModuleNotFoundError: No module named 'websocket'` | `pip install websocket-client`。 |
| 截图还是旧画面 | 热更新未完成。等几秒重跑，或 Read 截图前确认文件时间戳已更新。 |

## 与其他 skill 的关系
- **ui-tweak**：单页面/组件 UI 微调的方法论——本 skill 提供"看"，ui-tweak 提供"改"。
- **sentinel-rebrand**：系统性换皮改造——同样用本 skill 做改前/改后的视觉核验。
- 典型闭环：`yakit-see`(看现状) → `ui-tweak`/`sentinel-rebrand`(改代码) → `yakit-see`(验效果)。
