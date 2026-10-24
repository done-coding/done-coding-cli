---
id: 6mdb0n
title: 统一调用入口（done-coding <X> ↔ dc-<X>）+ workspace 依赖钉死版本成文
modules: [create, cli-skills, generator, harness]
created: 2026-10-24
source: 用户 2026-10-24 当轮确认
after: ""
---

# PROGRESS — 6mdb0n

授权边界：实现 + 本地验证 + 本地提交；push / 发版各需单独授权。实施与验证由 Codex（gpt-6.1-sol）执行，Claude 复核。
共享骨架独占：`packages/cli/README.md`、`pnpm-lock.yaml`（若 devDep 改动需重生成）。

## 进度

- 2026-10-24 开工核验：分支 `feat/unify-cli-entry`、HEAD `23a3c65`，工作树干净；已读仓根、治理与 cli-skills 指令和两份冻结正文。仅实现 / 本地提交，不 push、不发版、不收口归档，不改家目录配置。
- 成功标准：gs28xn 的两个 bin 实际执行及帮助一致、四份 skill 按 `command -v` 三档选入口；9wge1y 本仓依赖无范围版本、pnpm 10.33.0 重生成 lockfile 且仅 cli-inject 相关 diff；所涉包 eslint / test / build 与 gov:check 退 0；两条目各一提交，最终工作树干净。
- 实施顺序：先 gs28xn（别名、skill、文档与快照），验证后提交；再 9wge1y（依赖、构建注入、lockfile 与规则），验证后提交。共用 AGENTS.md 与本文件分笔提交；共享骨架继续独占 `packages/cli/README.md`、`pnpm-lock.yaml`，其他会话排队。
- 复用阶梯停在「项目既有 / 已装依赖」：沿用 bin 映射、现有 skill 段落及 harness 的 generateFile 构建注入，不引新依赖。已确认缓存 pnpm 为 10.33.0；默认 corepack 曾尝试写家目录缓存，遭沙盒拒绝，改为只读执行已有缓存。
- gs28xn 基线：`node` 断言 `bin["dc-create"] === bin["create-done-coding"]` 失败（actual undefined），确认别名缺失。
- 判断：按冻结需求直接实施，无需重新设计；以本文件作唯一进度记录。构建 / 测试复用仓内工具，生成测试夹具仅落临时目录。create 的旧发布版 assignWith 提示若无法验证当前 npm 版则保留并明确未核实，不据本地源码推断发布版。

