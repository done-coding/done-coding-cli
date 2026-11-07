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
DC create [项目名]
```

## 快速开始

```bash
# 创建新项目（交互式）
npm create done-coding

# 创建指定名称的项目
npm create done-coding my-awesome-project
```

## 功能特性

- ✅ **快速创建**: 快速创建新的 done-coding 项目
- 🎯 **项目模板**: 提供标准化的项目模板
- 🔄 **Git 集成**: 集成 Git 仓库初始化和克隆功能
- 📝 **模板处理**: 基于模板引擎生成项目文件
- 💉 **信息注入**: 自动注入项目配置信息

## API 文档

### 基础命令

#### `create-done-coding [项目名]`

创建新项目

```bash
# 交互式创建项目
create-done-coding

# 创建指定名称的项目（位置参数与 -n 等价）
create-done-coding my-project
create-done-coding -n my-project
```

**参数说明**:

- `项目名`: 项目名称（可选）。与 `-n, --projectName` 等价；两者同时给出且不一致时报错退出。

**常用选项**（完整列表以 `create-done-coding --help` 为准）:

- `-n, --projectName`: 项目名称
- `-p, --templateUrl`: 模板地址（远程 git 地址或本地路径）
- `-b, --templateGitBranch`: 模板仓库分支
- `--env` / `--envFile`: 非交互供答模板预设问题
- `--listQuestions`: 只打印模板预设问题清单，不创建项目

#### `create-done-coding template-config [path]`

本机模板清单指针：决定交互式创建时从哪份模板清单（`{ "templateList": [...] }`）选模板。

```bash
# 查看当前指向的模板清单及其是否可用
create-done-coding template-config

# 登记模板清单（相对路径按当前目录解析为绝对路径；文件须存在且 templateList 为数组）
create-done-coding template-config ./templates.manifest.json

# 清除指向（之后回落内置远端模板列表）
create-done-coding template-config --unset
```

- 只有一个指向（不做多清单合并），重复登记以最后一次为准。
- 模板仓可在根目录加脚本一键登记，如 `"register:create": "create-done-coding template-config ./templates.manifest.json"`；请经本命令登记，不要直接改写本机配置文件。

## 使用示例

### 基础使用场景

```bash
# 1. 创建新项目（会提示输入项目名称）
npm create done-coding

# 2. 直接指定项目名称
npm create done-coding my-awesome-app
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc create
dc create my-project

# macOS/Linux 系统
DC create
DC create my-project
```

## 模板列表来源配置

### CLI 模式：三来源按优先级解析（**单一来源，不做自动合并**）

ⓐ **CLI 显式指定** `--templateConfig <本地配置文件路径>`（最高优先级）
ⓑ **home 指针文件** `~/.done-coding/create/index.json`（CLI 未传 `--templateConfig` 时）
ⓒ **内置远端配置**（前两者都没有时，回落默认远端模板仓库）

### MCP 模式：显式指定本地模板列表

MCP server 暴露三类原语：

- **Resource（模板发现）**：参数化资源 `done-coding-create-template-list://{configPath}`。读取时在 URI 中传入**本地** `configPath`（绝对路径），返回该文件 `{ templateList: [...] }` 的模板列表。仅读本地，**不联网、不读 home 全局指针、不读远端默认**。`configPath` 缺失即报错（不静默联网/不回落）。
- **Tools**：`done_coding_prepare_create_project` / `done_coding_complete_create_project`。`prepare` 的 `templateUrl` 为 **zod 必填**——从上面资源选出模板后取其 `url` 传入。
- **Prompt（引导）**：`create-done-coding-project`，串起「读模板列表资源 → 选模板 prepare → 按 need_input 供 envData → complete」。

MCP 的模板发现仅读本地配置；项目创建仍可能克隆指定的远端模板。`templateUrl` 必须显式传入，不会回落到全局指针或默认模板列表。

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

### MCP 模板发现

模板列表经 **Resource**（而非工具）发现：读取 `done-coding-create-template-list://{configPath}` 时传入**必填**的本地 `configPath`，仅读本地、**不联网**；从返回列表中取模板 `url` 作为 `templateUrl` 传给 `done_coding_prepare_create_project`（必填）。

## 非交互供答（CI / AI / 无 TTY）

当模板带有「预设问题」（模板仓 `.done-coding/template.json` 的 `collectEnvDataForm`，如 `organization` / `name`）时，在无 TTY 环境（CI、AI 工具、管道）下需要**一次性把答案传入**，否则无法继续。

### 行为约定

- **无 TTY 自动进入非交互模式**：检测到 `stdin`/`stdout` 非 TTY 时不再等待终端输入，缺答案直接快速失败（不会死循环卡住）。
- **必填判定**：预设问题**没有 `initial` 默认值的为必填**；有 `initial` 的非必填，未供答时自动回落到默认值。
- **缺必填**：以非 0 退出，并在错误信息中列出**所有缺失的必填项**。
- **输出分流**：诊断与报错走 **stderr**，**stdout 只输出数据**（如 `--list-questions` 的 JSON），便于管道/脚本区分。

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

## 完成提示：模板声明使用步骤

创建成功后输出「使用步骤」：首步固定为 `cd <项目名>`，其后默认 `pnpm install` / `pnpm run dev`。
不走这套命令的模板（Go / Python、monorepo 成员等）在 `.done-coding/template.json` 声明 `usageSteps` 覆盖：

```json
{
  "usageSteps": ["make run", "make check"],
  "collectEnvDataForm": []
}
```

- `usageSteps` 须为非空字符串数组，否则创建以非 0 退出并指出该字段。
- 非交互（MCP `complete`）的返回值带 `usageSteps`（含首步 `cd`），供 AI 直接读取。

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

## 许可证

MIT © [done-coding](https://github.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/done-coding)
- [Git 操作工具](https://www.npmjs.com/package/@done-coding/cli-git) - 本包依赖的 Git 功能
- [模板处理工具](https://www.npmjs.com/package/@done-coding/cli-template) - 本包依赖的模板引擎
- [信息注入工具](https://www.npmjs.com/package/@done-coding/cli-inject) - 本包依赖的信息注入功能
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
