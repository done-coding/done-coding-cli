---
id: mhzjan
title: scope 注册表 + issue 按名寻址 + 建项目 skill 合并 + 退役 cli-ai / cli-mrm
modules: [harness, create, ai, mrm]
created: 2026-10-02
source: issue 6w35pj / ff5p5s 分诊当轮做 + 池条目 qdoeql
after: ""
---

# PROGRESS — mhzjan

## 独占声明

- `packages/cli`（摘 ai / mrm 子命令与默认行为）、根 `pnpm-lock.yaml`（删两包 importer，CI 同版本 pnpm 重生成）—— 本批次独占至交付。

## 顺序

ⓐ `qdoeql` dc-harness scope（list / check / register）+ issue 按名寻址 → ⓑ `ff5p5s` cli-harness skill 读注册表 + create-done-coding 并入 x-create 推断规则 → ⓒ `6w35pj` 退役 ai / mrm → 收口 → 发布与 deprecate（待当轮授权；未获授权则拆出回池）→ 收工。

## 进度

- [x] qdoeql — `e20b9fb`：scope list / check / register + issue 按仓名寻址；harness 23 例绿；真注册表 7 仓 check 过；沙盒 register→按名 issue 实跑
- [x] ff5p5s（skill 两项）— `481297a`：cli-harness 按注册表寻址 + scope 章节；create-done-coding 并入 x-create 少问多答；cli-skills 7 例绿。全局 `~/.claude/skills` 安装副本未动（发布后 `dc-cli-skills install -g -f`）
- [x] 6w35pj — `2221ef7`：主包摘 ai / mrm（无子命令改输出帮助）+ 删两包（`git rm` 由用户执行）+ lockfile 以 pnpm 10.33.0 重生（仅删 188 行）+ README / workspace；`564ec17` 两快照 + 3 个 ai/mrm spec 迁归档（.harness `50b256c`）；MODULES 标已下线、`9n3vst` 收窄为 4 个 spec
- [x] 收口：build 16 包、`pnpm test` 10 包 671 例、harness / cli-skills / cli eslint 0、`test:hub` 0；harness / create 模块快照 + 上层 SNAPSHOT
- [→] 发布 cli-harness 等 + npm deprecate cli-ai / cli-mrm — 未获当轮授权，拆出回池 `7htubs`

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| qdoeql scope 注册表 + issue 按名寻址 | e20b9fb | scope list / check / register；harness 23 例；真注册表 7 仓 check 过 |
| ff5p5s skill 两项（发布部分拆出） | 481297a | cli-harness 按注册表寻址；create-done-coding 并入 x-create；发布 → `7htubs` |
| 6w35pj 退役 cli-ai / cli-mrm（deprecate 拆出） | 2221ef7 · 564ec17 | 两包删除 + 主包 BREAKING；npm deprecate → `7htubs` |
