# Sentinel 视觉重塑 · 阶段 0+1 实现计划

> **面向 AI 实现者：** 开始前必须完整阅读根目录 `AGENTS.md`、设计规格 `docs/superpowers/specs/2026-06-30-sentinel-rebrand-design.md`，并使用 `executing-plans` 按任务执行。每个任务只修改列出的文件，先验证再提交。

**目标：** 在不改变任何业务功能、接口、路由和交互逻辑的前提下，将 Yakit 企业版改造成完整的深空青蓝视觉，并统一弹层、表单、卡片的圆角与间距。

**架构：** 保留 `@yakit-libs/color` 的运行时色阶生成能力，由 `GetMainColor(theme)` 控制主色，在 `applyYakitThemeColors` 中只补充 light / dark 中性表面和历史兼容别名。圆角与间距使用全局 CSS 变量，再分别落到全局 antd 4 覆盖和 yakitUI 模块样式；主 renderer、辅助窗口和 engine-link-startup 保持同步。

**技术栈：** React 18、TypeScript 5、antd 4.21.7、yakitUI、Sass、`@yakit-libs/color`。

**主验收命令：** `yarn dev:full-enterprise-no-license`

---

## 执行约束

1. 直接在当前 `main` 工作，不新建 feature 分支；开始前确认 `git rev-parse --abbrev-ref HEAD` 为 `main`。
2. 当前仓库可能有其他窗口的 WIP。只暂存本任务明确修改的文件，严禁 `git add -A`、`git add .`、`git commit -am`。
3. 颜色只允许硬编码在集中主题覆盖表中；组件和页面样式一律使用 `var(--Colors-Use-*)`。
4. 不删除主题切换，不固定 dark，不创建 `sentinelTheme.ts`，不复制 114 个 token。
5. 不修改 JSX 结构来追求源码差异；仅在圆角必须裁切背景时增加无业务含义的样式类。
6. 不修改 state、props 契约、事件、接口、IPC、路由、权限判断和表单字段顺序。
7. UI 改动必须在企业版实际运行页面中目视验证；仅 `tsc` 通过不等于完成。
8. 完整验证通过后提交并推送 `main`；push 前再次检查分支与暂存范围。

---

## 任务 0：建立视觉基线与变更清单

**文件：** 不修改文件。

### 步骤 1：确认工作区和分支

运行：

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
```

预期：当前分支为 `main`。记录已有修改，后续不得暂存或覆盖无关 WIP。

### 步骤 2：启动企业版完整环境

运行：

```bash
yarn dev:full-enterprise-no-license
```

预期：主 renderer、engine-link-startup 和 Electron 均启动，无新增编译错误。若已有开发进程运行，复用热更新，不重复启动端口。

### 步骤 3：保存改前截图

至少保存以下状态的改前截图，供改后逐一对比：

- 引擎启动页；
- 企业版默认落地页；
- 一个含输入框 / Select / DatePicker 的表单；
- YakitModal；
- `Modal.confirm`；
- right Drawer 与 bottom Drawer；
- Popover、Dropdown、Tooltip、Notification；
- Web Fuzzer、MITM、插件仓库各一张。

AI 实现者具备浏览器或视图能力时必须实际打开页面检查，不允许只读 SCSS 推断效果。

### 步骤 4：记录当前主题变量

在 DevTools Console 运行：

```js
;[
  '--Colors-Use-Main-Primary',
  '--Colors-Use-Basic-Background',
  '--Colors-Use-Neutral-Bg',
  '--Colors-Use-Neutral-Bg-Hover',
  '--Colors-Use-Neutral-Border',
  '--Colors-Use-Neutral-Text-1-Title',
  '--Colors-Use-Basic-Shadow',
].forEach((key) => console.log(key, getComputedStyle(document.documentElement).getPropertyValue(key)))
```

分别记录 light / dark 的输出。此任务不提交。

---

## 任务 1：统一三个窗口的主题注入

**文件：**

- 修改：`app/renderer/src/main/src/utils/envfile.tsx`
- 修改：`app/renderer/src/main/src/utils/applyYakitThemeColors.ts`
- 修改：`app/renderer/engine-link-startup/src/utils/envfile.tsx`
- 修改：`app/renderer/engine-link-startup/src/utils/applyYakitThemeColors.ts`

### 步骤 1：统一所有变体的主色输入

主 renderer 和 engine-link-startup 的 `GetMainColor` 都改为同一个 theme-aware 返回值：

```ts
export const GetMainColor = (themeMode: Theme) => {
  return themeMode === 'dark' ? '#0EA5E9' : '#0284C7'
}
```

不要在此函数内保留 enterprise / IRify / Memfit 的旧橙、紫、蓝分支。本阶段的主题与 yakitUI 是全变体共享视觉，不新增企业版专用条件。

### 步骤 2：把中性色覆盖改成 light / dark 双表

主 renderer 的 `applyYakitThemeColors.ts` 使用以下完整结构。engine-link-startup 使用相同数据和逻辑，仅把 `Theme` 类型写成其本地可用的 `'light' | 'dark'` 或本地 Theme 类型。

```ts
import { applyThemeColors, generateColors } from '@yakit-libs/color'
import type { ColorHex } from '@yakit-libs/color'
import type { Theme } from '@/hook/useTheme'

