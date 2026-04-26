# @done-coding/cli-inject

信息(JSON)注入命令行工具 - 将 JSON 数据注入到文件中

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-inject.svg)](https://www.npmjs.com/package/@done-coding/cli-inject)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-inject
# 或
pnpm add @done-coding/cli-inject
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC inject [command]
```

## 快速开始

```bash
# 独立使用
dc-inject [command]

# 作为主 CLI 的子命令
DC inject [command]

# 查看帮助
dc-inject --help
```

## 功能特性

- ✅ **JSON 注入**: 将 JSON 数据注入到指定文件中
- 🔧 **配置管理**: 支持配置文件管理注入规则
- 📁 **目录支持**: 支持指定运行目录和配置文件路径
- 🔄 **批量处理**: 支持批量注入操作

## API 文档

### 基础命令

#### `dc-inject init`

初始化配置文件

```bash
# 创建默认配置文件
dc-inject init
```

#### `dc-inject` (默认命令)

生成文件

```bash
# 使用默认配置生成文件
dc-inject

# 指定运行目录
dc-inject -R ./src

# 指定配置文件路径
dc-inject -C ./custom-config.json
```

**选项说明**:

- `-R, --rootDir`: 运行目录
- `-C, --configPath`: 配置文件相对路径，默认为 `./.done-coding/inject.json`

## 使用示例

### 基础使用场景

```bash
# 1. 初始化配置
dc-inject init

# 2. 执行注入操作
dc-inject

# 3. 指定不同的运行目录
dc-inject -R ./packages/core
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc inject init
dc inject -R ./src

# macOS/Linux 系统
DC inject init
DC inject -R ./src
```

## 配置

通过 `dc-inject init` 命令可以初始化配置文件 `.done-coding/inject.json`。

具体的配置选项需要查看初始化后生成的配置文件内容。

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## 故障排除

### 常见问题

**Q: 配置文件找不到**

```bash
# 检查配置文件是否存在
ls -la .done-coding/inject.json

# 重新初始化配置
dc-inject init
```

**Q: 注入失败**

```bash
# 检查运行目录
dc-inject -R ./src

# 检查配置文件路径
dc-inject -C ./custom-config.json
```

### 调试模式

```bash
# 查看版本信息
dc-inject --version

# 查看帮助信息
dc-inject --help
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
cd done-coding-cli/packages/inject

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
