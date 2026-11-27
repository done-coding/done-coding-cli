# SNAPSHOT — create

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/create/README.md`；架构见 `docs/TECH_SNAPSHOT.md`。

## 技术快照

- 当前版本以 `packages/create/package.json` 为准。两条执行路径：交互（`interactiveCreateHandler`）与 prepare / complete（非交互、MCP）。
- 命令入口：`done-coding create` ↔ `dc-create`，参数一致；保留 `create-done-coding` / `npm create done-coding`（两个 bin 指向同一 `es/cli.mjs`）。
- 项目名：位置参数 `[project]` 与 `-n/--projectName` 等价，不一致即报错（不打调用栈）；合并后移除 `project` 键，不混入模板预设答案。克隆模式 `--justCloneFromDoneCoding`（别名 `--clone`）为隐藏选项，README 不宣传，非交互拒绝（6zzib5，0.24.0 已发布）。
- 完成提示：`cd <项目名>` + 模板 `usageSteps`（缺省 `pnpm install` / `pnpm run dev`），在模板配置被编译删除前读取；complete 返回值带 `usageSteps`。
- `template-config [path]`：模板清单指针（`~/.done-coding/create/index.json` 的 `configPath`）的查看 / 登记 / `--unset` 清除；登记前校验清单存在且 `templateList` 为数组，原子写、保留其它字段。指针是 create 内部约定，外部（模板仓根脚本等）经本命令登记。
- 模板来源（ap4hc0，未发布；目标定义见 `README.md`）：本机路径 url 在模板仓 `git worktree add --detach` 检出 HEAD（列表项 `branch` 或 `-b` 显式给了才用该分支 / 标签），不联网、不推断远端分支，用完 `worktree remove`（失败兜底删目录 + `prune`），模板仓不留临时分支；模板目录不存在时报错点名模板仓、分支与目录。远程 url `clone --depth=1`（有分支带 `-b`）。之后同路：只复制 `directory`（不含 `.git`），模板目录本身是符号链接时按指向复制真实文件（越出检出目录拒绝），子树内链接保留相对文本；模板编译以受限模式调用 cli-template（`confineToRootDir`），读模板配置经 `readTemplateConfig` 做同样判定（0.22.0 已发布）。打印「url [@ 显式分支] (短 sha)」。create 0.20.0–0.22.0 的远端默认分支推断（zsz54k / g4p7sa / ynfow5）已撤销。
- 来源记录：项目内不写 `template.lock.json`（zsz54k 引入、ap4hc0 撤销，未发布；7xqj4i：含本机绝对路径与模板远程地址并入库）。`instances.json`（本机）条目记 `templateDirectory` / `templateCommit`，`templateBranch` 只在显式指定或远程 clone 时有值。
- 草稿 `<rootDir>/.done-coding/default/tmp/create/<uuid>` 在成功 / 失败 / `--list-questions` 后删除，并逐级清理空父目录至 `.done-coding`（含）；prepare 失败也清草稿。
- `templates [--templateConfig] [--json]`（ggjh2p，0.21.0 已发布）：列可选项目模板（名称、描述、来源、目录、分支），与交互选单同源；create-done-coding skill 改为先跑它、向用户展示 name + description。`templates` 与 `instances` / `template-config` 一样是子命令名，不能再直接当项目名。
- 测试：`template-provenance` 夹具为临时本地 git 模板仓（origin 指向不存在地址验证不联网），断言取 HEAD 已提交内容、显式分支 / 标签、模板仓无 worktree / 临时分支残留、不写 lock；另有非交互 e2e（依赖包 build）。
- 交互路径 `--openGitDetailOptimize=false` 不提前退出，照常留痕实例、输出完成提示。

## 业务快照

- template-hub 的 Go / Python / monorepo 成员模板需在各自 `template.json` 声明 `usageSteps` 才能得到正确提示（hub 侧动作，未做）。
- template-hub 可在根目录加 `register:create` 脚本经 `template-config` 一键登记 `templates.manifest.json`（hub 侧动作，2026-10-23 发版后已提 template-hub issue `vfohs8`）。

- AI 入口：skill `create-done-coding` 按 `command -v` 优先 `done-coding create`、再 `dc-create`、最后 `npx create-done-coding@latest`，走「3 必答（模板 / 位置 / 包名）+ AI 推断其余 + 回显确认」，已并入 hub `x-create` 规则（cli-skills 0.3.0 已发布，hub 可删自身 `x-create`，已向 hub 提 issue）。

## UX 快照

终端输出：阶段日志 + 成功行 + 编号「使用步骤」。