const VISUAL_THEME_OVERRIDES: Record<Theme, Record<string, string>> = {
  light: {
    '--Colors-Use-Base-Background': '#F4F8FC',
    '--Colors-Use-Basic-Background': '#F4F8FC',
    '--Colors-Use-Neutral-Bg': '#FFFFFF',
    '--Colors-Use-Neutral-Bg-Hover': '#EAF4FB',
    '--Colors-Use-Neutral-Bg-Pressed': '#DCECF7',
    '--Colors-Use-Neutral-Border': '#C8DCEB',
    '--Colors-Use-Neutral-Disable': '#9FB3C8',
    '--Colors-Use-Neutral-Text-1-Title': '#102A43',
    '--Colors-Use-Neutral-Text-2-Primary': '#334E68',
    '--Colors-Use-Neutral-Text-2-Subtitle': '#486581',
    '--Colors-Use-Neutral-Text-2-Body': '#334E68',
    '--Colors-Use-Neutral-Text-3-Secondary': '#627D98',
    '--Colors-Use-Neutral-Text-4-Help-text': '#829AB1',
    '--Colors-Use-Basic-Shadow': 'rgba(16,42,67,0.16)',
    '--Colors-Use-Basic-Modal-bg': 'rgba(7,21,34,0.32)',
  },
  dark: {
    '--Colors-Use-Base-Background': '#0A1929',
    '--Colors-Use-Basic-Background': '#0A1929',
    '--Colors-Use-Neutral-Bg': '#0F1E33',
    '--Colors-Use-Neutral-Bg-Hover': '#142844',
    '--Colors-Use-Neutral-Bg-Pressed': '#16304F',
    '--Colors-Use-Neutral-Border': '#1E3350',
    '--Colors-Use-Neutral-Disable': '#6F879D',
    '--Colors-Use-Neutral-Text-1-Title': '#E6F4FA',
    '--Colors-Use-Neutral-Text-2-Primary': '#B8CDE2',
    '--Colors-Use-Neutral-Text-2-Subtitle': '#B8CDE2',
    '--Colors-Use-Neutral-Text-2-Body': '#B8CDE2',
    '--Colors-Use-Neutral-Text-3-Secondary': '#8FA8BF',
    '--Colors-Use-Neutral-Text-4-Help-text': '#5A7287',
    '--Colors-Use-Basic-Shadow': 'rgba(2,8,23,0.56)',
    '--Colors-Use-Basic-Modal-bg': 'rgba(2,8,23,0.72)',
  },
}

export function applyYakitThemeColors(theme: Theme, mainColorOverride?: string) {
  const colors = {
    ...generateColors(theme, mainColorOverride as ColorHex | undefined),
    ...VISUAL_THEME_OVERRIDES[theme],
  }
  applyThemeColors(theme, colors)
}
```

关键要求：

- 覆盖对象必须在 `generateColors` 之后展开，确保中性色覆盖最终生效。
- 删除现有只针对 dark 的 `applyDeepCyanDarkOverride()` 后置补丁。
- 不改函数签名，确保 `index.tsx` 和 `applyAuxThemeColors.ts` 无需改动。
- 如果 engine-link-startup 不支持 `@/hook/useTheme` 别名，使用其本地类型，不跨 renderer 导入。

### 步骤 3：格式化并做静态验证

运行：

```bash
yarn prettier --write app/renderer/src/main/src/utils/envfile.tsx app/renderer/src/main/src/utils/applyYakitThemeColors.ts app/renderer/engine-link-startup/src/utils/envfile.tsx app/renderer/engine-link-startup/src/utils/applyYakitThemeColors.ts
yarn ci:tsc
(cd app/renderer/engine-link-startup && yarn build-enterprise)
```

预期：主 renderer TypeScript 0 error；engine-link-startup `tsc` 和 Vite enterprise build 成功。

### 步骤 4：运行时验证

分别在 light / dark 查看任务 0 的 token；主窗口、子窗口和引擎启动页主色必须一致。确认 light 不再回到暖橙 / 普通灰白，dark 表面为深蓝层级。

### 步骤 5：提交主题注入改动

只暂存上述 4 个文件：

```bash
git add app/renderer/src/main/src/utils/envfile.tsx \
  app/renderer/src/main/src/utils/applyYakitThemeColors.ts \
  app/renderer/engine-link-startup/src/utils/envfile.tsx \
  app/renderer/engine-link-startup/src/utils/applyYakitThemeColors.ts
