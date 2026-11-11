---
id: zsz54k
title: create 模板来源：默认取远端 master／标签 + template.lock 出生记录 + 临时目录清理
modules: [create]
created: 2026-11-09
source: 总协调分诊派单（用户 2026-11-09 触发，服务 M3 业务仓少返工 + M4 生成读数）
after: 0cja0o
---

# create 模板来源与出生记录

aw9v0m 与 a5di8q 一并做：模板源默认取远端 master 或钉住的标签，不读本机检出；在途分支须显式指定；生成时写 `.done-coding/template.lock.json` 记录来源与 commit。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| aw9v0m 模板源默认取远端 master／标签，不读本机检出 | 已完成 | 62ebe0c |
| a5di8q 实例内写 template.lock 出生记录 | 已完成 | 62ebe0c |
| houlh1 --rootDir 成功后残留空临时目录 | 已完成 | 62ebe0c |
| 刷新所涉模块快照与上层摘要；归档本批（只留 PROGRESS.md），`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 串末，收工 | | |

## 边界

同 `0cja0o`「边界（整串通用）」。

## 进度

### 设计（2026-11-09，开工前定）

实测根因：
- aw9v0m：`templateSource.ts` 本地源 `git worktree add … ${branch ?? "HEAD"}`——未传 `-b` 即取模板仓当前检出。远程源 `git clone --depth=1` 不带 `-b` 时取远端默认分支，本身符合预期。
- houlh1：草稿落 `<rootDir>/.done-coding/default/tmp/create/<uuid>/`，成功 / 失败 / `--list-questions` 三处只删 `<uuid>`，空父目录 `create/`、`tmp/`、`default/`、`.done-coding/` 留下。
- a5di8q：实例内无出生记录；`instances.json` 只记 path / template / templateUrl / templateBranch。

做法：
- 本地源默认 ref（未传 `-b`、模板清单项未钉 `branch`）：有 `origin` 则先 `git fetch origin`（失败只告警，用已有远端跟踪分支）→ `origin/HEAD` 指向的分支 → `origin/master` → `origin/main`；无 `origin` 用本地 `master` → `main`；都没有 fail-loud 要求 `-b`。永不回落当前检出 HEAD。显式 `-b` 照旧（分支 / 标签 / 本地在途分支都可）。远程源不变。
- 生成时取实际 commit（worktree / clone 内 `git rev-parse HEAD`），打印「模板来源：<url> @ <ref> (<短 sha>)」。
- 出生记录 `<实例>/.done-coding/template.lock.json`，在模板编译之后、git 初始化提交之前写（随首个提交入库）：`version: 1`、`template`、`url`、`remoteUrl`（本地源有 origin 时）、`directory`、`branch`（实际使用的 ref）、`commit`、`answers`、`createdAt`、`cli: { name, version }`。`answers` 只记非交互传入的 `--env` / `--envFile`（MCP complete 的 envData 同理），交互模式问答在 cli-template 内部完成、create 拿不到，省略该字段（不为此改 template 领域）；模板 `collectEnvDataForm` 项标 `secret: true` 的只记 key 不记值（`secretKeys`）。
- `instances.json` 条目补 `templateDirectory` / `templateCommit`（`templateBranch` 改记实际 ref）。
- 草稿清理后自 `create/` 起逐级删空目录，止于 `<rootDir>/.done-coding`（含），遇非空即停，不越出 rootDir。

### 实现记录

- 三条在 create 内交织（`templateSource.ts` / `create.ts` / 新增 `utils/create-artifacts.ts`），一笔提交交付。实现经 Codex（gpt-6.1-sol medium，workspace-write 沙箱）完成，Claude 复核：读全量 diff；把 Codex 自写的 `isInside` 换成 cli-utils 既有 `pathIsInsideParentDir`（复用现有抽象），注册表新字段补注释、对齐大括号风格。
- 附带行为变化（复核接受）：prepare 失败（如无默认分支）也删草稿；交互模式关闭 git 细节优化时不再 `process.exit(0)` 提前退出，照常写 lock、留痕注册表、打印完成——原先此路径漏记注册表。
- 验证：create `eslint .` 退 0、build 退 0、vitest 6 文件 49 例全过（新增 `template-provenance.test.ts`：开发分支检出带未合入改动时默认取 origin/HEAD、`-b` 取在途分支与标签、fetch 更新跟踪分支、fetch 失败用已有跟踪分支、无默认分支报错且清草稿、lock / 注册表字段与 commit、secret 只记 key、空父目录清理与保留既有 `.done-coding`、拒绝 symlink 逃逸；e2e 断言 lock 入首个提交、rootDir 不残留 `.done-coding`）；cli-skills vitest 15 例全过。未覆盖：真实网络远端、人工 TTY 问答。
- 收口：快照刷新 `modules/create/SNAPSHOT.md`、上层 `SNAPSHOT.md` create 行、`docs/BUSINESS_SNAPSHOT.md` create 行；create `tsc --noEmit` 退 0。
