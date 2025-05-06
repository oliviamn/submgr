# Submgr - 订阅链接管理工具

这是一个基于 Next.js 构建的现代化订阅管理系统，使用 Cloudflare Workers 和 KV 存储作为后端服务。

## 使用指南

### 功能概述

Submgr 是一个强大的代理订阅管理器，主要提供以下功能：

1. **订阅管理**
   - 支持添加多个代理订阅源
   - 自动更新和同步订阅内容
   - 支持多种订阅格式转换

2. **自定义节点**
   - 添加和管理自定义代理节点
   - 支持多种代理协议（vmess, trojan, ss, ssr等）
   - 节点分组和标签管理

3. **配置生成**
   - 支持多种客户端配置格式：
     * Surge 配置
     * Singbox 配置
     * Xray 配置
     * Clash 配置
   - 自定义规则集成
   - 策略组配置
   - 自动更新配置

### 基本使用流程

1. **输入订阅链接**
   - 在顶部输入框中粘贴您的订阅链接
   - 支持多行输入，每行一个链接或自定义节点
   - 点击"转换"按钮生成订阅链接

2. **分享链接管理**
   - 在"分享链接"文本框中可以查看和编辑转换后的链接
   - 可以直接复制链接分享给其他用户

3. **规则配置**
   - 打开"高级选项"开关以显示更多设置
   - 从下拉菜单中选择规则集（如：均衡、全面等等）
   - 根据需要选择分流规则类别：
     * 📺 油管视频
     * 🔒 国内服务
     * 🌐 AI 服务
     * 🔍 谷歌服务
     * 📱 电报消息
     * 👥 私有网络
     * 🎮 Github
     * 📺 流媒体
     * 🌍 非中国

4. **使用生成的配置**
   - 系统会自动根据您的选择生成对应的配置
   - 复制生成的链接到您的客户端软件中使用
   - 配置会自动同步更新，无需手动更新

5. **加载已保存配置**
   - 输入短代码加载之前生成过的配置。短代码需自行保存，为防止被随意获取不提供查询功能


## 项目架构

本项目采用以下技术栈：

- **前端框架**: Next.js 15.2.5
- **UI 框架**: React 19
- **样式方案**: TailwindCSS
- **部署平台**: Cloudflare Workers
- **数据存储**: Cloudflare KV
- **开发工具**: 
  - TypeScript 支持
  - Turbopack 用于快速开发
  - Wrangler 用于 Cloudflare 开发和部署

## 本地开发设置

### 环境要求

- Node.js 18+ 
- pnpm 包管理器
- Wrangler CLI (Cloudflare Workers 开发工具)

### 安装步骤

1. 克隆项目并安装依赖：
```bash
git clone [repository-url]
cd submgr
pnpm install
```

2. 配置本地环境变量：
   - 复制 `.dev.vars.example` 为 `.dev.vars`
   - 填入必要的环境变量

3. 启动开发服务器：

```bash
# 启动 Next.js 开发服务器（带 Turbopack）
pnpm dev

# 启动带本地 KV 存储的开发服务器
pnpm dev:kv
```

4. 打开浏览器访问 http://localhost:3000 查看应用

## Cloudflare 部署流程

### 前期准备

1. 安装 Wrangler CLI 并登录：
```bash
pnpm add -g wrangler
wrangler login
```

2. 创建 Cloudflare KV 命名空间：
```bash
pnpm setup-kv
```

### 部署步骤

1. 构建应用：
```bash
pnpm build:kv
```

2. 部署到 Cloudflare：
```bash
pnpm deploy
```

或者使用一键部署命令（包含 KV 设置）：
```bash
pnpm cf-deploy
```

### 部署配置说明

项目使用 `wrangler.jsonc` 进行 Cloudflare 配置，主要包含：
- Workers 运行时配置
- KV 存储绑定
- 资源绑定
- 环境变量设置

## 开发指南

### 项目结构
```
submgr/
├── app/           # Next.js 应用代码
├── public/        # 静态资源
├── scripts/       # 部署和设置脚本
└── .open-next/    # OpenNext 构建输出
```

### 常用命令

- `pnpm dev` - 启动开发服务器
- `pnpm build` - 构建生产版本
- `pnpm lint` - 运行代码检查
- `pnpm preview` - 预览生产构建
- `pnpm cf-typegen` - 生成 Cloudflare 类型定义

## 注意事项

1. 确保在部署前已正确设置所有必要的 Cloudflare 环境变量
2. 本地开发时使用 `.dev.vars` 文件管理环境变量
3. 使用 `wrangler dev --local` 可以在本地模拟 Cloudflare Workers 环境

## 技术支持

如有问题，请参考：
- [Next.js 文档](https://nextjs.org/docs)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [OpenNext 文档](https://open-next.js.org/) 