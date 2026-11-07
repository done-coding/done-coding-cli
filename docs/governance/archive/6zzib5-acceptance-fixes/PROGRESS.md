---
id: 6zzib5
title: 组织站黑盒验收问题修复（create / component / template）
modules: [create, component, generator, template, utils]
created: 2026-11-06
source: 用户 2026-11-06 触发 issue 分诊，经总协调派发
after: ""
---

# 组织站黑盒验收问题修复

## 任务

| 项 | 状态 | 交付 sha |
|---|---|---|
| 分诊：四条进本批、63f7dw 移入 dropped | 已提交 | dfe70c4 |
| 共用：utils `CliUserError` 不打调用栈 + `epilog` | 已实现并验证 | a250316 |
| wgrj68 component list 缺配置打印调用栈 | 已实现并验证 | 031e009 |
| yh51tb create README 的 -c 不存在 | 已实现并验证 | 36476d3 |
| bjms6c create 位置参数项目名被拒 | 已实现并验证 | 36476d3 |
| rkacpj template init 后直接运行报 env 为空 | 已实现并验证 | 0b13ac7 |
| 刷新所涉模块快照和上层摘要 | 已更新（新建 component / template / utils 模块快照） | 随归档提交 |
| 归档本批并跑治理闸 | `pnpm gov:check` 通过 | 随归档提交 |
| 交付后立即开始下一批 `3r4dvv` | 已开始 | |

## 授权与边界

- 用户 2026-11-06 授权：本仓读写；显式 pathspec 提交；禁止 push、发版、npm deprecate、改其他仓、读 .env、git worktree、手改锁文件。
- 63f7dw 同轮分诊：已由 9584e89、1558540 实现并经组织站真实发布验证 → `dropped/`。
- 未触及共享骨架（`packages/cli`、根 package.json、锁文件、workflows），无独占声明。

## 判断与依据

ⓐ **yh51tb（-c）→ 改 README**。`justCloneFromDoneCoding` 在 ed440c4（2025-06）引入时别名为 `c`；5dd7c85 起改为 `clone` 且 `hidden: true`；非交互模式直接拒绝该选项。这是有意隐藏的旧克隆模式，README 不应再宣传，删去全部 `-c` / `--justCloneFromDoneCoding` 用法。
ⓑ **bjms6c（位置参数）→ 补实现**。0966cb3（2026-02）注释掉 positional 并新增 `-n`，提交说明只写「不再使用」，无技术原因；而根 README、cli README、create README 及 `npm create done-coding <名>` 惯例都用位置参数。实现为 `$0 [project]`，与 `-n` 等价；不复用 `projectName` 键，因为 yargs 会让位置参数静默覆盖 `-n`，无法发现冲突。两者不一致时报错，合并后移除 `project` 键，避免混入模板预设答案。
ⓒ **wgrj68**：根因是 failHandler 对所有 Error 都打印调用栈。utils 新增 `CliUserError`（按字段识别，兼容各包各带一份 utils 副本），失败时只打印 message；generator 批次未找到改抛它，并给出 `done-coding generator init <type>` 初始化命令；component `--help` 末尾说明初始化方式（utils 新增 `epilog` 支持）。utils 非交互缺输入（`xPrompts` / `getAnswer`）同属预期错误，一并改为不打调用栈。
ⓓ **rkacpj**：init 生成的是批量配置（供 `template batch`），而裸 `template` 走单文件编译，需要 -e/-E 与 -i/-I。改为：未给单文件参数且配置文件存在 → 按配置批量编译（init 产物可直接运行）；配置文件也不存在 → 写明两种用法；单文件参数不全 → 列出缺的参数。另外修了一个阻塞：交互模式下声明了 initial 的项被「不能为空」卡死（默认配置 repositoryUrl 初值为空串，回车会一直重问），现与非交互一致视为可选。batch 缺配置文件、非交互缺采集变量的报错写明文件与 initial。init 成功后提示下一步命令。

## 实测记录

ⓐ 环境：Node v22.23.3（nvm），pnpm 10.33.0（与 CI 一致，`pnpm install --frozen-lockfile`，锁文件无变动）。构建按依赖拓扑 `--workspace-concurrency=1`。
ⓑ 修前复现（本地构建产物，临时目录 + 隔离 HOME）：`create-done-coding acc-readme` → 「无法识别的选项：acc-readme」；`acc-readme -c` → 「无法识别这些选项：c, acc-readme」；`dc-component list` → 报错 + yargs 调用栈，退出 1；`dc-template`（无 init）→ 「开始单个处理 / env与envData不能同时为空」，退出 1。
ⓒ 测试先红后绿：utils `user-error.test.ts`（5）；generator `core-batch-discovery` 新增 1；component `missing-config.test.ts`（3，含按提示 init 后 list 退出 0）；create e2e 新增 3（位置参数创建、与 -n 冲突、help）；template `compile-entry.test.ts`（5）。新用例在修前均失败（help 用例为回归防护，修前已通过）。
ⓓ 修后复现（`packages/cli/es/done-coding.mjs` 主命令）：`component list` 退出 1，只有两行提示（缺什么 + `done-coding generator init component`），无调用栈；`component --help` 末尾有初始化说明；`template` 无配置时写明两种用法；`create acc-readme` 被接受并进入模板选择（与 `-n acc-readme` 行为一致）；`create acc-readme -c` → 「无法识别的选项：c」，`--help` 无 `-c`。
ⓔ 交互核验（python pty 驱动）：默认配置 + `dc-template`，答 name/chineseName、其余回车 → 退出 0，package.json 与 README 占位被替换。
ⓕ 意外：一次误用 `npx vitest`（解析到 npx 缓存中的外部 vitest，而非仓内 1.6.1）期间，仓根 `node_modules/.pnpm` 被删除，原因未定位；源码与锁文件未受影响。已用 `pnpm install --frozen-lockfile --offline` 恢复，之后统一用 `pnpm --filter <包> test`，未再复现。

## 门禁

- `pnpm --filter <包> test`：utils 15/15、template 40/40、generator 394/394、component 5/5、create 37/37、mcp 28/28。
- eslint（改动的 .ts 文件）退出 0；prettier --check 通过；tsc --noEmit：utils / template / generator / component / create 均退出 0。
