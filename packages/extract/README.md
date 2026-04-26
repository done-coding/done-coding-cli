# @done-coding/cli-extract

信息提取命令行工具 - 从项目中提取和生成各种信息文件

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-extract.svg)](https://www.npmjs.com/package/@done-coding/cli-extract)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-extract
# 或
pnpm add @done-coding/cli-extract
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC extract [command]
```

## 快速开始

```bash
# 独立使用
dc-extract [command]

# 作为主 CLI 的子命令
DC extract [command]

# 查看帮助
dc-extract --help
```

## 功能特性

- ✅ **信息提取**: 从项目源码中提取各种信息
- 📄 **文件生成**: 基于提取的信息生成文档或配置文件
- 🔧 **模板支持**: 支持自定义模板进行信息格式化
- ⚙️ **配置灵活**: 支持多种配置方式和生成模式
- 🚀 **批量处理**: 支持批量提取和生成操作

## API 文档

### 基础命令

#### `dc-extract init`

初始化配置文件

```bash
# 创建默认配置文件
dc-extract init
```

**功能说明**:

- 在项目根目录创建 `.done-coding/extract.json5` 配置文件
- 提供默认的提取规则和模板配置
- 支持自定义提取目标和输出格式

#### `dc-extract` (默认命令)

生成文件

```bash
# 使用默认配置生成文件
dc-extract

# 指定配置文件路径
dc-extract -C ./custom-config.json5

# 指定生成模式
dc-extract -m template

# 指定运行目录
dc-extract -R ./src
```

**选项说明**:

- `-R, --rootDir`: 运行目录，默认为当前目录
- `-C, --configPath`: 配置文件相对路径，默认为 `./.done-coding/extract.json5`
- `-m, --mode`: 生成模式，可选值：`result`（默认）、`template`

### 生成模式

#### result 模式

直接生成最终结果文件

```bash
# 生成结果文件
dc-extract -m result
```

#### template 模式

生成模板文件供进一步处理

```bash
# 生成模板文件
dc-extract -m template
```

## 使用示例

### 基础使用场景

```bash
# 1. 初始化配置
dc-extract init

# 2. 编辑配置文件（可选）
# 编辑 .done-coding/extract.json5

# 3. 执行信息提取和文件生成
dc-extract

# 4. 检查生成的文件
ls -la output/
```

### 自定义配置使用

```bash
# 使用自定义配置文件
dc-extract -C ./configs/my-extract.json5

# 指定不同的运行目录
dc-extract -R ./packages/core

# 生成模板文件而非最终结果
dc-extract -m template
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc extract init
dc extract -m result
dc extract -C ./config.json5

# macOS/Linux 系统
DC extract init
DC extract -m result
DC extract -C ./config.json5
```

## 配置

### 配置文件

通过 `dc-extract init` 命令可以初始化配置文件 `.done-coding/extract.json5`。

具体的配置选项需要查看初始化后生成的配置文件内容。

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## 故障排除

### 常见问题

**Q: 配置文件找不到**

```bash
# 检查配置文件是否存在
ls -la .done-coding/extract.json5

# 重新初始化配置
dc-extract init
```

**Q: 生成失败**

```bash
# 检查运行目录
dc-extract -R ./src

# 检查配置文件路径
dc-extract -C ./custom-config.json5
```

### 调试模式

```bash
# 查看版本信息
dc-extract --version

# 查看帮助信息
dc-extract --help
```

## 性能建议

- 使用合适的文件匹配规则避免处理不必要的文件
- 启用缓存可以提高重复提取的速度
- 大项目建议使用并行处理模式

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
cd done-coding-cli/packages/extract

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
- [模板处理工具](https://www.npmjs.com/package/@done-coding/cli-template) - 本包依赖的模板引擎
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
