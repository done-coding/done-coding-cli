---
name: create-done-coding
description: Use when scaffolding / creating / initializing a new done-coding project from a template（创建、初始化、新建 done-coding 项目；用 done-coding / hub 模板生成工程；「用 xx 模板在 yy 建一个项目」）. Asks only 3 questions (template / location / package name), infers the rest and echoes them for confirmation, then drives the create-done-coding CLI non-interactively via an installed CLI or npx — no resident MCP needed.
---

# 创建 done-coding 项目（create-done-coding）

用 `create-done-coding` CLI 从模板**非交互**地生成 done-coding 项目，无需常驻 MCP。

## 调用入口

按序用 `command -v` 判断，命中即停：ⓐ 已装 `done-coding` → `done-coding <X> …`；ⓑ 否则已装子包 → `dc-<X> …`；ⓒ 都没有 → `npx <子包>@latest …`。两者都装时优先 `done-coding <X>`，参数完全一致。

下文 CLI 示例统一写 `done-coding <X>`；执行时将入口整体等价替换为上述选中的入口。可用以下 Bash 数组保留入口和参数边界，调用时写 `"${dc_entry[@]}" <参数…>`：

```bash
if command -v done-coding >/dev/null 2>&1; then
  dc_entry=(done-coding create)
elif command -v dc-create >/dev/null 2>&1; then
  dc_entry=(dc-create)
else
  dc_entry=(npx create-done-coding@latest)
fi
```

> ⚠️ 历史上 npx 拉取的部分 `create-done-coding` 版本曾在编译模板时报 `assignWith is not defined`。当前 npm 发布版是否仍受影响尚未核实，保留此提示；遇此错可尝试已装的 `done-coding create`（同参数），并核对其内含 create 版本。

## 何时用

用户要：创建 / 初始化 / 新建一个 done-coding 项目；用某模板 scaffold 工程；从模板列表里挑一个生成。

## 心智模型（少问多答）

1. **只问 3 个必答**：模板 / 目标位置 / 包名。
2. **查问题** `--list-questions`：拿到该模板实际要哪些答案（JSON，机读）。
3. **AI 推断其余答案 → 回显确认**：用户确认或改完才往下走。
4. **带答案建** `--env`：一次性传入，非交互生成项目。

模板要么是一个 git 仓库（远端地址 / 本地绝对路径），要么是仓库内的某个子目录（用 `--templateDirectory`）。

## 步骤 0 — 只问 3 个必答（已在请求里给出的不再问）

| #   | 问题                                                        | 用途                                                           |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Q1  | **模板**（列表里的 name，或直接给 git 地址 / 本地仓库路径） | 定 `-p` / `--templateDirectory` / `-b`（见下「确定模板来源」） |
| Q2  | **目标位置**：父目录绝对路径 + 项目目录名                   | 定 `--rootDir` + `-n`                                          |
| Q3  | **包名**（如 `@org/name`）                                  | 推 `organization` / `name`，并作其余推断的锚                   |

[MUST NOT] 把模板的其余问题逐项甩给用户——那些由步骤 2 推断。

## 前置：确定模板来源（templateUrl）

模板来源是 git 地址或本地 git 仓库**根路径**（`/` 开头）。两种拿法：

ⓐ **用户已指明模板**（给了 git 地址 / 本地路径）→ 直接作为 `-p` 的值。
ⓑ **从本地模板列表挑**：模板列表的**入口是全局指针文件** `~/.done-coding/create/index.json`，解析分两跳：

1. **第一跳（指针）** 读 `~/.done-coding/create/index.json`，内容形如 `{ "configPath": "<注册表绝对路径>" }`，取出 `configPath`。也可直接跑 `done-coding create template-config`（无参）查看当前指向及其是否可用（文件存在、模板数）。
2. **第二跳（注册表）** 读 `configPath` 指向的 JSON，取 `templateList`：

```json
{
  "templateList": [
    {
      "name": "...",
      "url": "<git 或本地仓库根路径>",
      "directory": "<仓库内子目录,可选>",
      "branch": "<分支,可选>"
    }
  ]
}
```

按 `name` 选定一项，取出它的 `url` / `branch` / `directory`。

> **AI 非交互调用（主场景）[MUST] 自己解析 name→url**：把选中项的 `url` 传 `-p`、`branch` 传 `-b`、`directory` 传 `--templateDirectory`。**不要**指望 `--templateConfig` + `--env '{"template":"<name>"}'` 按 name 选——已实测：非交互模式下 CLI 不吃这个，报 `缺少参数 template` 直接失败（`--templateConfig` 只为**交互式选单**供数据，无 TTY 时选不了）。
> [MUST NOT] 跳过指针链、凭记忆或上下文里已有的路径硬编码——来源要现查、可复述。

ⓒ **全局没配指针 / 目标不在列表**（第一跳 `~/.done-coding/create/index.json` 不存在，或列表里找不到要的模板）→ [MUST] **反问用户**：「把本地哪个仓库（绝对路径或 git 地址）的哪个目录当作模板？」，仓库作 `-p`、目录作 `--templateDirectory`（无子目录则不传）。[MUST NOT] 自己静默回落远端默认列表，也别自己编仓库路径。
用户若给出的是一份**模板清单文件**（含 `templateList`）并希望以后都从它选，经用户同意后用 `done-coding create template-config <清单路径>` 登记（会改本机全局配置）；[MUST NOT] 手改 `~/.done-coding/create/index.json`。

> [MUST] 显式传 `-p <url>`（或 `--templateConfig <本地列表路径>`）。不要依赖「不传任何来源时静默回落远端默认列表」——来源要可见、可复述。
> 子目录模板用 `--templateDirectory <子目录>`（如 monorepo 子包 `packages/xxx`），**不要**把子目录拼进 `url`；本地来源的 `url` 必须是 git 仓库根。

