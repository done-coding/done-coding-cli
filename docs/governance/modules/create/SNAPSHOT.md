# SNAPSHOT — create

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/create/README.md`；架构见 `docs/TECH_SNAPSHOT.md`。

## 技术快照

- 版本 0.17.0（2026-10-23 发布）。两条执行路径：交互（`interactiveCreateHandler`）与 prepare / complete（非交互、MCP）。
- 完成提示：`cd <项目名>` + 模板 `usageSteps`（缺省 `pnpm install` / `pnpm run dev`），在模板配置被编译删除前读取；complete 返回值带 `usageSteps`。
- `template-config [path]`：模板清单指针（`~/.done-coding/create/index.json` 的 `configPath`）的查看 / 登记 / `--unset` 清除；登记前校验清单存在且 `templateList` 为数组，原子写、保留其它字段。指针是 create 内部约定，外部（模板仓根脚本等）经本命令登记。
- 测试：vitest 34 例（含非交互 e2e，夹具为临时本地 git 模板仓；指针读写注入临时基目录）。
- 已知：交互路径 `--openGitDetailOptimize=false` 时提前 `process.exit(0)`，不输出完成提示也不留痕实例（未入池）；`create.ts` 有 1 处既存 tsc 类型错误（handler 返回值与 yargs `void` 不符，构建不受影响）。

## 业务快照

- template-hub 的 Go / Python / monorepo 成员模板需在各自 `template.json` 声明 `usageSteps` 才能得到正确提示（hub 侧动作，未做）。
- template-hub 可在根目录加 `register:create` 脚本经 `template-config` 一键登记 `templates.manifest.json`（hub 侧动作，2026-10-23 发版后已提 template-hub issue `vfohs8`）。

- AI 入口：skill `create-done-coding` 走「3 必答（模板 / 位置 / 包名）+ AI 推断其余 + 回显确认」，已并入 hub `x-create` 规则（cli-skills 0.3.0 已发布，hub 可删自身 `x-create`，已向 hub 提 issue）。

## UX 快照

终端输出：阶段日志 + 成功行 + 编号「使用步骤」。
