# 业务快照

> 最后更新：2026-04-26
> 关联任务：项目全局快照梳理

## 1. 业务领域与背景

### 产品定位

done-coding-cli 是一个面向 **Node.js 前端/全栈开发者**的 CLI 工具集，通过单一二进制 `DC`（及等效别名 `dc-cli`、`done-coding`）覆盖**创建→开发→工程配置→发布→AI 辅助**全流程。

### 核心价值

| 痛点 | 替换方式 |
|---|---|
| 项目初始化：手动 git clone + 改 package.json + 改配置 | `DC create` / `npm create done-coding`，一次交互完成 |
| 工程配置：手动装 ESLint/Prettier/Husky/commitlint 并写配置文件 | `DC config add -m eslint prettier commitlint ls-lint` 一键拉取安装 |
| 组件创建：复制粘贴 + 改名称 + 改引用 | `DC component add <name>` |
| 分支保护：靠口头约定防止倒灌合并 | `DC git hooks` 在 git hook 层自动拦截 reverse-merge |
| 发布：手动改版本 + npm publish + git push + git tag | `DC publish -t patch -d latest` 一条命令 |
| AI 辅助 | `DC` 无子命令 → 进入 AI 对话；`DC ai` → 独立入口 |

### 关键术语

| 术语 | 含义 |
|---|---|
| `DC` | 主二进制命令，全局安装后的入口。同义别名：`dc-cli`、`done-coding`。macOS/Linux 上不能用小写 `dc`（与系统 dc 命令冲突），Windows 可以 |
| `npm create` 约定 | `npm create <foo>` = 执行 `create-<foo>` 包的 bin；`npm create done-coding` 等价于直接执行 `create-done-coding` 的主命令 |
| 子包 | `packages/` 下每个目录是一个独立 npm 包，可被单独安装使用，也可经主 `DC` 命令统一调用 |
| `DC <subcommand>` | 主命令下按 yargs 注册的子命令路由，如 `DC git` 映射到 `@done-coding/cli-git` |
| `injectInfo.json` | 每个子包在 `src/` 下的元数据 JSON（含 name/version/description/bin/cliConfig），构建时由 `@done-coding/cli-inject` 写入，运行时被 `import` 使用 |
| MCP / hijack 模式 | 父进程通过 `DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON` 环境变量驱动子 CLI 进程：跳过 `prompts` 交互、结果写到日志、子进程完成后退出——使 AI agent 可无阻塞调用任何子命令 |
| xPrompts | `@done-coding/cli-utils` 对 `prompts` 库的封装，内置 hijack 感知（检测到 hijack 模式时自动跳过交互） |
| reverse-merge | 将分支等级高的分支（如 `main`）合并到等级低的分支（如 `feature`），属于 Git Flow 违规。`DC git check reverse-merge` 通过 reflog/提交记录检测并拦截 |

## 2. 用户画像

| 角色 | 目标 | 典型调用 |
|---|---|---|
| **新手开发者** | 一行创建项目，不想手动配 lint/format | `npm create done-coding` |
| **日常开发者** | 统一入口执行各项操作 | 全局装 `@done-coding/cli`，用 `DC <cmd>` |
| **Tech Lead** | 强制团队工程规范 + 分支合并规则 | `DC config add -g`（提交到 git）、`DC git hooks` 配合 husky |
| **AI Agent** | 通过 MCP 无阻塞调用任何 CLI 子命令 | 所有子命令的 hijack 模式 |
| **贡献者** | 修改源码或新增子包 | `pnpm dev`、Conventional Commits、PR |

## 3. 调用层架构

### 用户可达的命令入口

| 入口 | 示例 | 适用场景 |
|---|---|---|
| 主全局 CL I | `npm i -g @done-coding/cli` → `DC <subcommand>` | 日常使用 |
| 子包独立 bin | `dc-component add Button`、`dc-git clone github user` | 只装单个子包时 |
| npm create 约定 | `npm create done-coding`、`pnpm create done-coding` | 零安装创建项目 |

### 子命令路由表

> **路由规则：** 当用户在 `DC <subcommand>` 之后未继续指定二级命令时（例如只输入 `DC create`），yargs 会自动路由到该子包设定的默认命令。下表中标注"默认"的即为未指明时的兜底路由目标。

| 用户输入 | 映射子包 | 可用二级命令 |
|---|---|---|
| `DC create` | `create-done-coding` | `create`（未指明时默认执行） |
| `DC component` | `@done-coding/cli-component` | `add`、`remove`、`list` |
| `DC config` | `@done-coding/cli-config` | `check`、`add` |
| `DC extract` | `@done-coding/cli-extract` | `init`、`generate`（未指明时默认执行） |
| `DC inject` | `@done-coding/cli-inject` | `init`、`generate`（未指明时默认执行） |
| `DC publish` | `@done-coding/cli-publish` | `init`、`exec`（未指明时默认执行）、`alias` |
| `DC template` | `@done-coding/cli-template` | `init`、`compile`（未指明时默认执行）、`batch` |
| `DC git` | `@done-coding/cli-git` | `init`、`clone`、`hooks`、`check` |
| `DC ai` | `@done-coding/cli-ai` | `chat`（默认） |
| `DC`（无子命令） | `@done-coding/cli` 自身 | 交互式提问 → AI 对话或 --help |

## 4. 功能清单

各子包详情见对应 docs 目录。以下为根级概览。

