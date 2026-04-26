# @done-coding/cli-publish

项目发布命令行工具 - 自动化项目版本管理和发布流程

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-publish.svg)](https://www.npmjs.com/package/@done-coding/cli-publish)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-publish
# 或
pnpm add @done-coding/cli-publish
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC publish [command]
```

## 快速开始

```bash
# 独立使用
dc-publish [command]

# 作为主 CLI 的子命令
DC publish [command]

# 查看帮助
dc-publish --help
```

## 功能特性

- ✅ **版本管理**: 支持语义化版本号管理
- 📦 **多模式发布**: 支持 npm 和 web 两种发布模式
- 🏷️ **标签管理**: 支持不同的发布标签（latest、next、alpha、beta、rc）
- 🔄 **Git 集成**: 支持自动推送到远程仓库
- ⚙️ **配置管理**: 支持配置文件管理发布规则

## API 文档

### 基础命令

#### `dc-publish init`

初始化配置文件

```bash
# 创建默认配置文件
dc-publish init
```

#### `dc-publish` (默认命令)

执行发布命令

```bash
# 使用默认配置发布
dc-publish

# 指定发布类型
dc-publish -t patch

# 指定发布模式
dc-publish -m npm

# 指定发布标签
dc-publish -d next

# 禁用推送到远程仓库
dc-publish -p false
```

#### `dc-publish alias`

别名发布

```bash
# 执行别名发布
dc-publish alias
```

### 命令选项

- `-R, --rootDir`: 运行目录
- `-C, --configPath`: 配置文件相对路径，默认为 `./.done-coding/publish.json`
- `-m, --mode`: 发布模式，可选值：`npm`（默认）、`web`
- `-t, --type`: 发布类型，可选值：`major`、`minor`、`patch`、`premajor`、`preminor`、`prepatch`、`prerelease`、`custom version`
- `-p, --push`: 是否推送至远程仓库，默认为 `true`
- `-d, --distTag`: 发布标签，可选值：`latest`、`next`、`alpha`、`beta`、`rc`

## 使用示例

### 基础使用场景

```bash
# 1. 初始化配置
dc-publish init

# 2. 发布补丁版本
dc-publish -t patch

# 3. 发布到 next 标签
dc-publish -t minor -d next

# 4. 发布但不推送到远程仓库
dc-publish -t patch -p false
```

### 不同发布类型

```bash
# 主版本发布 (1.0.0 -> 2.0.0)
dc-publish -t major

# 次版本发布 (1.0.0 -> 1.1.0)
dc-publish -t minor

# 补丁版本发布 (1.0.0 -> 1.0.1)
dc-publish -t patch

# 预发布版本 (1.0.0 -> 1.0.1-0)
dc-publish -t prerelease
```

### 不同发布模式

```bash
# npm 模式发布
dc-publish -m npm

# web 模式发布
dc-publish -m web
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc publish init
dc publish -t patch
dc publish alias

# macOS/Linux 系统
DC publish init
DC publish -t patch
DC publish alias
```

## 配置

通过 `dc-publish init` 命令可以初始化配置文件 `.done-coding/publish.json`。

具体的配置选项需要查看初始化后生成的配置文件内容。

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## 故障排除

### 常见问题

**Q: 配置文件找不到**

```bash
# 检查配置文件是否存在
ls -la .done-coding/publish.json

# 重新初始化配置
dc-publish init
```

**Q: 发布失败**

```bash
# 检查 npm 登录状态
npm whoami

# 检查包名是否已存在
npm view @your-package-name

# 检查网络连接
npm ping
```

**Q: Git 推送失败**

```bash
# 检查 Git 远程仓库配置
git remote -v

# 检查 Git 认证
git config --list | grep user

# 禁用自动推送
dc-publish -p false
```

### 调试模式

```bash
# 查看版本信息
dc-publish --version

# 查看帮助信息
dc-publish --help
```

## 贡献指南

我们欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m "feat: add amazing feature"`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/done-coding/done-coding-cli.git
cd done-coding-cli/packages/publish

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 本地开发测试
node es/cli.mjs --help

# 注意：本地使用 node + 入口文件，发布后使用 bin 命令名
# 功能完全一致，只是调用方式不同
```

## 许可证

MIT © [done-coding](https://github.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
