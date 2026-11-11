---
id: 0cja0o
title: generator 消费侧修复：lodash.template 钉版 + prettier 就近解析 + tree 入口文档
modules: [generator]
created: 2026-11-09
source: 总协调分诊派单（用户 2026-11-09 触发，服务 M3 业务仓少返工 + M4 生成读数）
after: ""
---

# generator 消费侧修复

三条均来自 done-creating-ledger 批次 kkh0cn 的生成读数。7ssnjg 最急：修好后由用户走发版。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| 7ssnjg 全新安装解析到损坏的 lodash.template 4.18.0 | 已完成 | f7b4b86 |
| kuoimm format:prettier 按 output 目录就近解析 | 已完成 | f66a4d1 |
| yhk3m5 tree 入口与模块模板发现层文档 | 已完成 | 60ea526 |
| 刷新所涉模块快照与上层摘要；归档本批（只留 PROGRESS.md），`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 本批交付归档后立即开始下一批 `zsz54k` | | |

## 边界（整串通用）

- 分支：从 master 切 `fix/generator-create-consumer`，整串提交在此分支，交付后切回 master；不叠分支、不用 worktree。push、合并、发版由用户执行。
- 共享骨架独占（本批声明）：`pnpm-lock.yaml`（7ssnjg 改 generator 依赖声明），锁文件只用 CI 同版本 pnpm 10.33.0 更新。
- 本机重任务约束（blueprint snapshot）：同一时间只跑一个重任务，测试按改动范围跑，全量只在归档前跑一次。
- 显式 pathspec 提交；门禁提交后再复跑一次。

## 进度

- 7ssnjg：根因实测——4.18.0 渲染即报 `assignWith is not defined`，npm 对该版的弃用说明为「Bad release. Please use lodash.template@4.5.0 instead.」；本机 pnpm 12 全新安装已发布的 cli-generator 0.4.0 解析到 4.18.0（复现），pnpm 10.33 / npm 当前解析到 4.18.1（不复现，解析结果随客户端而变）。修法：generator 依赖钉 `4.5.0`（与 template 包一致，调用点均不传 options，CVE-2021-23337 的 `variable` 注入不可达）；锁文件用 pnpm 10.33.0 + npmjs 源更新，diff 仅 importer specifier 一行。验证：打包本地产物后在空目录用 pnpm 12 全新安装，解析 4.5.0 且渲染正常；新增 `__tests__/dependency-pin.test.ts`；generator 包单测 45 文件 404 例全过。
- kuoimm：根因——`resolvePrettierBin` 只查 `<cwd>/node_modules/.bin/prettier`（tree 的 cwd = gitRoot）。修法：自 output 目录逐级向上至 cwd 取最近的 prettier，不越出 cwd；配置本就按 `--stdin-filepath` 随产物路径就近解析，无需另改。未加配方 / 命令行指定路径（就近解析已覆盖 issue 场景，不扩面）。验证：`format.test.ts` 新增 5 例（成员命中 / 最近优先 / 回落仓根 / 不越界 / formatVfs 缺省解析接线），13 例全过，eslint 退 0。
- yhk3m5：ⓐ `generator --help` 用法总览补 `tree build|check` 一行（`main.ts`；命令表里 `tree commands` 的描述由 cli-utils 统一生成，属 utils 领域，本批不动）。ⓑ 源码 SKILL.md 已有三档入口与 `done-coding generator tree` 兜底，issue 看到的是旧版插件缓存；补 lodash.template 版本提示（实测 cli-generator 0.1.0～0.4.0 均为 `^4.5.0`）。ⓒ 补发现层说明：探测从 rootDir 向上合并各层 + 全局、同名取近；全局层内容取决于本机安装（本机当前已有 forge 软链），不作固定假设。另实测发现：`tree build` 碎片根只取就近**第一个** `.done-coding/templates/` 根（`resolveDoneCodingDir`），与探测的多层合并不一致——项目层有 templates 时全局层模板列得出却读不到碎片；本批只在 skill 写明，未改机制（超出 issue 范围，交付回报中提出）。
- 收口门禁（2026-11-09）：generator `eslint .` 退 0、`vitest run` 409 例全过、`vite build` 退 0；cli-skills `vitest` 15 例全过、`eslint .` 退 0、build 退 0 且无脏文件。快照：`modules/generator/SNAPSHOT.md`、上层 `SNAPSHOT.md` generator 行、`docs/TECH_SNAPSHOT.md` 两行（该文件原本未按 prettier 格式化，只改目标行不整体重排）。
