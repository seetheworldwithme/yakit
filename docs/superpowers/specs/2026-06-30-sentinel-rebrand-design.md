# Sentinel 视觉重塑规格（配色、间距与圆角）

- **初稿日期**：2026-06-30
- **代码复核与收敛日期**：2026-07-17
- **状态**：已按当前代码复核，可作为实现依据
- **主验收变体**：Yakit 企业版（`enterprise-no-license`）
- **共享影响范围**：社区版 / 企业版 / IRify / Memfit / EnpriTrace 共用的主题与 yakitUI
- **代码范围**：`app/renderer/src/main/src/`、`app/renderer/engine-link-startup/src/`

> 本文只定义视觉层改造：颜色、表面层级、间距、圆角、边框、阴影和交互状态。不改变业务功能、接口、路由、状态管理、菜单结构或页面信息架构。

---

## 0. 文档定位与优先级

这次目标不是继续做布局骨架、品牌替换或功能裁剪，而是让当前 Yakit 企业版仅通过视觉系统就与原企业版形成明显差异，同时保持全部功能和交互不变。

发生冲突时按以下顺序判断：

1. 当前仓库代码与根目录 `AGENTS.md`；
2. 本规格；
3. `docs/superpowers/plans/2026-06-30-sentinel-rebrand-phase0-1.md`；
4. 早期 Sentinel 文档中的旧结论。

`docs/功能改造方案.md` 仍负责更大范围的页面骨架与信息架构改造；其中与布局、品牌、类名重命名相关的内容不属于本次实施范围。

---

## 1. 目标与非目标

### 1.1 目标

- 将原有暖橙品牌感替换为“深空青蓝”视觉：冷色主操作、深蓝中性色、清晰的表面层级。
- light / dark 两种模式都拥有完整的冷色体系，切换后不能退回原来的橙色或灰黑观感。
- 弹窗、确认框、下拉层、气泡、通知、抽屉和表单控件统一圆角与边框语言。
- 调整局部内边距和组件间距，让界面更整洁，但维持安全工具需要的高信息密度。
- 所有颜色由主题注入或 `var(--Colors-Use-*)` 提供，页面和组件消费者不散落新的 `#hex` / `rgb(a)`。
- 企业版主窗口、辅助窗口、引擎启动页视觉一致。
- 仅通过截图即可看出它不是原 Yakit 企业版的原始视觉主题。

### 1.2 非目标

- 不修改 state、store、接口、IPC、事件、路由、权限和业务判断。
- 不移动菜单、重排页面骨架、不改变表单字段顺序和数据流。
- 不删除 light / dark 切换，不强制用户只能使用 dark；主题能力保持原样。
- 不改产品名、Logo、favicon、窗口标题或用户可见业务文案。
- 不为了“看起来不同”改类名、目录名、DOM 标签序列或依赖。
- 不引入 antd 5 theme token；项目仍使用 antd 4.21.7。
- 不创建 `theme/sentinelTheme.ts`，因为当前仓库不存在该文件，也不需要复制整套 114 个语义 token。
- 不把所有元素都做成大圆角，不增加大面积霓虹发光，不降低表格和编辑器的信息密度。

---

## 2. 当前代码事实（实现者必须先理解）

### 2.1 主题注入链

主窗口真实链路：

```text
app/renderer/src/main/src/index.tsx
  → GetMainColor(theme)
  → applyYakitThemeColors(theme, mainColor)
  → generateColors(theme, mainColor)
  → applyThemeColors(...)
  → document.documentElement CSS variables
```

辅助窗口通过 `app/renderer/src/main/src/auxWindow/utils/applyAuxThemeColors.ts` 复用同一个 `applyYakitThemeColors`。

引擎启动页是独立 renderer，拥有自己的：

- `app/renderer/engine-link-startup/src/utils/envfile.tsx`
- `app/renderer/engine-link-startup/src/utils/applyYakitThemeColors.ts`
- `app/renderer/engine-link-startup/src/theme/yakit.scss`

它不会自动继承主 renderer 的改动，必须同步。

### 2.2 `@yakit-libs/color` 的真实行为

- `generateColors(theme, mainColorOverride)` 当前生成约 247 个 CSS 变量。
- `mainColorOverride` 会修改 `--yakit-colors-Main-*` 色阶。
- `--Colors-Use-Main-*` 虽由语义生成器产生，但值引用 `var(--yakit-colors-Main-*)`，所以 `GetMainColor(theme)` 的主色覆盖**确实有效**。
- 因此，不需要维护一份完整 114-token 固定表；那会复制 npm 包职责，并在包升级后发生漂移。
- 中性背景、文字、遮罩和阴影不是由主色决定，仍需在 `applyYakitThemeColors.ts` 中按 light / dark 做小范围语义覆盖。

