# Yakit 不需要展示的功能清单

> 分析依据：`功能要求.csv`（采购需求，共 24 项功能性 + 7 项非功能性要求）对照当前 Yakit 项目实际功能模块。
> 分析范围：以**企业私有版（EnpriTrace）专家模式菜单**为基准（需求第 19/20/21/24 条强调团队协作 / 角色权限 / 项目组 / 服务端纳管，对应私有版形态）。
> 参考代码：`app/renderer/src/main/src/routes/newRoute.tsx`（`PrivateExpertRouteMenu` 默认菜单、`PrivateAllMenus` 全量可选菜单、`YakitRouteToPageInfo` 功能标签与描述）、`enums/yakitRoute.ts`。

---

## 一、判定原则

一个功能被判为「不需要展示」，需满足下列任一条件：

1. **超出需求范围**：`功能要求.csv` 中没有对应条目，且不属于已要求功能的必要支撑。
2. **攻击性过强 / 后渗透属性**：属于维持访问、反弹 Shell、反序列化 payload 生成等，与「安全漏洞测试」的合规采购定位冲突（采购方为金融机构，非功能性要求第 26/27 条强调安全合规与国密）。
3. **数据外发合规风险**：需对接外部第三方平台，存在测试数据外泄风险，与金融客户合规要求冲突。
4. **试验性 / 非生产**：beta 功能、运维功能、个人记录工具，不应在正式交付产品中展示。

> 注：「展示」指暴露在主菜单 / 导航 / 编辑菜单的可选项中。下文每条均标注其在代码中的路由 key 与菜单分组，便于落地隐藏。

---

## 二、需求已覆盖、应当保留的功能（对照表，不在本清单内）

| 需求条目 | Yakit 功能 | 路由 key |
| --- | --- | --- |
| 1–4 流量劫持（HTTP/HTTPS、自动生成 SSL 证书、设代理、双向拦截、放行/劫持/丢弃、规则匹配放行） | MITM 交互式劫持 | `mitm-hijack` |
| 5–6 报文修改转发、任意请求重放 | Web Fuzzer | `httpFuzzer` |
| 7–8 历史流量记录与多维度筛选 | History | `db-http-request` |
| 9 通用漏洞检测（SQL注入/XSS，批量） | 专项漏洞检测 + 批量执行 | `poc` / `batch-executor-page-ex` |
| 10 专项漏洞检测（fastjson/shiro，批量） | 专项漏洞检测 | `poc` |
| 11 漏洞报告（Word/PDF/HTML，含参数/原始请求响应/评级/修复建议） | 报告 + 漏洞与风险 | `db-reports-results` / `db-risks` |
| 12 高并发爆破、挂字典 | 弱口令检测 + 字典管理 | `brute` / `payload-manager` |
| 13 报文差异对比（请求/响应/自定义，文本/字节差异） | 数据对比 | `dataCompare` |
| 14–15 编解码（Base64/URL/Unicode 等 + 国密 SM1-4 / AES / RSA） | Codec | `codec` |
| 16–17 插件编写/调试/日志 + 链式调用可视化 | Yak Runner + 新建插件 + 批量执行 | `yakScript` / `add-yakit-script` / `batch-executor-page-ex` |
| 18 插件仓库 CRUD / 分类分组 / 批量导入 | 插件仓库 + 插件管理 | `plugin-hub` / `plugin-audit` |
| 19–20 团队协作 / 角色权限 | 服务端 + 角色管理 | `role-admin-page` |
| 21–22 项目管理 / 加密导入导出 | 项目管理 | `yakrunner-project-manager` |
| 23 安全概览（本地测试记录：历史流量 + 漏洞） | 首页工作台（已含资产/漏洞/流量卡片） | `new-home` |

> 结论：核心采购需求已被 MITM、Web Fuzzer、History、PoC、批量执行、报告、风险、爆破、字典、数据对比、Codec、Yak Runner、插件仓库、项目管理、首页 共同覆盖。

---

## 三、不需要展示的功能清单

### A 类：当前在企业版「专家模式菜单」默认展示，但超出采购需求 —— 需从菜单隐藏

#### A1. Websocket Fuzzer　`websocket-fuzzer`（菜单组：手工渗透）
- **原因（超出范围）**：需求第 1–6 条仅覆盖 HTTP/HTTPS 流量的劫持与报文重放，未涉及 WebSocket 协议。
- **处置**：从 `PrivateExpertRouteMenu` →「手工渗透」分组移除。

#### A2. 空间引擎　`space-engine`（菜单组：安全工具）
- **原因（数据外发合规风险）**：该模块对接外部网络空间测绘平台 **ZoomEye（钟馗之眼）**，需用户填入第三方 API key，查询条件与回结果均经过外部服务（见 `pages/spaceEngine/ZoomeyeHelp.tsx`）。金融客户对测试数据外发有严格合规约束，非功能性要求第 26 条要求供应商提供安全风险评估报告，此类外部数据通道不宜保留。
- **原因（超出范围）**：需求为 Web 流量安全测试，无资产测绘 / 外部空间搜索要求。
- **处置**：从「安全工具」分组移除。

