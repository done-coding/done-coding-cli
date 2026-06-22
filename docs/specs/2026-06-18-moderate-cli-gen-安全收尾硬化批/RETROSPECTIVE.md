---
title: cli-gen 安全收尾硬化批 — 复盘（RETROSPECTIVE）
date: 2026-06-18
level: Moderate
subproject: done-coding-cli
作者: director-product（代甲方）
related: ./requirements.md ./design.md ./tasks.md
status: 已签收（codex 终审有条件通过，条件已闭合）
---

# 复盘 — cli-gen 安全收尾硬化批

## 交付概要
对已有消费方在用的 cli-generator（bin dc-gen）做纯防御安全收尾，闭合 P4a 复盘的三处已知残留 + 固化运行时安全规则。worktree 隔离（`feat/cli-gen-safety-hardening`，基于含 P4a 的 HEAD）。

落地 4 处守卫 + 规则：
- **修订-1（H1）**：公共纯函数 `assertCwdNotSuspiciousRoot`（`core/safe-root.ts`），拒家目录本体 / 文件系统根；接 assemble `runBuild` **与** gen `removeEmptyInstanceDir` 双 destructive 入口，`--allow-dangerous` 全链逃逸。
- **修订-2（M2）**：`assertNoCaseCollision`（vfs.ts，flush 内）按 folded **路径前缀**全覆盖（含 A/x vs a/y 父目录塌陷）+ file-vs-dir 类型塌陷，FS 无关确定性。
- **修订-3（H2+M1）**：`removeEmptyInstanceDir` rmdir 前 realpath 双解防 symlink 逃逸 + 可疑根 + 越界守卫；第三参**可选**保后向兼容（removeEmptyDir=true 缺 execDir 才 fail-loud）。
- **R4**：项目 CLAUDE.md 新增「运行时路径安全」+「I/O 异步约定（前瞻）」两节。

## 质量门
- 测试：generator **31 文件 / 298 测试全绿**（基线 272 + 新增 26），本部独立复跑 exit 0 确认（非仅 subagent 自报）。
- 覆盖率：All-files 语句 98.81% / 分支 92.73% / 函数 100%，均 ≥ P4a 基线门槛。
- lint/prettier：改动文件全过（`src/types/index.ts` 命中 root eslintrc `ignorePatterns:["types"]` 既有忽略，非本批引入）。
- 范围：diff 精确命中 14 文件（11 源码/类型 + 2 测试改 + 3 测试新 + CLAUDE.md），无 node_modules/lock 泄漏。

## 流程有效性
- **codex 设计审第一轮总评"打回"，5 条（2H/2M/1L）全采纳**——价值显著：
  - H1 逮到 D1 只守 assemble、**漏 gen remove destructive 入口**（设计盲区，本部初稿亦未覆盖 gen）。
  - H2 逮到 D3 字面 isInside **漏 symlink realpath 逃逸**。
  - M1 逮到必填三参**破已导出 API**（消费方兼容红线）。
  - M2 逮到 case-fold 整键比对**漏父目录隐式塌陷**。
- 修订纯落实 codex 自列最小修复、无新增设计自由度，故未二次审设计、由终审兜底——轮次不膨胀。
- 角色：统筹做 RDT + codex 仲裁 + verify + 收口，项目级实现派 subagent，未下沉 PM。
- 沙盒：测试 fixtures 落 os.tmpdir + afterEach；homedir 经 opts.homeDir 注入，未触真实家目录。

## codex 终审（第二轮，总评"有条件通过"）
codex 确认 **H1/H2/M1/M2 实现逻辑闭环**（realpath 双解 fail-loud、缺 execDir 仅 removeEmptyDir=true 迁移报错、case-fold 按 folded 前缀覆盖 A/x vs a/y + file-vs-dir 类型塌陷），CLAUDE.md 规则可执行无冲突；codex 自跑 `test` + `build` 通过。2 条：
- **M（透传契约偏离，已修）**：handler 只看 `argv.allowDangerous`，未合并 `resolveHandlerContext` 的 `ctx.allowDangerous` → programmatic/server 调用传 `ctxInit.allowDangerous` 无效。**本部已修** assemble.ts/remove.ts 两处合并 `argv || ctx`，补 handler 层测试 `[终审M]`（spyOn os.homedir 注入可疑根验 ctxInit 逃逸生效）。全量升至 **299 测试全绿**，prettier/eslint 净。
- **L（untracked，commit 注意）**：safe-root.ts + 2 新测试若提交只取 tracked diff 会漏文件致构建失败 → commit 用显式 pathspec 已纳入三新文件。

→ 条件全部闭合，签收。两轮 codex（设计审 5 条 + 终审 2 条）共 7 条实质问题全采纳全闭环。

## 教训
- **设计期"destructive 入口"要枚举全**：本部初稿只盯 assemble，漏了同包 gen 的 rmdir 也是 destructive 且同样吃 safeCwd 兜底——codex 跨入口视角补上。教训：安全守卫的"入口集合"应先全枚举（grep 所有 rm/rename/rmdir/写盘点）再逐一接守卫。
- **加固已发布 API 优先后向兼容**：必填参数变更是消费方破坏；可选参 + 缺失即 fail-loud 的迁移错误，既守安全又不破契约。
- symlink 逃逸是路径边界守卫的通用盲区：字面 isInside 不够，destructive 前 [MUST] realpath。

## 后续 / 未决（收口上报用户）
1. **docs/ gitignore（R5）改报告分支**：cli 仓 docs/ 有 **17 个已跟踪文件**（快照 + 历史 spec）。命中 R5② 红线，未自动处理。待用户决策：ⓐ 保留现状（不动）；ⓑ `git rm --cached docs/` 后加 .gitignore（untrack 但保留本地）；ⓒ 其他。
2. **本批合入 / push**：worktree 分支 `feat/cli-gen-safety-hardening` 未合主、未 push。待用户定合入方式（合回 feat/create-mcp-cli-skills / 单独 PR）；push 永不豁免。
3. **async 全链迁移**：仍挂产品化轨（本批未做）。