git diff --cached --stat
git commit -m "style(theme): unify sentinel color system"
```

---

## 任务 2：建立圆角、间距和阴影变量

**文件：**

- 修改：`app/renderer/src/main/src/theme/yakit.scss`
- 修改：`app/renderer/engine-link-startup/src/theme/yakit.scss`

### 步骤 1：加入全局几何变量

在两个文件顶部增加同一套变量：

```scss
html {
  --Radius-XS: 4px;
  --Radius-Control: 6px;
  --Radius-Input: 8px;
  --Radius-Container: 10px;
  --Radius-Popup: 12px;
  --Radius-Large: 16px;
  --Radius-Pill: 999px;

  --Spacing-1: 4px;
  --Spacing-2: 8px;
  --Spacing-3: 12px;
  --Spacing-4: 16px;
  --Spacing-5: 24px;
  --Spacing-6: 32px;
}
```

### 步骤 2：将 heading 与 MITM 背景中的主题色改为 token

当前 `theme/yakit.scss` 的 heading 和 MITM gradient 仍有硬编码黑 / 白 / 灰。按主题语义替换：

- 标题文字 → `var(--Colors-Use-Neutral-Text-1-Title)`；
- 主画布 → `var(--Colors-Use-Basic-Background)`；
- 半透明渐变确需 rgba 时，优先改为使用背景 token 的纯色终点；不能表达的渐变保留到任务 5 逐项处理，不做机械替换。

### 步骤 3：验证变量可见

热更新后在 DevTools Console 检查：

```js
getComputedStyle(document.documentElement).getPropertyValue('--Radius-Popup')
```

预期：`12px`。

此任务与任务 3-5 一起提交，不单独提交只有变量定义的中间状态。

---

## 任务 3：统一全局 antd 弹层与容器形态

**文件：**

- 修改：`app/renderer/src/main/src/theme/componentsTheme/modal.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/dropdown.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/tooltip.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/notification.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/list.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/card.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/pagination.scss`

### 步骤 1：Modal / Confirm

- `.ant-modal-content` 使用 `border-radius: var(--Radius-Popup)` 和 `overflow: hidden`。
- header / body / footer 不再各自形成冲突外角。
- `.modal-cancel-button`、`.modal-ok-button` 使用 `var(--Radius-Control)`。
- 阴影颜色继续引用 `var(--Colors-Use-Basic-Shadow)`。
- 危险确认态保留 Error 语义，不能统一改 Main。

### 步骤 2：Dropdown / Tooltip / Notification / List popup

- Dropdown、Notification、浮层 List 使用 `var(--Radius-Popup)`。
- Tooltip 使用 `var(--Radius-Control)`，保持紧凑。
- 默认弹层边框统一使用 `Neutral-Border`，背景使用 `Neutral-Bg`。
- 清除只服务旧直角外观的重复 radius，但不要删除与 placement / arrow 有关的规则。

### 步骤 3：Card / Pagination

- Card 外容器使用 `var(--Radius-Container)`；只有需要裁切 header 背景的卡片才加 `overflow: hidden`。
- Pagination item 使用 `var(--Radius-Control)`，不改变页码尺寸、事件和 disabled 逻辑。

### 步骤 4：检查 SCSS 结构

运行：

```bash
for file in app/renderer/src/main/src/theme/componentsTheme/{modal,dropdown,tooltip,notification,list,card,pagination}.scss; do
  printf '%s ' "$file"
  awk 'BEGIN{o=0;c=0}{o+=gsub(/{/,"{");c+=gsub(/}/,"}")}END{print o,c}' "$file"