- gs28xn 首轮验证：四份 skill 的入口段落一致，临时 PATH 脚本 16 场景全过；create / cli-skills / cli 的 eslint 与 build 均退 0，create 34 / cli-skills 15 测试通过，gov:check 全过。CLI 包没有 test script，未伪造通过。
- gs28xn 实际 bin 验证发现：两个同文件 bin 使 getRootScriptName 无法唯一推导，yargs 回退为各自调用名，帮助标题与折行不同。按逐字节一致的验收口径，保留原帮助名称 injectInfo.name；只在 create 包配置，不改共享 utils。临时 bin-links 真实建 bin 的断言已先见失败，修后复验。
- gs28xn 最终验证：create 包 `pnpm exec eslint .` / `pnpm build` / `DC_SKIP_BUILD=1 pnpm test` 退 0（5 文件、34 测试）；cli-skills 包 `pnpm exec eslint .` / `pnpm build` / `pnpm test --run` 退 0（3 文件、15 测试）；cli 包 `pnpm exec eslint .` / `pnpm build` 退 0（该包无 test script）。构建仅有工具链版本提示与 skills URL 在运行时解析的警告，无构建失败。
- gs28xn 入口验收：`node /private/tmp/dc-entry-check.cjs` 退 0（四份公共入口文字一致，各 4 个 PATH 场景）；`node /private/tmp/dc-create-bin-check.cjs` 退 0（临时 node_modules 用 npm 自带 bin-links 实际注册两个可执行 bin，均 --help 退 0、输出 1929 bytes 逐字节一致，夹具清理）。根 `pnpm gov:check` 退 0（元闸 / 并行闸 / 收口形态 / 清单全过），`git diff --check` 退 0。
- [x] gs28xn 命令名约定：`dc-create` 别名 + 4 个 skill 三档调用入口 + 文档 / AGENTS.md 成文
- 9wge1y 基线：扫描所有 workspace 包的 dependencies / devDependencies / optionalDependencies / peerDependencies，仅 cli-skills 的 cli-inject `^0.5.17` 违规（实际旧安装解析为 0.5.23）；外部 request-axios / output-node 不纳入规则。开始处理依赖与干净环境构建，lockfile 继续独占。
- 9wge1y 干净环境基线：临时副本使用本仓 inject 库、移除旧 injectInfo 与 dc-inject shim，执行 build 在 prebuild 报 `sh: dc-inject: command not found`，退 1。按 harness 的既有 generateFile 做法改到 Vite 配置，build/dev 不再依赖 bin；显式设置 moduleName `cli-skills`，避免包名正则默认变成 `skills`。
- 9wge1y lockfile：缓存 pnpm 10.33.0 执行 `install --lockfile-only --ignore-scripts --offline` 退 0，随后按仓根 postinstall 既有惯例 prettier 格式化；最终仅 +2/-44 行，替换 cli-skills inject 引用并删除旧 inject 0.5.23 / 其 utils 0.8.4。YAML 深比较确认无其他语义变化；同版本 `install --lockfile-only --ignore-scripts --offline --frozen-lockfile` 退 0。
- 9wge1y 本机依赖重链：默认 pnpm store 不匹配导致无 TTY 下拒绝重装；指定既有 store 后因试图写家目录 store/projects 链接被沙盒拒绝。未申请放开家目录，直接仅在仓内 ignored node_modules 将 cli-skills 的 inject 软链切到 workspace（非 lockfile 手改），后续包门禁使用此真实本仓依赖；临时 clean 副本同样使用本仓 inject。未改家目录配置。
- 9wge1y 干净副本构建已退 0：无 dc-inject shim、无注入旧文件，生成正确 injectInfo（0.4.0 / .done-coding / cli-skills）和两份插件清单；临时目录随即清理。
- 9wge1y 最终门禁：cli-skills 包 `pnpm exec eslint .` / `pnpm test --run` / `pnpm build` 均退 0（3 文件、15 测试；构建成功）；实链已确认指向本仓 packages/inject。`node /private/tmp/dc-workspace-deps-check.cjs` 退 0（16 包 / 51 处内部依赖 / 0 违规；lockfile 深比较仅预期差异），`pnpm gov:check` 退 0。
- 补充 gs28xn：调用本机 npm 自带 get-bin-from-manifest，确认同文件双 bin 仍选择 `create-done-coding`，保留 npm create 路径。未拉取或运行当前 npm 发布版，assignWith 历史提示按需求明确未核实。
- 格式核验：所改 md / ts 与 lockfile 的 `pnpm exec prettier --check <显式路径>` 退 0；根 BUSINESS / TECH 快照仅定点修改，未跑 prettier。frozen lock 检查会重序列化 YAML，已在最后一次检查后再按仓内 prettier 格式化，最终锁文件 +2/-44 行；未手改 lockfile。
- 最终只读复核：独立代理按两份冻结正文审查并复跑入口、依赖、lockfile、临时构建，未发现 Critical / Important / Minor。置于范围外：当前 npm 发布版 assignWith（按需求保留未核实提示），以及用户排除的 push / 发版 / 家目录配置 / 收口归档。
- 最终自查补充：Vite 顶层 generateFile 会在 Vitest 载入配置时写 src，临时副本测试已复现（15 测试虽通过，但「不生成 injectInfo」断言失败）。将注入移到 `command === "build"` 分支：实际 dev 脚本为 vite build -w，同样覆盖；测试不写 src。此修正遵守根测试沙盒约束，不迁移共享包或 harness 既存实现。
- 最终修正复验：`node /private/tmp/dc-skills-test-isolation.cjs` 退 0（15 测试，未生成 src/injectInfo）；`node /private/tmp/dc-skills-clean-build.cjs` 退 0（无 bin 的干净副本仍正确注入并构建）。真实 cli-skills 包 eslint / test --run（15 例）/ build 再跑均退 0；依赖扫描、lockfile 深比较、gov:check 与 diff --check 再验通过。最终作者修正由上述失败→通过验证，不再派重复复核；Claude 仍按原授权做正式复核。
- [x] 9wge1y workspace 依赖钉死版本：AGENTS.md 成文 + 修 cli-skills 的 cli-inject 开发依赖

## 交付

> 434b496 之后的提交经用户确认压为一次提交；下表为压缩前 sha，原历史在本地备份分支 `backup/unify-cli-entry-pre-squash`。

| 条目 | sha | 结果 |
|---|---|---|
| gs28xn | 9d5514a | `dc-create` 别名；4 个 skill 三档入口；命令名约定写入 AGENTS.md / README / 快照 |
| 9wge1y | 1ec0a1b | workspace 依赖钉死规则写入 AGENTS.md；cli-skills 的 cli-inject 改 `workspace:0.6.6`，lockfile 由 pnpm 10.33.0 更新（仅该依赖相关） |

Claude 复核（2026-10-24）：入口命令实测存在（`done-coding generator tree` 等）；cli-skills eslint / 15 测试 / build、create eslint / build / 34 测试复跑退 0；SKILL.md 内示例 JSON 被 prettier 重排（语义不变）。
