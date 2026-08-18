# IRify 去品牌化进度追踪

> 单一事实源：每完成一项并**人工验证通过**（irify-see 截图确认 + tsc/grep/SCSS 三板斧通过）后打勾。未验证不算完成，不许 Agent 自行打勾。

**总进度：0 / 11**

**品牌方向**：Yakit / IRify / 四维 logo 与文案移除后——logo 替换为**电科院**品牌（源图 `app/assets/brand/电科院LOGO.jpg`）、主题色改为**国网绿**（主 `#00A860` / dark 建议 `#2BD588`）、产品名改为**智能化代码安全检测与验证系统**（策略见 AGENTS.md「品牌资产与替换策略」「主题色：国网绿」「产品名」各节）。

## 触点清理

- [ ] 派生品牌图：从 `app/assets/brand/电科院LOGO.jpg` 生成透明横版 PNG / 深色版 / 方形多尺寸图标（.ico/.icns）
- [ ] 主题色国网绿：`envfile.tsx` `GetMainColor()` 的 irify/irify-enterprise 分支改国网绿（dark `#2BD588` / light `#00A860`）；Link 端 `theme.ts` 同步；排查紫色硬编码残留（`B081FF`/`6A44A9`）
- [ ] 产品名：`envfile.tsx` `getReleaseEditionName()` IRify 两个 case 改「智能化代码安全检测与验证系统」+ 全局 grep 页面展示级「IRify」残留（document.title、启动页、登录页等）
- [ ] 启动页（Link 渲染端）：Yakit / IRify logo、品牌文案与外链（`StartupPage/index.tsx`、`IRifyLogo.png`、`irify-right.png`、`UpdateYakitHint`、`YakitLoading`）；logo 位替换为电科院横版图
- [ ] 启动页更新检查：IRify 跳过 Yakit 软件更新检查，避免强制升级弹窗阻塞启动 + 品牌暴露（`LocalEngine/index.tsx`，对照 SE 跳过先例）
- [ ] 主界面侧边栏/顶栏：`FuncDomain.tsx` 的 `YakitLogo` 引用与版本历史等 `WebsiteGV` 入口；侧边栏 logo 位替换为电科院横版图
- [ ] 产品名文案：`envfile.tsx` `getReleaseEditionName()` 及全局 grep 剩余硬编码 Yakit/yaklang 字样（`Login.tsx`、设置页等）
- [ ] 帮助/关于/升级入口：`HelpDoc.tsx`（yaklang 文档、megavector 关于我们）、`DownloadYakit.tsx` 官网地址展示
- [ ] 图标组件与 favicon：`logo.ts`（YakLogoData）、`newIcon.tsx`（YakitLogoSvgIcon）、`icons.tsx`（OfficialYakitLogoIcon）、插件模板默认 icon、`public/favicon.ico`；favicon 替换为电科院方形图标
- [ ] 窗口元信息：`document.title`（`NewApp.tsx`、Link 端 `App.tsx`）、`index.html` meta/title、任务栏图标（任务栏/窗口图标替换为电科院图标）
- [ ] 打包元信息：`electron-builder.config.js`（productName/appId/图标挑选改为电科院新图标文件，不覆盖共享的 `yakitsslogo*`）、`build/` 下 NSIS `.nsh` 安装文案（打包前检查）

## 验证快照记录

> 每完成一批，记录：日期 / 分支 commit / irify-see 截图结论。

（暂无）