#### A3. 基础爬虫　`plugin-op`（菜单组：安全工具，内定插件 `BasicCrawler`）
- **原因（超出范围）**：需求无网站爬虫 / 内容发现 / 站点架构抓取条目。
- **处置**：从「安全工具」分组移除该内定插件项。

#### A4. 子域名收集　`plugin-op`（菜单组：安全工具，内定插件 `SubDomainCollection`）
- **原因（超出范围）**：需求无子域名收集 / 域名资产发现条目，属资产测绘范畴。
- **处置**：从「安全工具」分组移除。

#### A5. 目录扫描（综合目录扫描与爆破）　`plugin-op`（菜单组：安全工具，内定插件 `DirectoryScanning`）
- **原因（超出范围）**：需求第 12 条的「爆破测试」语义为弱口令爆破；目录扫描属 Web 路径 / 敏感内容发现，二者不同。需求未要求目录扫描。
- **处置**：从「安全工具」分组移除。

#### A6. 端口/指纹扫描 + 端口资产　`scan-port` / `db-ports`（菜单组：安全工具 / 数据库）
- **原因（超出范围）**：需求为流量劫持 / 报文重放 / 漏洞检测 / 爆破，无端口扫描 / 网络资产发现要求。端口扫描属于网络发现与资产清点，超出 Web 安全测试需求。
- **处置**：从「安全工具」移除 `scan-port`，从「数据库」移除 `db-ports`。

#### A7. 域名资产　`db-domains`（菜单组：数据库）
- **原因（超出范围）**：资产测绘产物，需求未涉及域名资产管理。
- **处置**：从「数据库」分组移除。

#### A8. 指纹库　`fingerprint-manage`（菜单组：数据库）
- **原因（超出范围）**：Web 指纹识别 / 资产指纹库管理，需求未要求。
- **处置**：从「数据库」分组移除。

#### A9. CVE 管理　`cve`（菜单组：数据库）
- **原因（超出范围）**：需求要求的是「主动漏洞检测」（第 9/10 条），本模块是公开 CVE 漏洞知识库的本地查询，二者不同。需求第 31 条虽提及 CVE/CNVD，但语境是「供应商对产品自身及第三方组件已知漏洞的修复说明」，并非要求产品内置 CVE 查询功能。
- **处置**：从「数据库」分组移除。

#### A10. 反连模块（整组）　菜单组：反连
- **涉及子项**：
  - `shellReceiver`（端口监听器 / **反弹 Shell 接收器**，`describe: reverseShellTool`）
  - `PayloadGenerater_New`（**Yso-Java Hack**，Java 反序列化攻击 payload 生成，`describe: fuzzPayLoadDeserialization`）
  - `ReverseServer_New`（反连服务器，提供 HTTP/RMI/HTTPS 反连）
  - `dnslog` / `icmp-sizelog` / `tcp-portlog`（反连触发器）
- **原因（攻击性 / 超出范围）**：需求漏洞检测（SQL注入/XSS/fastjson/shiro）未要求无回显反连验证。其中 **ShellReceiver（反弹 Shell 接收）与 Yso-Java Hack（反序列化 payload 生成）属后渗透 / 主动攻击能力**，与「安全漏洞测试」的合规采购定位冲突，金融机构采购场景不宜展示。
- **处置**：整组从 `PrivateExpertRouteMenu` 移除。

---

### B 类：beta / 隐藏入口 / 其他变体功能，需确保在交付版中不暴露

> 这些功能虽不在专家模式默认菜单，但存在于 `PrivateAllMenus` 可选项、`SingletonPageRoute` 或特定变体中，交付前需逐一确认入口已关闭。

#### B1. WebShell 管理　`beta-webshell-manager` / `beta-webshell-opt`（标签：「网站管理」/「WebShell 实例」）
- **原因（攻击性极强）**：WebShell 管理用于攻击后维持访问 / 执行命令，属典型后渗透功能，与合规采购定位严重冲突。
- **处置**：确保 beta 入口不开启。

#### B2. Vulinbox 靶场管理器　`beta-vulinbox-manager`
- **原因（超出范围）**：内置漏洞靶场为教学 / 自测环境，需求是生产测试工具，不需要内置靶场。
- **处置**：不暴露。

#### B3. BAS 实验室（ChaosMaker）　`db-chaosmaker`
- **原因（超出范围）**：BAS（入侵与攻击模拟）/ 混沌工程，需求未涉及。

#### B4. 录屏管理　`screen-recorder-page`
- **原因（超出范围）**：屏幕录制管理，非安全测试功能，需求未要求。

#### B5. Java 反编译　`yak-java-decompiler`
- **原因（超出范围）**：二进制 / 字节码逆向辅助，需求是 Web 黑盒流量测试，不涉及代码逆向。

