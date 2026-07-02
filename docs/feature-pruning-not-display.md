# 前端功能展示裁剪建议

生成时间：2026-07-02

## 结论口径

本文档基于根目录 `功能要求.xlsx` 的 31 条要求，以及当前前端项目中的菜单、路由和首页快捷入口进行比对。这里的“不需要展示”优先指 **不应作为主界面、菜单、首页工具箱、右上角设置菜单、用户菜单中的可见入口展示**。

真正删除代码前，建议先按本文档隐藏入口并跑一次功能回归。部分能力虽然不应展示，但可能被保留功能间接调用，例如漏洞扫描插件可能需要反连回调、CVE 数据库或字典能力。

## 必须保留的需求基线

`功能要求.xlsx` 中明确要求保留的能力如下：

| 能力 | 需求编号 | 当前项目对应入口/模块 | 建议 |
| --- | --- | --- | --- |
| HTTP/HTTPS 流量拦截、证书、代理、请求/响应劫持、放行/丢弃、规则放行 | 1-4 | `MITMHacker`、MITM 规则/过滤相关页面 | 保留 |
| 报文修改、重放 | 5-6 | `HTTPFuzzer`、History 发送到 Fuzzer | 保留 |
| 历史流量查看与筛选 | 7-8 | `DB_HTTPHistory`、`HTTPHistory` | 保留 |
| 通用漏洞检测、专项漏洞检测、批量扫描、扫描结果 | 9-10 | `PoC`、`BatchExecutorPage`、插件执行、`DB_Risk` | 保留 |
| 漏洞测试报告 | 11 | `DB_Report`、风险/报告生成相关入口 | 保留 |
| 高并发爆破、字典挂载 | 12 | `Mod_Brute`、`PayloadManager`、字典管理 | 保留 |
| 请求/响应/文本差异对比 | 13 | `DataCompare` | 保留 |
| 编解码、国密/AES/RSA 等加解密 | 14-15 | `Codec` | 保留 |
| 插件编写、调试、日志输出、插件仓库、插件分组、批量导入、链式/批量执行 | 16-18 | `Plugin_Hub`、`Plugin_OP`、`BatchExecutorPage`、`AddYakitScript` | 保留 |
| 团队协作、连接同一服务端、数据/结果共享 | 19 | 远程连接模式、项目/远程协作相关能力 | 保留 |
| 角色权限、用户权限管理、密码复杂度 | 20、28-30 | `RoleAdminPage`、`AccountAdminPage`、`SetPassword` | 保留 |
| 项目管理、项目组、导入导出、加密导入导出 | 21-22 | 项目管理、`UILayout` 设置里的项目导入导出 | 保留 |
| 安全概览：历史流量、漏洞结果 | 23-24 | 首页数据概览、`DB_HTTPHistory`、`DB_Risk`、`DB_Report` | 保留 |
| 可靠性、安全检测报告、算法合规、漏洞修复说明 | 25-31 | 非功能性要求，不一定需要前台入口 | 保留实现与支撑，不一定展示入口 |

## 当前前端入口来源

主要入口来自：

- `app/renderer/src/main/src/routes/newRoute.tsx`
  - `YakitRouteToPageInfo`
  - `getPublicRouteMenu`
  - `PrivateExpertRouteMenu`
  - `PrivateScanRouteMenu`
  - `PrivateSimpleRouteMenu`
  - `getExtraMenu`
  - `PublicCommonPlugins`
- `app/renderer/src/main/src/pages/home/Home.tsx`
  - 首页工具箱 `toolsList`
  - 首页卡片和快捷入口
- `app/renderer/src/main/src/components/layout/FuncDomain.tsx`
  - 右上角设置菜单 `GetUIOpSettingMenu`
  - 用户头像菜单 `UserMenusMap`
  - 截图、录屏、性能采样、崩溃日志等工具入口
- `app/renderer/src/main/src/pages/layout/publicMenu/PublicMenu.tsx`
  - 社区版菜单渲染和底部入口
- `app/renderer/src/main/src/pages/layout/HeardMenu/HeardMenu.tsx`
  - 企业版菜单渲染和底部入口

