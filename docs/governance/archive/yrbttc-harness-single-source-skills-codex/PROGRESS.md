---
id: yrbttc
title: harness 唯一实现对齐 skill 格式 + cli-skills 支持 Codex 薄层安装 + skill 宿主中立
modules: [harness, cli-skills, generator, create]
created: 2026-10-22
source: 当轮新建 2zfhl6 / 5g2bhs / jbvyre（用户 2026-10-22 定：治理工具全部留在 cli）
after: ""
---

# PROGRESS — yrbttc

## 进度

- [x] 2zfhl6 — `f39b3c2`：BACKLOG 去「备注」列；批次领域 = 条目 ∪ PROGRESS frontmatter（`readBatchModules`，清单与并行闸共用）；本仓与 `~/.dotfiles/docs/governance` 副本对新版 py 逐字节一致；harness 27 例绿。注册表 `global-claude` 失效条目在 `~/.dotfiles` 重登为 `dotfiles`（dotfiles `993cbf8`），scope check 通过
- [x] 5g2bhs — `9c7abd2`：install `-t claude|codex|agents`（可多选）+ `-l` 软链（npx 缓存来源拒绝）；覆盖改「先移除再装」（软链只摘链、实体目录 safeRemoveDirSync），修复 force 复制顺软链写进包内源的隐患；重写包两快照；cli-skills 11 例绿、临时 HOME 实跑通过。用户纠偏：安装器只认宿主目录、不感知 dotfiles
- [x] jbvyre — `49d8678`：4 个 skill 审毕，仅 cli-harness 写死「治理目录 CLAUDE.md」→ 改指令文件（AGENTS.md / CLAUDE.md）并声明 dc-harness 为唯一实现；其余已宿主中立
- [x] 收口：harness 模块快照刷新（generator / create 快照无变化）；`pnpm test` 10 包 679 例绿、`test:hub` 0、gov:check 0、py --check 一致
- [x] 向 dotfiles 收件箱提 issue `xxkv2u`（dotfiles `f75eaa7`）：删 skill 内 py 改调 dc-harness、MODULES 领域名格式、bootstrap 用 dc-cli-skills 安装（待 cli 发布）

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| 2zfhl6 清单对齐 + 注册表重登 | f39b3c2 · dotfiles 993cbf8 | dc-harness 成清单唯一实现，与新版 py 逐字节一致 |
| 5g2bhs 多宿主安装 + 软链 | 9c7abd2 | claude / codex / agents，复制或软链 |
| jbvyre skill 宿主中立 | 49d8678 | cli-harness 一处修正，其余无需改 |