## 步骤 1 — 查询模板需要哪些答案

```bash
done-coding create \
  -p <templateUrl> \
  [--templateDirectory <仓库内子目录>] \
  [-b <分支>] \
  --list-questions
```

仅向 **stdout** 打印 JSON（不创建项目，退出码 0）。形如：

```json
[
  { "key": "organization", "required": false, "default": "done-coding" },
  { "key": "name", "required": true },
  { "key": "description", "required": true }
]
```

判定规则：

- `required: true`（且无 `default` 字段）→ **必填**，[MUST] 供答。
- `required: false`（带 `default`）→ 选填，不供答则回落 `default`。

## 步骤 2 — AI 推断其余答案

对步骤 1 返回的每个 key，据 Q1–Q3 + 下列约定补值：

- `organization` ← 包名的 scope；`name` ← 包名的 name（或项目目录名）
- 命名派生类（如 `cacheNamespace`）← 按约定从 name 变换（如 `admin-growth` → `ADMIN_GROWTH`）
- 描述类（`description` / `chineseName` / `appName` 等）← 据 name 语义生成简洁值
- 带 `default` 的选填 key → 用默认值；其余按语义补

**[MUST] 标出「不可凭空猜」的 key**：凭证类（如后端签发的 `appKey`）、真实分配的资源（真子域 `deployDomain`、已分配端口 `devPort` 等）。这类在步骤 3 显式请用户核对，[MUST NOT] 把猜测值当真值落地。

## 步骤 3 — 回显全部答案，等用户确认（[MUST]，不可跳过）

把「3 必答 + AI 推断的全部 key=value」列成表，标明哪些是推断、哪些疑似需真值，问「确认创建 / 改哪些」。用户确认或改完才进步骤 4。这一步防止 AI 把猜错的值写进真项目。

## 步骤 4 — 非交互创建

答案拼成 JSON（key 对齐步骤 1 的 `key`，**是 key 不是中文 label**），经 `--env` 一次性供答：

```bash
done-coding create \
  -n <projectName> \
  -p <templateUrl> \
  [--templateDirectory <仓库内子目录>] \
  [-b <分支>] \
  [--rootDir <父目录绝对路径>] \
  --env '{"name":"<projectName>","description":"...","organization":"done-coding"}'
```

答案多时可改用文件：`--env-file ./answers.json`（内容为 `{ key: value }`）。两者同给时 `--env` 浅覆盖 `--env-file`。

## 完整示例

从某 monorepo hub 的子包模板 `packages/npm-node-cli`（本地仓库根 `/abs/hub`，分支 master）创建名为 `my-tool` 的项目：

```bash
# 1. 先查问题
done-coding create -p /abs/hub -b master \
  --templateDirectory packages/npm-node-cli --list-questions
# → [{"key":"organization","required":false,"default":"done-coding"},
#    {"key":"organizationAbr","required":false,"default":"dc"},
#    {"key":"name","required":true},{"key":"description","required":true},
#    {"key":"repositoryUrl","required":false,"default":""}]

# 2. 推断其余答案并经用户确认后创建
done-coding create -n my-tool -p /abs/hub -b master \
  --templateDirectory packages/npm-node-cli \
  --env '{"name":"my-tool","description":"我的命令行工具","organization":"done-coding"}'
# → 生成 ./my-tool/
```

## 行为约定（据实测）

- **退出码可信**：缺必填 / 失败 → **退出码 1**，且在 **stderr** 列出缺哪些（如 `name(包名)、description(描述)`），不创建任何目录；成功 → 退出码 0。agent 可直接靠退出码判断成败。
- **stdout 只出数据**：`--list-questions` 的 JSON 走 stdout，诊断/报错走 stderr——解析时只读 stdout。
- **无 TTY 自动非交互**：CI / agent / 管道环境下不等终端输入，缺答案即快速失败，不会卡住。
- **生成位置**：当前工作目录下的 `<projectName>/`（或 `--rootDir` 指定的根下）。
- **git 行为**：默认会对新项目做 git 初始化；但若创建在**已有 git 仓库内**（如往 monorepo 的 `packages/` 下生成），会自动**跳过**嵌套 `git init`。
- **创建后的使用步骤以 CLI 输出为准**：CLI 末尾打印「使用步骤」（`cd <项目名>` + 模板在 `template.json` 声明的 `usageSteps`，未声明则 `pnpm install` / `pnpm run dev`），原样转告用户，[MUST NOT] 自己套 pnpm 步骤（Go / Python 模板、monorepo 成员各不相同）。
- 报告生成路径；注册表 / 指针缺失或模板不在列表 → 按上文 ⓒ 反问，[MUST NOT] 静默回落或编路径。

## 选项速查（公开项）

| 选项                  | 别名 | 说明                                               |
| --------------------- | ---- | -------------------------------------------------- |
| `--projectName`       | `-n` | 项目名称（生成的目录名）                           |
| `--templateUrl`       | `-p` | 模板地址：git 地址或本地仓库根路径                 |
| `--templateGitBranch` | `-b` | 模板仓库分支                                       |
| `--templateDirectory` |      | 仓库内模板子目录                                   |
| `--templateConfig`    |      | 本地模板列表配置文件路径                           |
| `--rootDir`           |      | 生成位置的父目录（缺省当前目录；帮助中隐藏但可用） |
| `--env`               |      | 预设答案 JSON 字符串                               |
| `--env-file`          |      | 预设答案 JSON 文件路径                             |
| `--list-questions`    |      | 仅打印模板预设问题清单(JSON)，不创建               |
| `--gitCommitMessage`  | `-m` | git 初始化的提交信息                               |
