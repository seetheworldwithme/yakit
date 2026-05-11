# 运行 Yakit Memfit 版本指南

## 概述

Memfit 是 Yakit 的一个版本变体，类似于 Yakit 标准版、IRify、Enterprise 等不同版本。Memfit 版本专注于 AI 辅助安全测试功能。

## 项目结构

```
yakit/
├── app/
│   ├── main/                      # Electron 主进程
│   └── renderer/
│       ├── src/main/              # 主渲染进程
│       └── engine-link-startup/   # 引擎链接启动页
├── package.json                   # 根项目配置
└── scripts/
    └── release-memfit.js          # Memfit 发版脚本
```

## 运行 Memfit 版本

### 第一步：安装依赖

```bash
# 进入 Yakit 目录
cd yakit

# 安装主项目依赖
yarn install

# 安装主渲染进程依赖
yarn install-render

# 安装引擎链接启动页依赖
yarn install-link-render
```

### 第二步：启动开发环境

#### 方式一：同时启动主渲染进程和引擎链接页（推荐）

```bash
# 启动 Memfit 版本的两个渲染进程
yarn start-renders-memfit
```

这会同时启动：
- 主渲染进程（端口 3000）
- 引擎链接启动页（端口 5173）

#### 方式二：分别启动

```bash
# 终端 1：启动主渲染进程
cd yakit
yarn start-render-memfit

# 终端 2：启动引擎链接启动页
cd yakit
yarn start-link-render-memfit

# 终端 3：启动 Electron 主进程
cd yakit
yarn start-electron
```

### 第三步：启动 Electron 应用

在启动了渲染进程后，在另一个终端运行：

```bash
cd yakit
yarn start-electron
```

## 构建生产版本

### 构建渲染进程

```bash
# 构建 Memfit 版本的两个渲染进程
yarn build-renders-memfit
```

这会执行：
1. `yarn build-render-memfit` - 构建主渲染进程
2. `yarn build-link-render-memfit` - 构建引擎链接启动页

### 打包应用

```bash
# macOS 打包
yarn pack-mac-memfit

# Windows 打包
yarn pack-win-memfit

# Linux 打包
yarn pack-linux-memfit
```

## 环境变量配置

Memfit 版本使用 `.env.memfit` 文件进行配置，位于 `app/renderer/engine-link-startup/` 目录下。

如果需要自定义配置，可以创建或修改该文件：

```bash
# 示例配置
VITE_APP_TITLE=Memfit AI
VITE_APP_VERSION=1.0.0
```

## 开发调试

### 调试主渲染进程

主渲染进程运行在端口 3000，可以通过浏览器访问：
- http://localhost:3000

### 调试引擎链接启动页

引擎链接启动页运行在端口 5173，可以通过浏览器访问：
- http://localhost:5173

### Electron 开发者工具

启动 Electron 后，可以使用快捷键打开开发者工具：
- macOS: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`

## 常见问题

### 1. 端口被占用

如果端口 3000 或 5173 被占用，可以修改 `vite.config.ts` 中的端口配置：

```typescript
// app/renderer/engine-link-startup/vite.config.ts
server: {
    host: true,
    port: 5173  // 修改为其他端口
}
```

### 2. 依赖安装失败

如果遇到依赖安装问题，可以尝试：

```bash
# 清理缓存
yarn cache clean

# 删除 node_modules
rm -rf node_modules
rm -rf app/renderer/src/main/node_modules
rm -rf app/renderer/engine-link-startup/node_modules

# 重新安装
yarn install
yarn install-render
yarn install-link-render
```

### 3. 构建失败

如果构建失败，检查：
- Node.js 版本是否符合要求（建议 v16+）
- Yarn 版本是否正确
- 是否有足够的磁盘空间

## 相关命令速查

| 命令 | 说明 |
|------|------|
| `yarn start-renders-memfit` | 启动 Memfit 渲染进程 |
| `yarn start-render-memfit` | 启动主渲染进程 |
| `yarn start-link-render-memfit` | 启动引擎链接页 |
| `yarn start-electron` | 启动 Electron 主进程 |
| `yarn build-renders-memfit` | 构建渲染进程 |
| `yarn pack-mac-memfit` | 打包 macOS 版本 |
| `yarn pack-win-memfit` | 打包 Windows 版本 |
| `yarn pack-linux-memfit` | 打包 Linux 版本 |

## Memfit 特有功能

Memfit 版本专注于以下功能：
- AI 辅助安全测试
- 智能漏洞分析
- 自动化渗透测试建议
- 自然语言交互界面

## 与其他版本的区别

| 版本 | 特点 |
|------|------|
| Yakit | 标准版，完整功能 |
| Enterprise | 企业版，增强的企业功能 |
| IRify | 专注于逆向工程 |
| Memfit | 专注于 AI 辅助安全测试 |

## 总结

运行 Yakit Memfit 版本的完整流程：

1. **安装依赖**：`yarn install && yarn install-render && yarn install-link-render`
2. **启动渲染进程**：`yarn start-renders-memfit`
3. **启动 Electron**：`yarn start-electron`
4. **开始开发**：在 Electron 应用中进行开发和调试

对于生产环境，使用 `yarn build-renders-memfit` 和 `yarn pack-mac-memfit`（或其他平台的打包命令）来构建和打包应用。
