---
id: 2fe6vf
title: 单测隔离宿主 HOME + module-generate skill 示例对齐真实模板
modules: [generator, mcp]
created: 2026-10-19
source: issue efian4（分诊：ⓐ 发布 = 重复 7htubs，ⓑ skill 示例当轮做）+ 当轮新建 rbckut
after: ""
---

# PROGRESS — 2fe6vf

## 分诊记录

- `efian4` ⓐ `tree` / R4 未发布 → 与池条目 `7htubs`（发版）重复，随其交付，本批次不做。
- `efian4` ⓑ `module-generate` SKILL.md 示例与真实模板不符 → 本批次修。

## 进度

- [x] rbckut — `2d02cc0`：generator / mcp vitest 改 `forks` 池 + globalSetup 隔离 HOME；真实 HOME 含全局模板下 393 / 28 全绿，临时 HOME 已清
- [x] efian4 ⓑ — `eda0777`：SKILL.md 示例改用 List.vue.vm / List.config.tsx.vm + 真实 schema 字段；从文档原样抽出的完整示例对真实模板 tree build 退 0、tree check 无漂移；cli-skills 7 例绿
- [x] 收口：generator / mcp 模块快照刷新；`pnpm test` 10 包全绿、`test:hub` 0、generator / mcp eslint 0

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| rbckut 单测隔离宿主 HOME | 2d02cc0 | 根因 = threads 池下改 env 不影响 `os.homedir()` + tree 全局层兜底；两包改 forks + globalSetup |
| efian4 ⓑ module-generate 示例 | eda0777 | 示例碎片名 / vars 对齐真实 list-page，实跑 build / check 通过（生成码类型检查仍以 hub `check:module-templates` 为准） |
| efian4 ⓐ 发布 tree / R4 | — | 重复 `7htubs`，随发版交付 |
