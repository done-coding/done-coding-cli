---
id: pqvn2w
title: dc-harness 指令闸——AGENTS.md 预算 + CLAUDE.md 兼容入口检查
modules: [harness, cli-skills]
created: 2026-10-25
source: 用户 2026-10-25 当轮确认（走批次单，交 Codex 执行，Claude 复核）
after: ""
---

# PROGRESS — pqvn2w

授权边界：实现 + 本地验证 + 本地提交；push / 发版各需单独授权。实施：Codex（gpt-6.1-sol medium，常规编码）；复核：Claude。

## 进度

- [x] dezl6l 指令闸实现及必要验证（待 Claude 复核，不归档）

成功标准：需求所列测试覆盖、两包 eslint / test / build、gov:check 通过；三仓只读实跑并记录退出码；显式路径本地提交后工作树干净。

已核对：分支 feat/harness-instruction-gate，起点 3a2c9d5，工作树干净；已读项目 / 治理 / cli-skills 规则及 harness 分层实现。

实现取舍：复用 Git ls-files 与原生 glob pathspec，不引依赖；只读工作树中的跟踪文件，独立命令无需治理目录，严格在 git 根执行；check 默认不开指令闸。不修改共享骨架、不写外仓、不归档。

## 交付

> 提交经用户确认压为一次；表中 sha 为压缩前（2fcfdbc 变基后为 ca68fda），原历史在本地备份分支 `backup/harness-instruction-gate-pre-squash`。

| 条目 | sha | 结果 |
|---|---|---|
| dezl6l | 2fcfdbc | `dc-harness instructions` 指令闸（预算 + 兼容入口），gate 开关并入 check |


已实现：core/instructions、handlers/instructions、命令路由与类型、配置读取及 check gate；README / 内置 cli-harness skill / harness 与 cli-skills 快照、根业务技术快照已同步。无新依赖，未修改共享骨架。

首轮验证：harness eslint / test（39 例）/ build 全 0；cli-skills eslint / test（15 例）/ build 全 0；gov:check 0。构建有现存 API Extractor TypeScript 版本提示及 cli-skills URL 构建提示，不影响退出码。

三仓首轮只读实跑：本仓 0、template-hub 0，均单行 ✅；admin 1，AGENTS.md 实际 24139 B / root 16384 B / 超出 7755 B（证明预算生效）。admin 原已有 apps/reference/src/components.d.ts 与 done-coding-admin-monorepo.code-workspace 改动，不处理。

实现边界：跟踪文件取工作树当前字节（不取暂存内容）；未跟踪 CLAUDE 不算有效交付；无同级 AGENTS 的 CLAUDE 单行纯导入允许保留；exclude 用 Git glob（不新引匹配库）。AGENTS 软链及失踪跟踪文件显式报错，避免绕过预算；纯只读扫描无需写盘权限。


终验记录：三仓用同一份构建后的 cli.mjs 运行 instructions，退出码依次 0 / 1 / 0；逐仓扫描前后 git status --porcelain=v1 完全一致，确认外仓无写入。本仓 --json 可解析（根指令 7333 B，治理层 2924 B，cc-switch 796 B，cli-skills 1297 B，errors=[]），--help 显示 --json 选项。

验证命令（各包目录）：`pnpm exec eslint .`、`pnpm test --run`、`pnpm build`，两包均 0；harness 39 / cli-skills 15 例通过。仓根 `pnpm gov:check` 0，`git diff --check` 0。

额外命令记录：一次误在仓根执行 `pnpm test --run`，根脚本自带 --run，Lerna 传出重复 --run，Vitest 参数解析失败（退出 1、尚未执行用例）；不作为本批验收。已改回包内命令完成验收，未修改无关根脚本。仓根额外 eslint 退出 0，有其他包既有 17 条 warning，不扩展修复。

未完成 / 授权边界：Claude 复核与批次归档由用户指定后续执行；本轮不 push / 不发布。实现与包内验证完成，提交受沙箱权限阻塞，不能声称最终交付完成。


提交阻塞（已按要求重试）：两次在默认沙箱执行显式路径 `git add -- <本批 15 个文件>`，均退出 128：`fatal: Unable to create .../.git/index.lock: Operation not permitted`。未请求沙箱豁免、未绕过沙箱、未执行 commit，HEAD 仍 3a2c9d5。继续所需最小条件：当前沙箱获准写本仓 .git；届时用显式 pathspec `git commit -F <msg> -- <本批路径>`，提交正文中文 conventional commit `feat(harness): 新增指令预算与兼容入口闸`，末行 `Co-Authored-By: Codex <noreply@openai.com>`。取得 sha 后补交付表，仍不做归档。

Claude 复核（2026-10-25）：读核心实现（链路累加的前缀判定、软链拒绝、CLAUDE.md 判定）无问题；独立重跑 harness 39 / cli-skills 15 例、eslint、build、gov:check 均退 0；mani 七仓实跑：cli / plugins / template-hub 全过；admin 根超预算（预期）；dotfiles 报 home/ 下全局指令（属全局层，应在该仓配 exclude）；aigc-next 迁移进行中子层超限、`.claude/skills/` 第三方 skill 应排除；.sessions 发现 `.VMOS/CLAUDE.md` 正文未迁（新发现，待处理）。Codex 沙箱写 .git 被拒，由 Claude 以显式 pathspec 代为提交。