## 建议不展示：确定不在功能要求内

这些功能与 `功能要求.xlsx` 没有直接对应关系，建议从主菜单、首页工具箱、顶部设置菜单、额外菜单中隐藏。若后续确认为无内部依赖，再进入删除代码阶段。

| 功能/入口 | 路由/位置 | 不展示原因 | 删除前注意 |
| --- | --- | --- | --- |
| Websocket Fuzzer | `YakitRoute.WebsocketFuzzer` | 要求只提到 HTTP/HTTPS 流量拦截、报文重放和 HTTP 请求/响应报文，没有 WebSocket fuzz 要求 | 检查右键发送到 WS Fuzzer、编辑器菜单依赖 |
| 反连菜单整体 | `DNSLog`、`ICMPSizeLog`、`TCPPortLog`、`ReverseServer_New`、`ShellReceiver` | 要求未提出反连服务器、端口监听、反连触发器、shell 接收能力 | 漏洞扫描插件如需 OOB 回显，可保留内部服务但隐藏入口 |
| Yso-Java Hack / Payload 生成器 | `PayloadGenerater_New` | 要求没有 Java 反序列化 Payload 生成独立能力 | 若专项漏洞检测插件依赖 payload 生成逻辑，保留内部 API |
| 靶场 / Vulinbox | `Beta_VulinboxManager`、首页工具箱、额外菜单 | 要求没有靶场、靶场管理、内置靶场调试能力 | 无 |
| Yak Runner 脚本运行器 | `YakScript`、首页工具箱、额外菜单 | 要求需要插件管理/调试，但不要求向最终用户展示通用脚本运行器 | 插件编辑/调试如果复用 Yak Runner 组件，保留内部组件 |
| 代码审计类功能 | `YakRunner_Audit_Code`、`Irify_AI_Code_Audit`、`YakRunner_Code_Scan`、`YakRunner_Audit_Hole`、`Rule_Management`、`Yak_Java_Decompiler`、`Ssa_Result_Diff`、`SSA_Compile_History` | 要求是 Web 安全测试客户端，不包含源码审计、AI 代码审计、SSA、Java 反编译 | IRify/Memfit 变体如仍要保留，需按变体隔离，不进入 Sentinel 主界面 |
| AI 平台类功能 | `AI_Agent`、`AI_REPOSITORY`、`AI_Memory`、`AI_Tool`、`AI_Forge`、`AddAIForge`、`ModifyAIForge`、`AddAITool`、`ModifyAITool` | 要求未提出 AI Agent、知识库、记忆库、工具库、技能库 | Web Fuzzer/History 内嵌 AI 辅助如产品确认需要，可单独保留内嵌能力，不展示 AI 平台入口 |
| BAS 实验室 / ChaosMaker | `DB_ChaosMaker`、设置菜单 `bas-chaosmaker` | 要求没有 BAS、攻击仿真或混沌实验室 | 无 |
| WebShell 管理 | `Beta_WebShellManager`、`Beta_WebShellOpt` | 要求没有 WebShell 管理和实例操作 | 无 |
| 网络诊断 | `Beta_DiagnoseNetwork`、设置菜单 `diagnose-network` | 属支持/运维工具，不是功能要求中的用户业务能力 | 可保留为隐藏调试入口 |
| 全局配置独立页 | `Beta_ConfigNetwork`、设置菜单 `config-network` | 要求未提出独立全局网络配置页；代理/证书应跟 MITM/Web Fuzzer 场景内聚 | 若 MITM 代理设置依赖此页，隐藏菜单但保留调用能力 |
| 屏幕录制、截图、录屏管理 | `ScreenRecorderPage`、首页工具箱、顶部扳手菜单 | 要求没有录屏、截图、录屏文件管理 | 可作为内部支持工具隐藏 |
| 性能采样、崩溃日志收集 | 顶部扳手菜单、`FuncDomain` | 非功能要求只要求稳定可靠，不要求用户可见性能采样/崩溃日志工具 | 可保留隐藏诊断入口 |
| 运行节点 | 设置菜单 `run-node` | 要求没有运行节点管理 | 若插件执行依赖运行节点，仅隐藏入口 |
| Yak MCP / MCP 配置 | 设置菜单 `mcp`、`configMcp` | 要求没有 MCP 能力 | AI 平台裁剪时一并隐藏 |
| 主题切换 | 设置菜单 `themeSwitching` | 当前 Sentinel 规范已固定深色，要求未提出主题切换 | 已不应恢复 light/dark |
| 语言切换 | 设置菜单 `i18nSwitching` | 要求未提出多语言切换；若交付只面向中文环境，可隐藏 | 若合同要求中英文，需保留 |
| 快捷键设置 | `ShortcutKey`、设置菜单 `setShortcutKey` | 要求没有快捷键自定义管理 | 可保留默认快捷键，隐藏配置页 |
| 日志收集菜单 | 设置菜单 `logs` | 属售后/调试入口，不是业务功能要求 | 可保留隐藏入口 |
| 数据统计 | `Data_Statistics`、用户菜单 `data-statistics` | 要求的“安全概览”是历史流量和漏洞结果，不是独立数据统计后台 | 若服务端汇总概览依赖此页，改为安全概览内聚展示 |
| 误报记录 | `Misstatement`、用户菜单 `misstatement` | 要求报告中需要漏洞参数、风险评级、修复建议；未要求独立误报审核流程 | 若风险管理必须支持误报闭环，放入“需确认” |
| 许可证管理 | `LicenseAdminPage`、用户菜单 `license-admin` | 要求没有 License 管理业务功能 | 商业授权需要可保留管理员隐藏入口 |
| TrustList / 插件权限独立管理 | `TrustListPage`、`PlugInAdminPage` | 要求只明确用户/角色权限；未明确信任列表和插件权限页 | 插件权限如纳入角色权限体系，可合并到角色管理 |
| 记事本 / 云文档 / 新建云文档 | `Notepad_Manage`、`Modify_Notepad`、历史 UI 入口 | 要求没有笔记/云文档能力 | 如果作为报告/测试记录备注，不展示为一级入口 |