#### B6. 代码审计全套（IRify / YakRunner 审计线）
- **涉及子项**：`yakrunner-audit-code`（代码审计）、`yakrunner-code-scan`（代码扫描）、`irify-ai-code-audit`（AI 代码审计）、`yakrunner-audit-hole`（审计漏洞）、`rule-management`（规则管理）、`ssa-compile-history`（SSA 编译历史）、`ssa-result-diff`
- **原因（超出范围）**：本组为**白盒源代码审计**能力，需求是 Web 黑盒流量安全测试，无源代码审计条目。该组仅在 IRify 变体启用，EnpriTrace 交付版不应展示。

#### B7. AI 全套
- **涉及子项**：`ai-agent`（AIAgent）、`ai-forge`（技能库）、`ai-tool`（工具库）、`ai-repository`（知识库）、`ai-memory`（记忆库）
- **原因（超出范围 + 数据外发风险）**：需求未涉及 AI 能力；且 AI 功能通常依赖云端大模型，存在测试数据 / 代码外发风险，与金融客户合规要求冲突。
- **注**：`PrivateAllMenus` 中 `AI_Agent` 已被注释，确认默认未展示，需保持。

#### B8. 数据统计　`data_statistics`
- **原因（超出范围 + 非安全概览）**：经核实 `pages/dataStatistics/DataStatistics.tsx`，其内容为「活跃度统计」「使用时长统计」等**软件运营层使用统计**，并非需求第 23 条所要求的「安全概览（历史测试流量 + 漏洞结果）」。需求第 23 条已由首页工作台（`new-home`，含资产/漏洞/流量卡片）满足，本模块多余。
- **处置**：不暴露。

#### B9. 网络调试 / 全局配置 / 流量分析（试验性）　`beta-diagnose-network` / `beta-config-network` / `**beta-debug-traffic-analize`
- **原因（试验性 / 非生产）**：beta 调试功能，非正式交付功能，不应在生产产品展示。

#### B10. 远程管理　`control-admin-page`
- **原因（边界 / 运维属性）**：服务端对客户端的远程任务下发与控制，属私有版后台运维能力，非面向测试人员的安全测试功能。需求第 24 条「服务端查看纳管客户端测试记录」由服务端数据查看满足，无需暴露远程控制入口。建议仅服务端管理员侧保留，客户端侧不展示。

#### B11. 记事本（渗透记录）　`notepad-manage` / `modify-notepad`
- **原因（超出范围）**：个人测试笔记记录工具，需求未要求。

---

## 四、边界项 —— 建议保留（已要求功能的必要支撑）

下列功能虽未在需求中直接点名，但是已要求功能的**必要支撑或基础设置**，建议保留：

| 功能 | 路由 key | 保留理由 |
| --- | --- | --- |
| 字典管理 | `payload-manager` | 支撑需求第 12 条爆破「挂字典」 |
| 配置管理（代理/热加载） | `config-management` | 支撑 MITM 代理与插件热加载的工具基础 |
| 系统配置 | `system-config` | 基础设置项 |
| 误报记录 | `misstatement` | 漏洞结果治理，可关联第 11 条报告质量 |
| 插件管理 | `plugin-audit` | 支撑第 16–18 条插件能力的客户端侧管理 |
| 用户管理 / License 管理 | `account-admin-page` / `license-admin-page` | 支撑第 19/20 条团队与权限 |

---

## 五、落地建议（如何隐藏）

菜单数据集中在 `app/renderer/src/main/src/routes/newRoute.tsx`：

1. **默认菜单**：从 `PrivateExpertRouteMenu`（专家模式，约 L2118）、`PrivateScanRouteMenu`（扫描模式）、`PrivateSimpleRouteMenu`（简易版）三份数组中，按上表移除对应菜单项 / 分组（如整组移除「反连」「安全工具」中的资产类项）。
2. **可编辑菜单的可选项**：从 `PrivateAllMenus`（L1868）中删除对应 key，避免用户通过「编辑菜单」把它们再加回来；同时把这些 key 加入 `EnterpriseDeprecatedSecondMenu`（`routes/deprecatedMenu.ts`），由 `InvalidPageMenuItem` 强制清理用户已保存的旧菜单数据。
3. **beta / 隐藏入口**：B 类功能逐一排查入口（设置页、首页卡片、右键菜单、全局快捷键注册 `pages/shortcutKey`），确保不开启。
4. **只动 UI 不动逻辑**：按 CLAUDE.md 约定，仅从菜单 / 入口层面隐藏，保留路由与页面组件代码，不删业务逻辑，便于后续按需恢复。

---

## 六、汇总表

| 类别 | 数量 | 代表功能 |
| --- | --- | --- |
| A 类（菜单中需隐藏） | 10 组 / 16 个功能 | Websocket Fuzzer、空间引擎、爬虫、子域名、目录扫描、端口扫描、端口/域名/指纹/CVE 资产、反连整组 |
| B 类（beta / 隐藏，需确认不暴露） | 11 组 | WebShell、靶场、BAS、录屏、Java 反编译、代码审计全套、AI 全套、数据统计、网络调试、远程管理、记事本 |
| 边界（建议保留） | 6 项 | 字典 / 配置 / 系统配置 / 误报 / 插件管理 / 用户与 License |
