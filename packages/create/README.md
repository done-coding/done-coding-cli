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
npm install -g done-coding
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

## 模板列表来源配置

交互式创建时展示的「可选模板列表」有三个来源，按优先级解析（**单一来源，不做自动合并**）：

1. **CLI 显式指定** `--templateConfig <本地配置文件路径>`（最高优先级）
2. **home 指针文件** `~/.done-coding/create/index.json`（CLI 未传 `--templateConfig` 时）
3. **内置远端配置**（前两者都没有时，回落默认远端模板仓库）

### 配置文件格式

模板列表配置文件是一个 JSON，形如：

```json
{
  "templateList": [
    {
      "name": "我的本地模板",
      "url": "/abs/path/to/local-template-repo",
      "description": "本地 git 模板仓库",
      "branch": "main"
    },
    {
      "name": "远端模板",
      "url": "https://github.com/you/your-template.git"
    }
  ]
}
```

- `url` 支持本地 git 仓库根路径（`/` 开头）或远端 git 地址。
- 文件不存在 / 非数组 / 解析失败时按空列表处理，不报错阻塞。

### home 指针文件

`~/.done-coding/create/index.json` 是一个**指针**，指向真正的配置文件：

```json
{ "configPath": "/abs/path/to/your-templates.json" }
```

### 需要合并多份配置？

工具**不自动合并**多个配置文件。若需合并，自行维护一份合并好的配置文件，再用以下任一方式指向它：

- `done-coding create --templateConfig /abs/merged.json`
- 或让 `~/.done-coding/create/index.json` 的 `configPath` 指向它

### CLI 选项

- `--templateConfig <path>`: 模板列表配置文件路径（本地）。不传则回落 home 指针 / 内置远端。

### MCP 工具

MCP 列表工具 `done_coding_list_create_templates` 的 `configPath` 为**必填**，仅读本地、**不联网**；返回的模板供 `done_coding_prepare_create_project` 使用。

## 非交互供答（CI / AI / 无 TTY）

当模板带有「预设问题」（模板仓 `.done-coding/template.json` 的 `collectEnvDataForm`，如 `organization` / `name`）时，在无 TTY 环境（CI、AI 工具、管道）下需要**一次性把答案传入**，否则无法继续。

### 行为约定

- **无 TTY 自动进入非交互模式**：检测到 `stdin`/`stdout` 非 TTY 时不再等待终端输入，缺答案直接快速失败（不会死循环卡住）。
- **必填判定**：预设问题**没有 `initial` 默认值的为必填**；有 `initial` 的非必填，未供答时自动回落到默认值。
- **缺必填**：以非 0 退出，并在错误信息中列出**所有缺失的必填项**。

### `--env` / `--env-file` 供答

key 必须对齐模板 `collectEnvDataForm[].key`（**是 key，不是中文 label**）。

```bash
# 内联 JSON
create-done-coding -n my-app -p <模板地址> \
  --env '{"organization":"acme","name":"my-app"}' \
  --openGitDetailOptimize=false

# 从 JSON 文件读取（文件内容为 { key: value } 对象）
create-done-coding -n my-app -p <模板地址> --env-file ./answers.json
```

`--env` 与 `--env-file` 同时给出时，`--env` 的字段**浅覆盖** `--env-file`。

### `--list-questions` 查询模板需要哪些答案

不创建项目，仅向 **stdout** 打印该模板的预设问题清单（JSON，机读，便于 AI / 脚本先查询再供答）：

```bash
create-done-coding -p <模板地址> --list-questions
```

输出形如：

```json
[
  { "key": "organization", "required": false, "default": "done-coding" },
  { "key": "name", "required": true }
]
```

### 选项一览

- `--env <json>`：模板预设答案（JSON 字符串）。
- `--env-file <path>`：模板预设答案 JSON 文件路径。
- `--list-questions`：仅打印模板预设问题清单（JSON），不创建项目。

> MCP 形态下使用 `done_coding_prepare_create_project` 拿到 `questions`，再用 `done_coding_complete_create_project` 的 `envData`（同一套 key）供答，等价于 CLI 的 `--env`。

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

MIT © [done-coding](https://github.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/done-coding)
- [Git 操作工具](https://www.npmjs.com/package/@done-coding/cli-git) - 本包依赖的 Git 功能
- [模板处理工具](https://www.npmjs.com/package/@done-coding/cli-template) - 本包依赖的模板引擎
- [信息注入工具](https://www.npmjs.com/package/@done-coding/cli-inject) - 本包依赖的信息注入功能
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
