# create-done-coding

项目创建命令行工具 - 快速创建和初始化 done-coding 项目

[![npm version](https://badge.fury.io/js/create-done-coding.svg)](https://www.npmjs.com/package/create-done-coding)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 使用 npm create（推荐）

```bash
npm create done-coding
# 或指定项目名称
npm create done-coding my-project
```

### 使用 pnpm create

```bash
pnpm create done-coding
# 或指定项目名称
pnpm create done-coding my-project
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC create [projectName]
```

## 快速开始

```bash
# 创建新项目（交互式）
npm create done-coding

# 创建指定名称的项目
npm create done-coding my-awesome-project

# 仅从 done-coding 系列项目列表中克隆
npm create done-coding my-project -- -c
```

## 功能特性

- ✅ **快速创建**: 快速创建新的 done-coding 项目
- 🎯 **项目模板**: 提供标准化的项目模板
- 🔄 **Git 集成**: 集成 Git 仓库初始化和克隆功能
- 📝 **模板处理**: 基于模板引擎生成项目文件
- 💉 **信息注入**: 自动注入项目配置信息

## API 文档

### 基础命令

#### `create-done-coding [projectName]`

创建新项目

```bash
# 交互式创建项目
create-done-coding

# 创建指定名称的项目
create-done-coding my-project

# 仅从 done-coding 系列项目列表中克隆远程仓库
create-done-coding my-project -c
```

**参数说明**:

- `projectName`: 项目名称（可选）

**选项说明**:

- `-c, --justCloneFromDoneCoding`: 是否仅仅从 done-coding 系列项目列表中克隆远程仓库，默认为 `false`

## 使用示例

### 基础使用场景

```bash
# 1. 创建新项目（会提示输入项目名称）
npm create done-coding

# 2. 直接指定项目名称
npm create done-coding my-awesome-app

# 3. 从 done-coding 系列项目克隆
npm create done-coding my-clone-project -- --justCloneFromDoneCoding
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc create
dc create my-project
dc create my-project --justCloneFromDoneCoding

# macOS/Linux 系统
DC create
DC create my-project
DC create my-project --justCloneFromDoneCoding
```

### 不同创建模式

```bash
# 标准项目创建（默认）
npm create done-coding my-project

# 仅克隆模式（从现有项目列表选择）
npm create done-coding my-project -- -c
```

## 依赖的工具包

本包集成了以下 done-coding CLI 工具：

- **@done-coding/cli-git**: Git 操作功能
- **@done-coding/cli-inject**: 信息注入功能
- **@done-coding/cli-template**: 模板处理功能
- **@done-coding/cli-utils**: 通用工具函数

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## 故障排除

### 常见问题

**Q: 项目创建失败**

```bash
# 检查网络连接
ping registry.npmjs.org

# 检查 Node.js 版本
node --version

# 清除 npm 缓存
npm cache clean --force
```

**Q: Git 克隆失败**

```bash
# 检查 Git 是否安装
git --version

# 检查网络连接
ping gitee.com

# 使用详细模式查看错误
create-done-coding my-project --verbose
```

**Q: 权限错误**

```bash
# 检查目录权限
ls -la .

# 使用不同的目录
mkdir ~/my-projects && cd ~/my-projects
npm create done-coding my-project
```

### 调试模式

```bash
# 查看版本信息
create-done-coding --version

# 查看帮助信息
create-done-coding --help
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
cd done-coding-cli/packages/create

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

MIT © [JustSoSu](https://gitee.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Git 操作工具](https://www.npmjs.com/package/@done-coding/cli-git) - 本包依赖的 Git 功能
- [模板处理工具](https://www.npmjs.com/package/@done-coding/cli-template) - 本包依赖的模板引擎
- [信息注入工具](https://www.npmjs.com/package/@done-coding/cli-inject) - 本包依赖的信息注入功能
- [Gitee 仓库](https://gitee.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
