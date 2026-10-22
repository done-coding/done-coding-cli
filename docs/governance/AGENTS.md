# 治理目录维护规则 — done-coding-cli

> 文档定位：快照型 · **创建、修改或流转本目录治理文件时** [MUST] 遵守；只读取开发流程时不因本文件启动治理维护任务。
> 全项目开发流程见同目录 `DEVELOPMENT.md`（由项目根 `AGENTS.md` 要求读取）；完整方法论与判据理由见 harness-workspace skill。

## 单态流转

- 条目正文任一时刻只在一个文件里；生命周期 = `git mv`：`backlog/` → `schedule/<批次>/` → 交付后删正文、批次目录 `git mv` 进 `archive/`（只留 `PROGRESS.md`）。
- 四出口齐全：判不做 / 过期 → `dropped/`（追 `dropped:` + `dropped_at:`）· 合并 → `dropped/` + `merged_into:` · 批次内未完成 → 交付前 `git mv` 回 `backlog/` · 批次取消 → 全部回 `backlog/`、删批次目录。
- [MUST NOT] 引入 `picked` 等中间态；[MUST NOT] 直接删条目。
- 当轮诞生的需求可直接落 `schedule/`，但 [MUST] 同轮填 `modules` + 重生成清单（可见 + 过闸）。

## 条目 frontmatter（清单与闸的数据源，[MUST] 齐全）

```yaml
---
id: k3f9x2 # 6 位 base36 随机，[MUST NOT] 自增 / 日期前缀
title: 一句话标题
modules: [generator] # MODULES.md 垂直领域名；横向 release [MUST NOT] 写入
created: 2026-09-27
parent: "" # 拆批 / 冻结期改需求时填父条目 id
---
```

批次 `PROGRESS.md` frontmatter 的 `after: <前一批 id>` 串起批次串（同窗口串行连跑，串首留空）：同一 after 链上的批次豁免并行闸；after 悬空 / 分叉 / 成环即 `pnpm gov:check` 违规。

## 并行与冻结

- 两个在途批次领域集合相交即不得并行（`pnpm gov:check` 机械判定）；共享骨架独占与提交纪律见 `DEVELOPMENT.md`。
- 条目下发后需求内容冻结；要改 = 回池新建条目写 `parent`。

## 收口（交付前 [MUST] 按序）

ⓐ 未完成条目 `git mv` 回 `backlog/` → ⓑ 刷所涉 `modules/<领域>/SNAPSHOT.md`（未建则建）+ 上层 `SNAPSHOT.md` 对应行 → ⓒ 删条目正文、批次目录 `git mv` 进 `archive/`，`PROGRESS.md` 每条带交付 sha → ⓓ 重生成清单 → ⓔ `pnpm gov:check` 退 0 → ⓕ 所涉包自身门禁（`pnpm eslint` / 包内 test / build）退 0。

快照改动可早于归档随交付笔落盘；[MUST NOT] 先归档、快照回头再补。

## issue 分诊（用户触发）

读 `issue/` 全部正文 → 实测定位根因 → 当轮 `git mv` 到 `schedule/`（补 `modules`）/ `backlog/` / `dropped/` + 重生成清单。[MUST NOT] 批次会话顺手分诊；[MUST NOT] 建回执 / 通知。

## 调度领域 `release`

- 唯一职责 = 发版串行点（lerna publish：PR 合入 `release` 分支后由 CI `release-publish.yml` 执行），发版需当轮单独授权；[MUST NOT] 兼管登记 / 划批 / 收口（谁开谁关）。
- 承接会话一次性，[MUST NOT] 常驻。
