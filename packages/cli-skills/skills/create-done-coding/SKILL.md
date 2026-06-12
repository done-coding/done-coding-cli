---
name: create-done-coding
description: Use when scaffolding / creating / initializing a new done-coding project from a template（创建、初始化、新建 done-coding 项目；用 done-coding 模板生成工程）. Drives the create-done-coding CLI non-interactively via npx — no resident MCP needed.
---

# 创建 done-coding 项目（create-done-coding）

用 `create-done-coding` CLI 从模板**非交互**地生成 done-coding 项目。全程经 `npx ...@latest` 现取现用，无需预装 CLI、无需常驻 MCP。

## 何时用

用户要：创建 / 初始化 / 新建一个 done-coding 项目；用某模板 scaffold 工程；从模板列表里挑一个生成。

## 前置：确定模板来源（templateUrl）

模板来源是一个 git 地址或本地 git 仓库根路径。两种拿法：

1. **用户已指明模板**（给了 git 地址 / 本地路径）→ 直接作为 `-p` 的值。
2. **从本地模板列表挑**：用户维护的模板列表是一个 JSON：
   ```json
   { "templateList": [ { "name": "...", "url": "<git 或本地路径>", "directory": "<仓库内子目录,可选>", "branch": "<分支,可选>" } ] }
   ```
   读这个文件，和用户确认选哪一个，取其 `url`（及 `directory` / `branch`）。

> [MUST] 显式传 `-p <url>`（或 `--templateConfig <本地列表>`）。不要依赖「不传任何来源时静默回落远端默认列表」的行为——来源要可见、可复述。

## 步骤

### 1. 查询模板需要哪些答案

```bash
npx create-done-coding@latest \
  -p <templateUrl> \
  [--templateDirectory <仓库内子目录>] \
  [-b <分支>] \
  --list-questions
```

仅向 **stdout** 打印该模板预设问题清单（JSON），不创建项目。形如：

```json
[
  { "key": "organization", "required": false, "default": "done-coding" },
  { "key": "name", "required": true }
]
```

`required: true` 且无 `default` 的为**必填**，必须供答。

### 2. 收集答案后非交互创建

把答案拼成 JSON（key 对齐上一步的 `key`，**不是中文 label**），经 `--env` 一次性供答：

```bash
npx create-done-coding@latest \
  -n <projectName> \
  -p <templateUrl> \
  [--templateDirectory <仓库内子目录>] \
  [-b <分支>] \
  --env '{"name":"<projectName>","description":"...","organization":"done-coding"}'
```

- `-n <projectName>`：生成的项目目录名。
- 无 TTY 时 CLI 自动进入非交互模式，缺必填项会**快速失败**并在 stderr 列出缺哪些，不会卡住。
- 生成位置在当前工作目录下的 `<projectName>/`；若在已有 git 仓内，CLI 会自动跳过嵌套 `git init`。

## 要点

- **stdout 只出数据，诊断/报错走 stderr** —— 解析 `--list-questions` 结果时只读 stdout。
- **子目录模板**用 `--templateDirectory <子目录>`（如 monorepo 子包模板 `packages/xxx`），不是把子目录拼进 url。
- 创建后提示用户：`cd <projectName> && pnpm install`。