### 2.3 当前已存在但不完整的改造

- 主 renderer 的企业版主色已返回 `#0EA5E9`。
- dark 模式在 `applyYakitThemeColors.ts` 中只覆盖了少量深蓝中性色。
- light 模式仍主要使用生成器默认中性色，未形成完整的 Sentinel 视觉。
- 引擎启动页企业版主色仍为 `#116a77`，与主窗口不一致。
- 当前绝大多数控件圆角为 `4px`，部分输入组合、抽屉和窗口容器为 `0`。
- `YakitModal` 本体和全局 `.ant-modal-*` 同时参与渲染，只改其中一处会出现外层和内容层圆角不一致。
- 仓库既有 yakitUI 包装组件，也有直接调用 antd 的页面；全局 antd 覆盖和 yakitUI 样式必须同时处理。

### 2.4 兼容别名

以下变量不是当前颜色包的标准输出，但仓库中已有消费者，应由主题覆盖表继续提供，不能因为“包里没有”而删掉：

- `--Colors-Use-Neutral-Bg-Pressed`
- `--Colors-Use-Neutral-Text-2-Subtitle`
- `--Colors-Use-Neutral-Text-2-Body`

---

## 3. 视觉方向：深空青蓝

视觉关键词：冷静、专业、深蓝工作台、低饱和表面、电光青主操作、细描边、克制阴影。

### 3.1 主色

| 模式 | 主色输入 | 用途 |
|---|---:|---|
| light | `#0284C7` | 主按钮、选中、链接、焦点边框 |
| dark | `#0EA5E9` | 主按钮、选中、链接、焦点边框 |

Hover / Pressed / Focus / Border 色阶继续由 `@yakit-libs/color` 根据主色生成，不在组件中手写第二套色阶。

### 3.2 表面与文字覆盖

这些值只允许出现在集中主题表中；组件消费者必须引用语义 token。

| 语义 token | light | dark | 用途 |
|---|---:|---:|---|
| `--Colors-Use-Basic-Background` | `#F4F8FC` | `#0A1929` | 应用画布、主内容底 |
| `--Colors-Use-Base-Background` | `#F4F8FC` | `#0A1929` | 兼容已有页面别名 |
| `--Colors-Use-Neutral-Bg` | `#FFFFFF` | `#0F1E33` | 卡片、面板、弹层主体 |
| `--Colors-Use-Neutral-Bg-Hover` | `#EAF4FB` | `#142844` | hover、次级抬升表面 |
| `--Colors-Use-Neutral-Bg-Pressed` | `#DCECF7` | `#16304F` | pressed、选中底 |
| `--Colors-Use-Neutral-Border` | `#C8DCEB` | `#1E3350` | 默认边框、分隔线 |
| `--Colors-Use-Neutral-Disable` | `#9FB3C8` | `#6F879D` | 禁用文字、图标和控件边界 |
| `--Colors-Use-Neutral-Text-1-Title` | `#102A43` | `#E6F4FA` | 标题、主要正文 |
| `--Colors-Use-Neutral-Text-2-Primary` | `#334E68` | `#B8CDE2` | 次级正文 |
| `--Colors-Use-Neutral-Text-2-Subtitle` | `#486581` | `#B8CDE2` | 兼容别名、栏目副标题 |
| `--Colors-Use-Neutral-Text-2-Body` | `#334E68` | `#B8CDE2` | 兼容别名、页面正文 |
| `--Colors-Use-Neutral-Text-3-Secondary` | `#627D98` | `#8FA8BF` | 描述、标签、辅助文字 |
| `--Colors-Use-Neutral-Text-4-Help-text` | `#829AB1` | `#5A7287` | 占位、帮助、弱提示 |
| `--Colors-Use-Basic-Shadow` | `rgba(16,42,67,.16)` | `rgba(2,8,23,.56)` | 弹层阴影 |
| `--Colors-Use-Basic-Modal-bg` | `rgba(7,21,34,.32)` | `rgba(2,8,23,.72)` | 遮罩层 |

### 3.3 状态色

成功、警告、错误、严重程度色必须保留语义，不统一染成主色：

- 成功继续使用绿色；
- 警告继续使用琥珀色；
- 错误 / 高危继续使用红色；
- 信息与链接使用蓝 / 青；
- 禁止把错误按钮改成主色，禁止把中危和低危改成相同颜色。

状态色本身若无对比度问题，优先继续使用颜色包现有输出，避免无必要的全量 token 覆盖。

### 3.4 对比度

