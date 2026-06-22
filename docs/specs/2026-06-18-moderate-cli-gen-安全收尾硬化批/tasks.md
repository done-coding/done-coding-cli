---
title: cli-gen 安全收尾硬化批 — tasks
date: 2026-06-18
level: Moderate
related: ./design.md
status: drafting
---

# 任务 — cli-gen 安全收尾硬化批

执行顺序：codex 审 design → T1–T5 实现（TDD：RED→GREEN）→ 回归 → codex 终审 → 收口。

## T0 — codex 交叉审 design（前置闸）✅ 完成
- [x] codex 审 design，5 条（2H/2M/1L）全采纳，回写 design「§修订（codex 设计审第一轮）」。实现以 §修订 为准。

> 关键修订：可疑根守卫覆盖 **gen remove 入口**（非仅 assemble）；D2 按 folded **路径前缀**全检测（含 file-vs-dir）；D3 用 **realpath** 防 symlink 逃逸 + 第三参**可选**保后向兼容。

## T1 — destructive 入口可疑根守卫（R1 / D1）
- [ ] engine.ts 新增 `assertCwdNotSuspiciousRoot(cwd, { allowDangerous, homeDir? })`（纯函数，homeDir 可注入便于测）。
- [ ] runPlan/runBuild/runDiff 在 assertOutputInside 同处调用。
- [ ] EngineCtx 增 `allowDangerous?`；assemble handler 透传 `hctx.allowDangerous`；CLI 暴露/复用 `--allow-dangerous`。
- [ ] RED→GREEN 单测：homedir→throw / 正常→过 / allowDangerous→跳过（os.homedir 注入或 spyOn）。

## T2 — case-fold 塌路径守卫（R2 / D2）
- [ ] vfs.ts 新增 `assertNoCaseCollision(vfs)`（纯键比对，FS 无关）。
- [ ] flush 内 assertOutputOwnership 后、materialize 前调用。
- [ ] RED→GREEN 单测：Foo.json+foo.json→throw / 仅一个→过 / 同键不误报。

## T3 — removeEmptyInstanceDir 越界守卫（R3 / D3）
- [ ] instance-dir.ts `removeEmptyInstanceDir` 增 `execDir` 形参 + isInside 守卫（越界/等于 execDir→throw）。
- [ ] 同步所有调用方传 execDir（TS 编译期保证不漏）。
- [ ] RED→GREEN 单测：越界(../、绝对)→throw / 正常空→rmdir / 非空→不删。

## T4 — CLAUDE.md 规则（R4 / D4）
- [ ] done-coding-cli/CLAUDE.md 新增「运行时路径安全」+「I/O 异步约定」两节。
- [ ] 措辞可证伪、不与既有冲突；coding-dna 镜像默认不做（codex 建议再补）。

## T5 — docs/ gitignore（R5 / D6）→ 改**报告分支**
- [x] `git ls-files docs/` 核查：**已有 17 个跟踪文件**（BUSINESS/TECH/HARNESS 快照 + 多历史 spec）。
- [⚠] 命中 R5② 红线 → **不自动 gitignore/git rm**，收口时上报用户决策（这些已提交快照可能是有意发布的；盲加 docs/ 会造成"已跟踪却被 ignore"不一致）。
- [ ] 本批新 spec 不提交（本地 live），commit 用显式 pathspec 仅含源码+CLAUDE.md。

## T6 — 回归 + 质量门
- [ ] `pnpm -C packages/generator test`（272+ 全绿，含新增）。
- [ ] `pnpm -C packages/generator test:coverage`（assemble 不低于 P4a 基线）。
- [ ] component golden 回归（add/remove/list 逐字节 diff 空）。
- [ ] lint + prettier。

## T7 — codex 终审 + 收口
- [ ] codex 审最终 diff（5 处守卫 + 测试 + 规则），本部仲裁，H 级全采纳或显式记残留。
- [ ] RETROSPECTIVE.md 落盘；commit（显式 pathspec）。
- [ ] 统一收口对接用户（已落盘清单 + 仍待决 + 是否 merge 回主分支 / push）。

## 边界
- [MUST] 测试/回归走沙盒（os.tmpdir + afterEach + fake home），[MUST NOT] 写真实 src/家目录。
- [MUST NOT] 改 P4a 已签收逻辑 / 5 op 行为 / 共享 safeCwd 语义。
- [MUST NOT] push（push 永不豁免，需单独明文）。
