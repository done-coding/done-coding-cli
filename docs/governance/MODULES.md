# 领域模块目录（MODULES）

> 文档定位：设计视图 · 回答「有哪些领域、各自代码住哪儿」；现状见 `SNAPSHOT.md`。
> 划分口径 = `harness-workspace` §一 物理单元 → 领域映射：物理单元为 `packages/*`（git 跟踪）；
> 聚合容器（`cli` / `mcp` / `cli-skills` / `dex` 的工具扩展）骨架与切片分两层归属。
> **新增包 / 某包补了前端视图等新落点 ⇒ [MUST] 同批改本表**（新落点并入原领域，不另立）。

## 垂直 · 业务领域

| 领域        | 落点                                                                                                                                                          | 职责                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ai`        | `packages/ai`                                                                                                                                                 | **已下线**（2026-10-02 批次 mhzjan 退役删除，对话改用 `dex`）            |
| `cc-switch` | `packages/cc-switch`                                                                                                                                          | Claude Code 路由 / profile 切换                                          |
| `component` | `packages/component`                                                                                                                                          | 组件生成（基于 generator 的具名批次实例）                                |
| `config`    | `packages/config`                                                                                                                                             | 工程化配置下发                                                           |
| `create`    | `packages/create` · `mcp/src/handlers/create.ts` · `cli-skills/skills/create-done-coding/`                                                                    | 从模板创建项目                                                           |
| `dex`       | `packages/dex`（除 `src/extensions/generator.ts` 切片）                                                                                                       | Dex 编码智能体（pi-coding-agent 集成层 + cc-switch 配置导入）            |
| `extract`   | `packages/extract`                                                                                                                                            | 信息提取                                                                 |
| `generator` | `packages/generator` · `mcp/src/handlers/{generator,templates}.ts` · `cli-skills/skills/{cli-generator,module-generate}/` · `dex/src/extensions/generator.ts` | 通用具名批次生成 + assemble 组装 + tree 模块生成（content-free 机制层）  |
| `git`       | `packages/git`                                                                                                                                                | git 跨平台操作                                                           |
| `harness`   | `packages/harness` · `cli-skills/skills/cli-harness/`                                                                                                         | harness-workspace 治理工具化（清单 / 闸 / 跨仓 issue；scope 仓库注册表） |
| `inject`    | `packages/inject`                                                                                                                                             | 信息（JSON）注入                                                         |
| `mrm`       | `packages/mrm`                                                                                                                                                | **已下线**（2026-10-02 批次 mhzjan 退役删除，模型切换改用 `cc-switch`）  |
| `publish`   | `packages/publish`                                                                                                                                            | 项目发布命令（面向使用方项目，≠ 本仓发版）                               |
| `template`  | `packages/template`                                                                                                                                           | 模板预编译                                                               |

## 垂直 · 平台领域

| 领域         | 落点                                           | 职责                                                |
| ------------ | ---------------------------------------------- | --------------------------------------------------- |
| `utils`      | `packages/utils`                               | 全包共享技术件（命令构建 / 安全路径 / 交互 / 输出） |
| `mcp`        | `packages/mcp`（除各领域 handler 切片）        | MCP server 骨架（server-agnostic 注册与传输）       |
| `cli-skills` | `packages/cli-skills`（除 `skills/<x>/` 切片） | Agent Skills 聚合与安装器骨架                       |

## 共享骨架（不属任何领域；批次触及 [MUST] 在 `PROGRESS.md` 声明独占）

`packages/cli`（`DC` 主命令聚合注册）· 根 `package.json` · `pnpm-lock.yaml` · `pnpm-workspace.yaml` · `lerna.json` · `.github/workflows/`

## 横向领域（[MUST NOT] 进批次 `modules`）

| 领域             | 串行写点                                                            |
| ---------------- | ------------------------------------------------------------------- |
| 调度 · `release` | `lerna publish`（版本 bump + tag 只能一个写者）；发版需当轮单独授权 |