- 正常文本与背景对比度目标不低于 `4.5:1`。
- 18px 以上或 14px 粗体大文本不低于 `3:1`。
- 输入框边界、选中态和键盘焦点必须肉眼可辨。
- disabled 仍需可读，但不能与正常态同等突出。
- 不以阴影或颜色作为唯一状态表达；保留图标、文字、边框或形态差异。

---

## 4. 几何与间距系统

在全局主题样式中集中定义几何变量，消费者不继续散落新的 `4px / 8px / 12px`：

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

### 4.1 圆角分级

| 对象 | 规则 |
|---|---|
| Checkbox、小 Tag、状态点 | `4px`；圆形 / pill 语义保持原状 |
| Button、Tab 激活块、Tooltip | `6px` |
| Input、Textarea、Select、DatePicker、InputNumber | `8px` |
| Card、表单分区、Table 外容器 | `10px` |
| Modal、Confirm、Popover、Dropdown、Notification | `12px` |
| 大型欢迎卡 / 登录卡 | 最多 `16px`，不得扩散到普通控件 |

### 4.2 组合控件例外

- Input.Group、Search、InputNumber、Radio.Button 等组合控件只圆最外侧四角。
- 组合控件内部相邻边保持 `0` 圆角，避免出现双圆角缝隙。
- Table 单元格、树节点、代码编辑器内部行不逐项加圆角。
- 抽屉贴合视口的一侧保持直角，只给暴露在内容区的自由角加 `12px`。
- Modal 内容容器必须 `overflow: hidden`，避免 header / footer 背景穿出圆角。

### 4.3 间距规则

- 保留现有 small / middle / large 控件高度 `24 / 28 / 32px`，不把整个产品放大。
- 表单 label 与控件间距使用 `8px`；表单项纵向间距以 `12px` 为基准。
- 同组按钮间距 `8px`；不同功能组之间 `12px` 或 `16px`。
- 小弹窗 header / footer 水平内边距 `16px`，内容 `16px`。
- 大弹窗 header / footer 水平内边距 `24px`，内容 `24px`。
- 页面卡片间距默认 `12px`，一级分区之间最多 `16px`。
- 不在全局 `.ant-form-item` 上盲目增加大 margin；先处理 yakitUI 和组件主题层，再按页面修正异常。

---

## 5. 弹层与表单组件规范

### 5.1 Modal / Confirm

- `.ant-modal-content`、YakitModal 的 `.yakit-modal-body` 使用同一个 `12px` 圆角。
- 内容层使用 `Neutral-Bg`，header / footer 使用同体系的抬升表面，靠 `Neutral-Border` 分隔。
- 阴影使用 `var(--Colors-Use-Basic-Shadow)`，不在组件中写新的 rgba。
- 关闭按钮 hover 使用 Main-Hover，危险确认按钮仍使用 Error。
- 小弹窗不使用夸张光晕；focus ring 只出现在真实可交互元素上。

### 5.2 Drawer

- 保留 placement、宽高、关闭逻辑和拖拽相关事件。
- right drawer 只圆左上 / 左下；left drawer 只圆右上 / 右下；bottom drawer 只圆左上 / 右上。
- header、body、边框和阴影与 Modal 属于同一表面体系。

### 5.3 Popover / Dropdown / Select popup / Tooltip

- Popover、Dropdown、Select 下拉、Cascader、TreeSelect、AutoComplete 使用 `10-12px` 圆角。
- 弹层边框统一使用 `Neutral-Border`，表面使用 `Neutral-Bg` 或 `Neutral-Bg-Hover`。
- 箭头颜色与弹层主体一致；不能出现白色箭头贴在深蓝内容上的情况。
- Tooltip 比业务弹层更紧凑，使用 `6px` 圆角和较小 padding。

### 5.4 Form controls

- Input / Textarea / Select / DatePicker / InputNumber 的默认圆角统一为 `8px`。
- hover、focus、error、warning、disabled、readOnly 必须分别检查，不能只验证默认态。
- focus 使用主色边框 + `0 0 0 2px var(--Colors-Use-Main-Focus)`，不使用常驻发光。
- Form 本身是布局容器，不给整张表单无条件套圆角；只有有背景 / 边框的表单分区才用 `10px`。
- 校验信息和帮助文字不能因为新颜色而降低可读性。

---

## 6. 实现架构与文件边界

### 6.1 主题数据入口

- 主色：修改两个 renderer 各自的 `utils/envfile.tsx::GetMainColor(theme)`。
- 中性色 / 兼容别名：修改两个 renderer 各自的 `utils/applyYakitThemeColors.ts`。
- light / dark 结构性样式和几何变量：修改两个 renderer 各自的 `theme/yakit.scss`。
- 主窗口与辅助窗口必须共用主 renderer 的注入函数，不为 aux 再复制一份色板。

