# SNAPSHOT — create

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/create/README.md`；架构见 `docs/TECH_SNAPSHOT.md`。

## 技术快照

- 当前版本以 `packages/create/package.json` 为准。两条执行路径：交互（`interactiveCreateHandler`）与 prepare / complete（非交互、MCP）。
- 命令入口：`done-coding create` ↔ `dc-create`，参数一致；保留 `create-done-coding` / `npm create done-coding`（两个 bin 指向同一 `es/cli.mjs`）。
- 项目名：位置参数 `[project]` 与 `-n/--projectName` 等价，不一致即报错（不打调用栈）；合并后移除 `project` 键，不混入模板预设答案。克隆模式 `--justCloneFromDoneCoding`（别名 `--clone`）为隐藏选项，README 不宣传，非交互拒绝（6zzib5，0.24.0 已发布）。
- 完成提示：`cd <项目名>` + 模板 `usageSteps`（缺省 `pnpm install` / `pnpm run dev`），在模板配置被编译删除前读取；complete 返回值带 `usageSteps`。
- `template-config [path]`：模板清单指针（`~/.done-coding/create/index.json` 的 `configPath`）的查看 / 登记 / `--unset` 清除；登记前校验清单存在且 `templateList` 为数组，原子写、保留其它字段。指针是 create 内部约定，外部（模板仓根脚本等）经本命令登记。
- 模板来源（zsz54k，未发布）：本地模板仓未给 `-b` 时取远端默认分支（fetch origin best-effort → `origin/HEAD` → `origin/master` → `origin/main` → 本地 `master` / `main`，都没有报错要求 `-b`），不读当前检出；在途分支 / 标签用 `-b`。远程源 `clone --depth=1` 取远端默认分支。打印「url @ ref (短 sha)」。
- 出生记录（zsz54k，未发布）：编译后、git 初始化前写 `<项目>/.done-coding/template.lock.json`（模板、url、remoteUrl、directory、实际 ref、commit、非交互答案、createdAt、cli）；`secret: true` 问题只记 key；交互模式无 answers。`instances.json` 条目补 `templateDirectory` / `templateCommit`。按 lock 做模板升级未做。
- 草稿 `<rootDir>/.done-coding/default/tmp/create/<uuid>` 在成功 / 失败 / `--list-questions` 后删除，并逐级清理空父目录至 `.done-coding`（含）；prepare 失败也清草稿。
- 测试：vitest 49 例（含非交互 e2e 与 `template-provenance`，夹具为临时本地 git 模板仓 + 本地 bare origin；指针读写注入临时基目录）。
- 交互路径 `--openGitDetailOptimize=false` 不再提前退出，照常写 lock、留痕实例、输出完成提示；包内 `tsc --noEmit` 退 0。

## 业务快照

- template-hub 的 Go / Python / monorepo 成员模板需在各自 `template.json` 声明 `usageSteps` 才能得到正确提示（hub 侧动作，未做）。
- template-hub 可在根目录加 `register:create` 脚本经 `template-config` 一键登记 `templates.manifest.json`（hub 侧动作，2026-10-23 发版后已提 template-hub issue `vfohs8`）。

- AI 入口：skill `create-done-coding` 按 `command -v` 优先 `done-coding create`、再 `dc-create`、最后 `npx create-done-coding@latest`，走「3 必答（模板 / 位置 / 包名）+ AI 推断其余 + 回显确认」，已并入 hub `x-create` 规则（cli-skills 0.3.0 已发布，hub 可删自身 `x-create`，已向 hub 提 issue）。

## UX 快照

终端输出：阶段日志 + 成功行 + 编号「使用步骤」。