done
```

预期：每个文件的 `{` 与 `}` 数量相同。

---

## 任务 4：统一 yakitUI 弹窗、抽屉和浮层

**文件：**

- 修改：`app/renderer/src/main/src/components/yakitUI/YakitModal/yakitModal.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitDrawer/YakitDrawer.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitPopover/yakitPopover.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitDropdownMenu/YakitDropdownMenu.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitPopconfirm/YakitPopconfirm.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitHint/YakitHint.module.scss`

### 步骤 1：YakitModal 内外圆角一致

- `.yakit-modal-body` 从固定 `4px` 改为 `var(--Radius-Popup)`。
- 保持 `overflow: hidden`，保证 header / footer 背景不穿出。
- 不修改 `YakitModal.tsx` 的 props、footer 分支、close 事件和按钮行为。

### 步骤 2：YakitDrawer 只处理自由角

按 placement 处理，不允许所有抽屉统一四角圆角：

- right：左上 / 左下 `var(--Radius-Popup)`；
- left：右上 / 右下 `var(--Radius-Popup)`；
- bottom：左上 / 右上 `var(--Radius-Popup)`；
- top：左下 / 右下 `var(--Radius-Popup)`。

如现有 class 无法区分 placement，优先利用 antd 自带 placement class；只有完全无法命中时才在 `YakitDrawer.tsx` 增加纯样式 class，不能改事件。

### 步骤 3：浮层统一

- Popover / DropdownMenu / Popconfirm / Hint 使用 `var(--Radius-Popup)`。
- 箭头背景与 popup 主体一致。
- 保持 overlayClassName、placement 和 children 透传逻辑不变。
- DropdownMenu 当前 `10px` 统一改用变量，不保留孤立硬编码。

### 步骤 4：逐个视觉验证

打开一个 YakitModal、Modal.confirm、四种 placement 中至少两种 Drawer，以及有箭头的 Popover。重点检查：外圆角、背景穿出、阴影裁切、关闭按钮和滚动区域。

---

## 任务 5：统一表单控件圆角与紧凑间距

**文件：**

- 修改：`app/renderer/src/main/src/theme/componentsTheme/input.scss`
- 修改：`app/renderer/src/main/src/theme/componentsTheme/form.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitInput/YakitInput.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitInputNumber/YakitInputNumber.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitSelect/YakitSelect.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitTreeSelect/YakitTreeSelect.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitAutoComplete/YakitAutoComplete.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitCascader/YakitCascader.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitDatePicker/YakitDatePicker.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitForm/YakitForm.module.scss`
- 修改：`app/renderer/src/main/src/components/yakitUI/YakitButton/yakitButton.module.scss`

### 步骤 1：基础控件

- Input / Textarea / Select / TreeSelect / AutoComplete / Cascader / DatePicker / InputNumber 外框统一为 `var(--Radius-Input)`。
- Button 默认使用 `var(--Radius-Control)`；现有显式 pill / round 变体继续保留。
- 控件高度继续使用 `24 / 28 / 32px`，不得统一放大。

### 步骤 2：组合控件

逐条检查以下结构，只圆最外侧边：

- input addonBefore / addonAfter；
- Search 输入 + 按钮；
- InputNumber 输入 + step handler；
- compact group；
- Select 多选 tag；
- Radio button group（如本次修改触达）。

内部接缝保持 `0` radius。不能用一次全局替换把 `0 4px 4px 0` 直接改成四角 `8px`。

### 步骤 3：focus 与校验态

- focus ring：`0 0 0 2px var(--Colors-Use-Main-Focus)`；
- error：继续使用 Error border / Focus；
- disabled：使用 Neutral-Disable 与 Neutral-Bg-Hover；
- readOnly：可与 disabled 区分，且文字可选中、可读。

### 步骤 4：表单间距

- label 与控件之间使用 `var(--Spacing-2)`；
- 表单项纵向间距以 `var(--Spacing-3)` 为基准；
- 小控件同组间距使用 `var(--Spacing-2)`；
- 不对所有 `.ant-form-item` 使用不可控的 `!important` 大 margin。

### 步骤 5：视觉验证

在实际业务表单中检查 default / hover / focus / error / disabled / readOnly，以及 Select / Cascader / DatePicker 展开态。确认没有双圆角、断边、文字垂直不居中和 popup 偏移。

---

## 任务 6：清理高可见残留色与滚动条

**文件：**

- 修改：`app/renderer/src/main/src/theme/scrollbar.scss`
- 按扫描结果修改：`app/renderer/src/main/src/theme/componentsTheme/*.scss`
- 按扫描结果修改：高可见页面对应同名 `.scss` / `.module.scss`

### 步骤 1：扫描旧品牌色与硬编码色

运行：

```bash
rg -n "#F17F30|#f17f30|#ff7a45|#FF7A45" app/renderer/src/main/src app/renderer/engine-link-startup/src --glob '*.{ts,tsx,scss}'
rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(" app/renderer/src/main/src/theme app/renderer/src/main/src/components/yakitUI --glob '*.scss'
```

逐条分类：主题色、状态色、SVG 固有色、语法高亮、图片渐变。只替换主题色残留，不机械替换状态色、SVG 或 Monaco 语法色。

### 步骤 2：滚动条 token 化

`theme/scrollbar.scss` 当前 thumb 使用硬编码灰。改为 Neutral 系列 token，保留宽高与交互面积；圆角改用 `var(--Radius-Pill)`。

### 步骤 3：处理关键页面残留

只处理任务 0 必看页面中肉眼明显破坏新视觉的硬编码颜色。每改一个页面先确认颜色只服务视觉，不触碰 TSX 逻辑。

### 步骤 4：复扫

旧品牌橙在用户可见主题消费者中应为空；允许存在于注释、历史素材、语法高亮或明确的 Warning 语义中，但必须在阶段总结中列出原因。

---

## 任务 7：完整验证、提交与推送

### 步骤 1：格式化本次文件

只对 `git diff --name-only` 中属于本任务的 TS / TSX / SCSS 文件运行项目 prettier，不格式化整个仓库。

示例：

```bash
yarn prettier --write <本任务的精确文件列表>
```

### 步骤 2：静态验证

运行：

```bash
yarn ci:tsc
(cd app/renderer/engine-link-startup && yarn build-enterprise)
git diff --check
```

预期：全部退出码为 0，无新增 TypeScript、Sass 或格式错误。

### 步骤 3：企业版视觉回归

用 `yarn dev:full-enterprise-no-license` 按设计规格第 8 节逐项走查：

- light / dark；
- 主窗口 / 辅助窗口 / 引擎启动页；
- Modal / Confirm / Drawer / Popover / Dropdown / Tooltip / Notification；
- 表单六态；
- Web Fuzzer / MITM / 专项漏洞检测 / 插件仓库 / 软件设置。

每一项与任务 0 截图对比。发现问题先修复并重新执行相关验证，未完成视觉走查不得宣称完成。

### 步骤 4：确认业务行为未变

至少确认：

- Modal 确认 / 取消 / 关闭行为正常；
- Drawer 开关、placement、滚动正常；
- 表单输入、校验、提交正常；
- Select / DatePicker / Cascader 选择正常；
- MITM、Web Fuzzer、插件仓库原交互入口正常；
- Console 无新增 error。

### 步骤 5：审查最终 diff

运行：

```bash
git status --short
git diff --stat
git diff -- app/renderer/src/main/src app/renderer/engine-link-startup/src
```

确认没有业务逻辑、接口、路由、权限或无关文件混入。

### 步骤 6：提交剩余视觉改动

逐个列出本阶段实际修改文件进行 `git add`，不要使用目录级全量暂存：

```bash
git add <本阶段实际修改的精确文件列表>
git diff --cached --stat
git commit -m "style(ui): round popups and form controls"
```

若任务 1 已产生独立 commit，此处只提交任务 2-6 的剩余文件。

### 步骤 7：推送 main

推送前运行：

```bash
git rev-parse --abbrev-ref HEAD
git status --short
git log -2 --oneline
```

确认当前为 `main`、提交范围正确且无应提交未提交文件后：

```bash
git push origin main
```

---

## 失败回退与停止条件

- 如果全局 radius 导致大量组合控件断边，停止继续扩散，恢复该通配规则，改为按组件落地。
- 如果 light / dark 某一模式对比度不足，不通过页面硬编码修补；回到集中主题覆盖表修正。
- 如果需要改 props、事件或 JSX 业务分支才能实现视觉效果，停止并重新选择纯样式方案。
- 如果目标文件存在其他窗口未完成改动，保留其内容；无法安全拆分时暂停该文件并报告冲突。
- 不使用 `git reset --hard`、`git checkout -- <file>` 或其他会覆盖用户 WIP 的命令。

---

## 完成清单

- [ ] light / dark 主色与表面色完整生效
- [ ] 主窗口、辅助窗口、引擎启动页一致
- [ ] antd 与 yakitUI 弹层均为统一圆角
- [ ] 表单控件圆角、间距、六态通过
- [ ] 组合控件无双圆角和断边
- [ ] 高可见旧橙 / 灰黑残留已处理
- [ ] 页面密度、滚动和弹层裁切无回归
- [ ] `yarn ci:tsc` 通过
- [ ] engine-link-startup enterprise build 通过
- [ ] `git diff --check` 通过
- [ ] 企业版实际页面视觉走查通过
- [ ] 仅精确文件被提交并已推送 `main`