## 建议不展示：当前首页工具箱中的多余快捷入口

首页 `Home.tsx` 的 `toolsList` 和快捷卡片里重复暴露了大量功能。若主菜单已经保留对应功能，首页只建议保留能支撑需求闭环的少量入口：MITM、Web Fuzzer、History、PoC/批量检测、爆破、报告、风险、Codec、DataCompare、字典管理。

建议从首页工具箱隐藏：

- Yak Runner
- 靶场 Vulinbox
- CVE 管理
- 端口监听器
- Websocket Fuzzer
- 子域名收集
- 基础爬虫
- 空间引擎
- ICMP-SizeLog
- TCP-PortLog
- 反连服务器
- 端口资产
- 域名资产
- 记事本管理 / 新建记事本
- 录屏 / 截图 / 录屏管理
- Yso-Java Hack
- DNSLog

## 需要二次确认：需求可能间接覆盖，但不应直接作为主功能展示

这些能力不是需求表明确要求的独立功能，但可能支撑保留功能。建议先隐藏直接入口，删除前按依赖确认。

| 功能/入口 | 建议 | 原因 |
| --- | --- | --- |
| 端口/指纹扫描 `Mod_ScanPort` | 需确认 | 需求写的是漏洞检测目标 URL/IP/域名，没有明确端口资产发现；但端口扫描可能服务于安全概览或漏洞检测前置发现 |
| 子域名收集、基础爬虫、目录扫描插件 | 需确认 | 不是明确需求；目录扫描可被理解为爆破测试的一种，基础爬虫可能服务于测试流量收集 |
| 空间引擎 `Space_Engine` | 需确认 | 属资产发现/外部引擎聚合，不在需求表；如果项目需要 URL/IP/域名资产导入，可保留内部能力 |
| 端口资产、域名资产、指纹库 | 需确认 | “安全概览”只明确历史流量和漏洞结果，没有明确资产台账；如需要资产视图，可保留概览内展示，不作为独立菜单 |
| CVE 管理、CVE 数据库更新 | 需确认 | 非功能要求提到 CVE/CNVD 漏洞修复说明，但不是客户端 CVE 查询 UI；漏洞检测插件可能依赖 CVE 数据 |
| History Analysis / 流量分析器 | 需确认 | 历史流量筛选必须保留，但独立流量分析页面是否需要没有明确；可将筛选能力保留在 History 内 |
| ConfigManagement | 需确认 | 字典管理必须保留；代理、热加载、全局配置是否展示需要再定，建议拆分后只展示“字典管理” |
| 反连基础服务 | 需确认 | 用户不需要看到反连菜单，但 fastjson/shiro 等专项漏洞检测可能需要 DNSLog/OOB 回调能力 |
| 插件审计 / 插件权限 | 需确认 | 插件管理必须保留；插件审核/权限是否属于角色权限范围需产品确认 |
| 远程管理 / 动态控制 | 需确认 | 团队协作要求连接同一服务端共享数据；远程控制他人客户端未明确，建议隐藏“远程控制”类入口，保留连接服务端能力 |

