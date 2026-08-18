# IRify 去品牌化进度追踪

> 单一事实源：每完成一项并**人工验证通过**（irify-see 截图确认 + tsc/grep/SCSS 三板斧通过）后打勾。未验证不算完成，不许 Agent 自行打勾。

**总进度：0 / 8**

## 触点清理

- [ ] 启动页（Link 渲染端）：Yakit / IRify logo、品牌文案与外链（`StartupPage/index.tsx`、`IRifyLogo.png`、`irify-right.png`、`UpdateYakitHint`、`YakitLoading`）
- [ ] 启动页更新检查：IRify 跳过 Yakit 软件更新检查，避免强制升级弹窗阻塞启动 + 品牌暴露（`LocalEngine/index.tsx`，对照 SE 跳过先例）
- [ ] 主界面侧边栏/顶栏：`FuncDomain.tsx` 的 `YakitLogo` 引用与版本历史等 `WebsiteGV` 入口
- [ ] 产品名文案：`envfile.tsx` `getReleaseEditionName()` 及全局 grep 剩余硬编码 Yakit/yaklang 字样（`Login.tsx`、设置页等）
- [ ] 帮助/关于/升级入口：`HelpDoc.tsx`（yaklang 文档、megavector 关于我们）、`DownloadYakit.tsx` 官网地址展示
- [ ] 图标组件与 favicon：`logo.ts`（YakLogoData）、`newIcon.tsx`（YakitLogoSvgIcon）、`icons.tsx`（OfficialYakitLogoIcon）、插件模板默认 icon、`public/favicon.ico`
- [ ] 窗口元信息：`document.title`（`NewApp.tsx`、Link 端 `App.tsx`）、`index.html` meta/title、任务栏图标
- [ ] 打包元信息：`electron-builder.config.js`（productName/appId/图标挑选）、`build/` 下 NSIS `.nsh` 安装文案（打包前检查）

## 验证快照记录

> 每完成一批，记录：日期 / 分支 commit / irify-see 截图结论。

（暂无）
