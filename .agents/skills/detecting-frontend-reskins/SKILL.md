---
name: detecting-frontend-reskins
description: Use when comparing two frontend projects to detect whether they are a trivial reskin of the same codebase (same skeleton/layout/visual system, only surface text/icons changed), e.g. before submitting two same-origin products to a bid where they must read as independently developed. Scores a 100-point independence score, flags same-origin identity, and emits a prioritized, point-recoverable remediation backlog to iterate toward the bid-safe line.
---

# Detecting Frontend Reskins (Bid Independence Audit)

## When to use

- 两个前端项目要判断是否「简单换皮」（保留骨架/配色/布局，只改文案/图标）。
- **两款同源产品参加竞标**前自检：迭代到两款产品「看不出同源、像独立开发」，达到竞标安全线（独立性 ≥70）。
- 已有换皮分支（如 Sentinel rebrand），想看还差多少分、先改哪里收益最大。

## Core idea

**独立性得分（0–100，越高越安全）**：100=完全独立，0=完全相同。检测到同源重叠即扣分。

- **≥70** ✅ 完全独立项目（竞标安全区，目标）。
- **40–69** ⚠️ 存在部分复用痕迹。
- **≤39** ❌ 高度疑似换皮（禁止竞标）。

**身份 override**：git origin 相同，或 package name + 主版本相同 → 总分钳制 ≤39（竞标方一眼可见，必须先改包名 / 切 git 远端 / 拆仓库）。

完整评分模型见 `references/scoring-model.md`（唯一事实源）。

## Required workflow

1. **确认两个项目根目录**。缺失就问用户要绝对路径。
2. **跑分析器**（从本技能目录执行）：

   ```bash
   python3 .agents/skills/detecting-frontend-reskins/scripts/reskin_audit.py \
     /path/to/project-a /path/to/project-b \
     --output /tmp/reskin-audit --format both --lang zh \
     --source-label "产品A" --target-label "产品B"
   ```

   - 默认中文报告；加 `--lang en` 出英文简版。
   - 默认权重 骨架 25 / 布局 30 / 视觉 25 / 逻辑 20，安全线 ≥70。改用 `--config config.json`（见 `references/scoring-model.md` §11）。

3. **读 Markdown 报告**（`reskin-audit-report.md`）；JSON 仅在需要机读/原始子指标时看。

4. **把结果讲成「迭代待办清单」**：
   - 当前独立性 / 等级 / 是否达 ≥70 安全线。
   - 同源身份铁证是否命中（命中必须先改身份）。
   - 按可回收分排序的 Top 改动——先做哪几项最划算。
   - 最大可回收 vs 距安全线差值 → 是否可行。

5. **落盘到 docs**（统一放 `docs/换皮检查报告/`）：

   ```bash
   mkdir -p "docs/换皮检查报告"
   cp /tmp/reskin-audit/reskin-audit-report.md "docs/换皮检查报告/换皮检测报告-$(date +%Y-%m%d).md"
   ```

   历史报告（`审阅-2026-0703.md` / `换皮审计报告.md`）也归档在同目录下。

6. **用户要实际改代码时**：从建议清单挑一个窄工作包，按「预期回收分」最大的子指标动手；改完复跑分析器对比分数趋势，确认改动落在目标维度。

## How to read the report

报告 9 节：结论 → 评分模型 → 维度得分 → 子指标扣分明细（含证据） → 同源身份信号 → 高危信号 → 优化建议清单（P0–P4 + 预期回收分 + 动作） → 迭代路径（Top 5） → 方法局限。

**最常被引用的两节**：
- **七、优化建议清单**：按可回收分降序，「+X 分」= 把该子指标重叠压到 15% 后能恢复的独立性分。优先做 +X 大的。
- **八、迭代路径**：距 ≥70 差值 + 最大可回收 + 可行性 + Top 5。

## What the analyzer extracts

递归读两棵源码树（自动跳过 `node_modules` / `dist` / `build` / `.git` / `vendor`），提取：

- **技术骨架**：依赖版本、框架/构建、目录结构、路由/配置、状态管理、工程配置。
- **页面布局**：JSX/Vue/Svelte/HTML 标签序列、组件层级签名、className/CSS 选择器、共享组件实现指纹、响应式断点、布局工具模式。
- **视觉体系**：颜色值、CSS 变量名、字体/间距/动效规则。
- **业务逻辑**：代码 token、第三方服务、API 端点、函数名指纹。
- **项目身份**：package name/version + 本地 git origin/branch/HEAD（用于身份 override）。

输出：`reskin-audit-report.md`（人读）+ `reskin-audit-report.json`（机读，含原始子指标/阈值/证据）。

## Tuning

`--config config.json` 可覆盖：权重（必须 `skeleton/layout/visual/logic` 四键、和=100）、三档阈值、高危信号阈值、建议的目标重叠/触发阈值/优先级分档、身份 override 开关。改阈值/权重后，分数不再适用默认标准，需在报告中声明。

## Common pitfalls

- **方向反了**：本技能目标是**降低同源可识别度、推高独立性到 ≥70**，不是「保留骨架、追求 rebase 友好」。若用户的实际意图是授权品牌重塑且要保留上游同步能力，那不是本技能的场景——别把「降分建议」套上去。
- **不要只看截图或 CSS**：同源判定依赖架构 + 布局 + 身份 + 逻辑交叉证据。
- **不要把生成物当证据**：minified/vendor/build 产物已默认忽略；lockfile 噪声不计入依赖身份。
- **不要过度解读框架默认重叠**：同用 CRA/Vite/antd 会产生「合理重叠」，但身份 override + 多维高分交叉验证可区分真同源与框架巧合。
- **业务逻辑重叠可能是「功能保留」有意为之**：是否整改取决于竞标是否允许功能相同。本技能只标注重叠，是否改由人决定。
- **建议不是无脑重命名**：每条动作模板都对应一类工程改造（换库/重组目录/重排布局/重建色板…），不是 cosmetic churn。

## Tests

```bash
cd .agents/skills/detecting-frontend-reskins
python3 -m unittest tests.test_reskin_audit -v
```

三组夹具验证三档：近乎相同（≤39 + 身份 override） / 部分改（40–69） / 不同栈（≥70）。