## 不建议删除的展示入口

这些入口与需求表强相关，不能删除：

- `MITMHacker`
- `HTTPFuzzer`
- `DB_HTTPHistory`
- `PoC`
- `BatchExecutorPage`
- `Plugin_Hub`
- `Plugin_OP`
- `AddYakitScript`
- `DB_Report`
- `DB_Risk`
- `Mod_Brute`
- `PayloadManager`
- `DataCompare`
- `Codec`
- `AccountAdminPage`
- `RoleAdminPage`
- `SetPassword`
- 项目管理、项目导入导出、加密导入导出
- 远程/服务端连接能力

## 后续裁剪建议顺序

1. 先改入口，不删页面：从 `newRoute.tsx` 的菜单数组、`Home.tsx` 的工具箱、`FuncDomain.tsx` 的设置/用户菜单中隐藏“不展示”项。
2. 跑回归：验证 MITM、Web Fuzzer、History、PoC、爆破、报告、插件管理、项目/用户权限仍可用。
3. 做依赖扫描：对每个待删路由执行 `rg "YakitRoute.Xxx|route: YakitRoute.Xxx|addToTab\\('|openPage"`，确认没有保留功能间接打开。
4. 再删路由和页面：移除 `YakitRoute` 枚举、`YakitRouteToPageInfo`、`RouteToPageItem` case、页面组件、i18n 文案、图标资源。
5. 最后删服务端/IPC：只有在确认前端和插件均不依赖后，再删 Electron IPC、grpc、store、常量、菜单缓存兼容逻辑。

## 建议优先处理的文件

- `app/renderer/src/main/src/routes/newRoute.tsx`
  - 删除或隐藏 `getPublicRouteMenu`、`PrivateExpertRouteMenu`、`PrivateScanRouteMenu`、`PrivateSimpleRouteMenu`、`getExtraMenu` 中的非需求入口。
- `app/renderer/src/main/src/pages/home/Home.tsx`
  - 精简 `toolsList`、首页卡片和数据概览跳转。
- `app/renderer/src/main/src/components/layout/FuncDomain.tsx`
  - 精简 `GetUIOpSettingMenu`、`UserMenusMap`、截图/录屏/性能采样/调试入口。
- `app/renderer/src/main/src/pages/layout/publicMenu/PublicMenu.tsx`
  - 确认底部只展示“字典管理/自定义”，不要重新暴露 Codec、Yak Runner、靶场、云文档等。
- `app/renderer/src/main/src/pages/layout/HeardMenu/HeardMenu.tsx`
  - 企业版同样按保留基线裁剪。

## 当前判断边界

本文档只基于前端展示入口和 `功能要求.xlsx`。以下内容暂未完全审计：

- 后端 grpc/IPC 是否被保留功能间接依赖。
- 插件内部是否调用反连、CVE、空间引擎、字典、热加载等能力。
- 企业版、IRify、Memfit、EnpriTrace 是否仍需保留独立产品线功能。

因此，下一步建议先做“隐藏入口版”的小步裁剪，而不是直接删除所有代码。