推荐把覆盖表合并进 `generateColors` 的返回结果后一次性交给 `applyThemeColors`，而不是先注入再用多次 `root.style.setProperty` 补丁式覆盖。

### 6.2 组件样式入口

- 全局 antd 4：`app/renderer/src/main/src/theme/componentsTheme/*.scss`。
- yakitUI：`app/renderer/src/main/src/components/yakitUI/` 下对应模块样式。
- 全局滚动条 / 标题等：`theme/scrollbar.scss`、`theme/yakit.scss`。
- 页面级遗留硬编码只在确实造成视觉残留时处理，且放在对应页面同名 scss 中。

### 6.3 变体规则

主题和 yakitUI 是共享基础设施，本次不新增“仅企业版才圆角”的条件分支。所有变体保持相同视觉语言；企业版 `enterprise-no-license` 是主验收环境，其他变体做烟雾验证。

---

## 7. 明确删除的旧方案

以下早期方案不再作为本阶段实施要求：

- 固定纯 dark 并移除主题切换；
- 新建 `theme/sentinelTheme.ts` 并复制 114 个固定 token；
- 将品牌名全部改为 Sentinel；
- 改 Logo、favicon、窗口标题；
- 将顶部菜单改为左侧栏；
- 重构 `MainOperator` / `HeardMenu` / `PublicMenu` 布局；
- 为源码相似度重命名类名或拆组件；
- 用大面积主色 glow 作为默认阴影；
- 为了圆角而改变 Drawer / Modal / Form 的业务 DOM 和事件逻辑。

这些内容与“仅调整配色、间距、圆角”不一致，若未来需要，应另建独立计划。

---

## 8. 验收矩阵

### 8.1 必看页面

- 启动 / 引擎连接页；
- 首页或企业版默认落地页；
- Web Fuzzer；
- MITM；
- 专项漏洞检测；
- 插件仓库；
- 软件设置 / 项目管理。

### 8.2 必看组件

- YakitModal、antd Modal.confirm；
- YakitDrawer（right / bottom 至少各一个）；
- Popover、Dropdown、Tooltip、Notification；
- Select / Cascader / TreeSelect / AutoComplete 下拉层；
- Input、Textarea、Search、InputNumber、DatePicker；
- Button、Card、Table、Tabs、Tag；
- 表单校验的 default / hover / focus / error / disabled / readOnly 状态。

### 8.3 通过标准

1. 主操作与激活态无原 Yakit 暖橙残留。
2. light / dark 都形成冷色表面层级，文字与边框清晰。
3. 主窗口、辅助窗口、引擎启动页主色一致。
4. Modal / Confirm / Popover / Dropdown / Notification 不再呈现直角外壳。
5. 表单控件统一圆角，组合控件没有双圆角或断边。
6. 抽屉贴边关系正确，没有四个角全部悬空的错误效果。
7. 页面密度未明显降低，没有因 padding 变大导致按钮换行、表单溢出或表格分页被挤压。
8. 无新增业务逻辑差异、控制台错误、白屏或弹层裁切。
9. TypeScript、格式检查和视觉走查均通过。

---

## 9. 风险与处理

| 风险 | 原因 | 处理 |
|---|---|---|
| 只改 yakitUI，裸 antd 仍直角 | 仓库存在两类调用 | 同时修改 `componentsTheme` 与 yakitUI |
| Modal 外圆内直 | antd content 与自定义 body 双层 | 两层使用同一 radius，并检查 overflow |
| light 模式看起来仍像原版 | 当前只覆盖 dark 中性色 | 为 light 建立完整冷色覆盖 |
| 启动页与主窗口不同色 | 独立 renderer | 同步 engine-link-startup 主题入口 |
| 全局 padding 造成布局回归 | 页面密度高、历史样式多 | 只调整组件内部与明确分组，不做通配符式扩距 |
| 圆角裁掉下拉 / 阴影 | 父级 overflow 误用 | 只在 Modal / Card 等需要裁边的容器使用 overflow |
| token 名存在历史别名 | 页面引用了颜色包未输出的名称 | 在集中覆盖表保留兼容别名 |
| 颜色替换误伤 SVG / 语法高亮 | 不是所有 hex 都是主题色 | 逐条分类，禁止机械全仓替换 |

---

## 10. 完成定义

完成不是“改了主色”或“把 `4px` 改成 `12px`”，而是：主题注入链正确、两种模式完整、三类窗口一致、弹层与表单形态统一、关键状态可读、页面密度保持、业务行为零变化，并通过企业版实际页面视觉检查。