| 子命令 | 包名 | 核心能力 | 状态 | 详情 |
|---|---|---|---|---|
| `DC create` | `create-done-coding` | 从 Git 模板创建项目，交互式问答，git clone + Lodash 模板编译 + git 细节优化 | `活跃` | `packages/create/docs/BUSINESS.md`（待创建） |
| `DC component` | `@done-coding/cli-component` | 组件增删查（add/remove/list），命名自动转换 | `活跃` | `packages/component/docs/BUSINESS.md`（待创建） |
| `DC config` | `@done-coding/cli-config` | 工程配置检测与安装（eslint/prettier/commitlint/ls-lint/merge-lint） | `活跃` | `packages/config/docs/BUSINESS.md`（待创建） |
| `DC extract` | `@done-coding/cli-extract` | 从源码提取信息生成文件（正则/json-inject/fixed 三种提取方式） | `活跃` | `packages/extract/docs/BUSINESS.md`（待创建） |
| `DC inject` | `@done-coding/cli-inject` | JSON 数据注入目标文件（reg/fixed/read 三种注入方式） | `活跃` | `packages/inject/docs/BUSINESS.md`（待创建） |
| `DC template` | `@done-coding/cli-template` | Lodash 模板编译引擎，支持 4 种输出模式 + 回滚 + Markdown 处理，被 create/component/extract 内部调用 | `活跃` | `packages/template/docs/BUSINESS.md`（待创建） |
| `DC git` | `@done-coding/cli-git` | 跨平台 Git 操作（init/clone/hooks/check），含 reverse-merge 检测 | `活跃` | `packages/git/docs/BUSINESS.md`（待创建） |
| `DC publish` | `@done-coding/cli-publish` | 语义化版本管理 + npm/web 发布 + 别名发布 | `活跃` | `packages/publish/docs/BUSINESS.md`（待创建） |
| `DC ai` | `@done-coding/cli-ai` | AI 交互式对话（选模型 → 填 key → SSE 流式聊天） | `活跃` | `packages/ai/docs/BUSINESS.md`（待创建） |
| — | `@done-coding/cli-utils` | 共享工具库（yargs 封装、xPrompts、配置管理、Git 工具、AES 加密等） | `活跃` | 无独立 CLI |

## 5. 核心业务流程

### 流程 1：开发者首次创建项目

```
npm create done-coding        ← 零安装，npm 自动映射到 create-done-coding
  → 交互式输入项目名
  → 从远程模板列表选择模板
  → git clone --depth=1（浅克隆）
  → 模板有 .done-coding config？→ batchCompileHandler 编译 Lodash 模板
  → git 细节优化：分支重命名 / HTTP→SSH URL / 保存或重建 git history
  → git init && git commit -m "feat: init project"
  → 输出：cd my-project && pnpm install && pnpm run dev
```

### 流程 2：日常开发完整链路

```
DC component add UserCard     ← 生成组件
  → 名称处理（camelCase/kebab-case/PascalCase）
  → 模板生成文件 + 注入环境数据

DC config check -m eslint prettier commitlint ls-lint merge-lint
  → 检测各模块配置状态
  → merge-lint 调用 DC git check reverse-merge

...编码...

DC publish -t patch -d latest
  → 读取 publish config → 升级版本号 → npm publish → git push
```

### 流程 3：MCP/Hijack（AI Agent 驱动）

```
AI Agent 调用 CLI
  → 父进程设 env: DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON
  → 子进程 processIsHijacked() = true
  → xPrompts 检测到 hijack，跳过交互，用预设值/CLI 参数填充
  → console 输出 → 日志文件（非 stdout）
  → 子进程结束
```

## 6. 业务规则与约束

### 编码与提交

- [MUST] **Conventional Commits**：`feat`/`fix`/`chore`/`docs`/`refactor`/`test`，commitlint 校验
- [MUST] **ESLint + Prettier**：统一代码风格
- [MUST] **ls-lint**：文件命名规范（kebab-case）
- [MUST] **husky + lint-staged**：提交前自动检查

### 版本管理

- **Independent versioning**：每个子包独立 SemVer 版本号，Lerna 管理
- 发布类型用 `-t` 指定或交互选择，支持 major / minor / patch / premajor / preminor / prepatch / prerelease
- dist-tag：latest / next / alpha / beta / rc

### Git 分支保护

- [MUST NOT] reverse-merge：将高等级分支合并到低等级分支
- 等级：main > develop > feature/hotfix > personal
- 检测方式：husky hooks（pre-merge-commit、prepare-commit-msg、post-merge、pre-push、pre-rebase）+ `DC git check reverse-merge`

### 环境

- Node.js >= 18.0.0
- pnpm（`preinstall` 脚本强制 `npx only-allow pnpm`）
- 跨平台：Windows / macOS / Linux

### 许可证

MIT

## 7. 已知业务债务

| 债务 | 影响 | 优先级 |
|---|---|---|
| 部分子包 README 未列出 `DC <subcommand>` 能用的具体选项，用户需靠 `--help` 反推 | 独立使用子包的用户可能因文档不全而放弃 | 中 |
| create-done-coding 的远程模板列表依赖 Gitee 外部仓库 | Gitee 不可用时 `DC create` 无法获取模板列表 | 低 |
| CHANGELOG.md 已删除但部分 README 仍含链接 | README 404 链接 | 低 |
