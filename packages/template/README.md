# @done-coding/cli-template

模板编译命令行工具 - 基于 Lodash 模板引擎的文件预编译工具

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-template.svg)](https://www.npmjs.com/package/@done-coding/cli-template)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-template
# 或
pnpm add @done-coding/cli-template
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC template [command]
```

## 快速开始

```bash
# 独立使用
dc-template [command]

# 作为主 CLI 的子命令
DC template [command]

# 查看帮助
dc-template --help
```

## 功能特性

- ✅ **模板编译**: 基于 Lodash 模板引擎编译模板文件
- 📁 **批量处理**: 支持批量编译多个模板文件
- 🔧 **配置管理**: 支持配置文件管理编译规则
- 🔄 **回滚功能**: 支持编译结果的回滚操作
- 📝 **Markdown 支持**: 支持 Markdown 代码块处理
- 🎯 **多种输出模式**: 支持覆盖、追加、替换等输出模式及对应的逆操作(回滚)

## API 文档

### 基础命令

#### `dc-template init`

初始化配置文件

```bash
# 创建默认配置文件
dc-template init
```

#### `dc-template` (默认命令)

编译模板

```bash
# 使用默认配置编译模板
dc-template

# 指定模板文件和输出文件
dc-template -i template.hbs -o output.txt

# 指定环境数据文件
dc-template -e data.json

# 指定输出模式
dc-template -m append
```

#### `dc-template batch`

批量编译模板

```bash
# 批量编译模板
dc-template batch

# 启用批量处理模式
dc-template -b true
```

### 命令选项

- `-e, --env`: 环境数据文件 JSON 文件相对路径（优先级高于 envData）
- `-E, --envData`: 环境变量数据（JSON 字符串）
- `-i, --input`: 模板文件相对路径（优先级高于 inputTemplate）
- `-I, --inputData`: 模板数据
- `-o, --output`: 输出文件路径
- `-m, --mode`: 输出模式，可选值：`overwrite`（默认）、`append`、`replace`、`return`
- `-b, --batch`: 是否批量处理，默认为 `false`
- `-R, --rootDir`: 运行目录
- `-C, --configPath`: 配置文件相对路径，默认为 `./.done-coding/template.json`
- `--rollbackDelAskAsYes`: 回滚删除询问默认 yes（即不再额外询问，直接认为同意），默认为 `false`
- `--rollbackDelNullFile`: 回滚时是否删除空文件，默认为 `false`
- `-d, --dealMarkdown`: （检测是 markdown）是否处理（单个）代码块包裹，默认为 `false`
- `-r, --rollback`: 是否回滚，默认为 `false`

## 使用示例

### 基础使用场景

```bash
# 1. 初始化配置
dc-template init

# 2. 编译单个模板
dc-template -i template.hbs -o output.html

# 3. 使用环境数据文件
dc-template -i template.hbs -o output.html -e data.json

# 4. 批量编译模板
dc-template batch
```

### 不同输出模式

```bash
# 覆盖模式（默认）
dc-template -i template.hbs -o output.txt -m overwrite

# 追加模式
dc-template -i template.hbs -o output.txt -m append

# 替换模式
dc-template -i template.hbs -o output.txt -m replace

# 返回模式（不写入文件）
dc-template -i template.hbs -m return
```

### 回滚操作

```bash
# 执行回滚
dc-template -r true

# 回滚时自动确认删除
dc-template -r true --rollbackDelAskAsYes true

# 回滚时删除空文件
dc-template -r true --rollbackDelNullFile true
```

### Markdown 处理

```bash
# 处理 Markdown 代码块
dc-template -i template.md -o output.md -d true
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc template init
dc template -i template.hbs -o output.txt
dc template batch

# macOS/Linux 系统
DC template init
DC template -i template.hbs -o output.txt
DC template batch
```

## 配置

通过 `dc-template init` 命令可以初始化配置文件 `.done-coding/template.json`。

具体的配置选项需要查看初始化后生成的配置文件内容。

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## 故障排除

### 常见问题

**Q: 配置文件找不到**

```bash
# 检查配置文件是否存在
ls -la .done-coding/template.json

# 重新初始化配置
dc-template init
```

**Q: 模板编译失败**

```bash
# 检查模板文件是否存在
ls -la template.hbs

# 检查环境数据文件格式
cat data.json | jq .

# 验证模板语法
dc-template -i template.hbs -m return
```

**Q: 回滚失败**

```bash
# 检查是否有可回滚的操作
dc-template -r true

# 强制回滚并删除空文件
dc-template -r true --rollbackDelNullFile true
```

### 调试模式

```bash
# 查看版本信息
dc-template --version

# 查看帮助信息
dc-template --help
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
cd done-coding-cli/packages/template

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
