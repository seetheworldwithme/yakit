---
name: ui-tweak
description: 在 yakit 前端（React + antd4 + yakitUI + Sass）里，根据自然语言或截图微调页面布局与组件样式。当用户要求"调整 / 修改 / 优化 / 美化某个页面或组件的布局、间距、颜色、尺寸、排版、显隐"等 UI 微调时使用。标准流程：定位组件 → 优先用 yakitUI → 改同名 scss → 遵守无分号风格 → 列出改动并提示预览。
---

# ui-tweak — yakit 前端 UI 微调

本 skill 针对 yakit 渲染进程（`app/renderer/src/main/src/`）的 UI 微调任务，保证改动**准确、最小、符合项目规范**。项目背景与约定见根目录 `CLAUDE.md`。

## 工作流程

### 1. 澄清与定位（准确性最关键的一步）
- 向用户索取：**目标页面 / 组件的文件路径**（如 `pages/Login.tsx`）+ **当前截图**（或期望效果截图 / 文字描述）。
- 若用户只给模糊描述（如「登录页表单太挤」），先用 Grep / Glob 定位候选文件，读关键片段确认后再动手。**不要凭猜测改文件。**
- 若提供了截图，用图像理解确认具体元素与位置，再对应到代码。

### 2. 动手前确认范围
- 明确「只改 UI」：布局、间距、尺寸、颜色、排版、显隐、响应式。
- **不改动** state、事件处理、接口调用、业务逻辑。
- 若诉求实际需要改逻辑，先停下来说明，不要擅自扩大改动范围。

### 3. 修改原则（遵守项目规范）

> **颜色走 Sentinel token**：本项目为 Sentinel 纯深色主题（主色 `#0EA5E9`、深底 `#0A1929`）。所有颜色用 `var(--Colors-Use-*)`，**禁止**硬编码 `#hex` / `rgba`；需要新色值查 `@/theme/sentinelTheme.ts` 或 spec 第 3.2 节，不要引入浅色背景。详见 CLAUDE.md「Sentinel 换皮规范」。

1. **优先 yakitUI**：需要按钮 / 弹窗 / 输入框 / 表单 / 标签页 / 抽屉等时，先用 `@/components/yakitUI/` 下对应组件（`YakitButton`、`YakitModal`、`YakitInput`、`YakitForm`、`YakitTabs`、`YakitDrawer`、`YakitSelect` …），保持视觉一致，不混用裸 antd。
2. **样式写同名 scss**：`Foo.tsx` → 同目录 `Foo.scss`（已有则直接改；没有则新建并 `import './Foo.scss'`）。组件级样式优先在这里维护，而非堆砌内联 `style`。
3. **antd 4 深度定制**：用 `:global` 选择器或自定义类名覆盖，**不要**使用 antd 5 的 ConfigProvider token（本项目是 antd 4.21.7）。
4. **代码风格**：无分号、单引号、JSX 双引号、2 空格、行宽 120、箭头函数参数加括号、末尾逗号。
5. **最小改动**：只写达成目标所需的最少代码，不顺手重构、不重命名、不调整无关代码。

### 4. 路径与状态
- 路径别名 `@/` → `app/renderer/src/main/src/`。
- 状态用 zustand（`@/store`），UI 微调通常不涉及。

### 5. 收尾
- 列出改动文件清单（`新增` / `修改`），逐处说明改了什么、为什么。
- 给出预览方式：根目录 `yarn start-render`（保存即热更新），建议用户截图回看效果再迭代。
- 启动企业版的方式`yarn dev:full-enterprise`
- 启动企业版无 license 的方式`arn dev:full-enterprise-no-license`
