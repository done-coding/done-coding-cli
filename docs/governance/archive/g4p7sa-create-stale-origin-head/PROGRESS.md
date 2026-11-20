---
id: g4p7sa
title: create 本地模板仓默认分支不再信本地过期的 origin/HEAD
modules: [create]
created: 2026-11-17
source: issue 856xd7（from blueprint）；总协调 2026-11-17 按用户新定规矩（done-coding 各仓缺陷直接下发）派单
after: ""
---

# create 本地模板仓默认分支不再信本地过期的 origin/HEAD

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| 下发：issue 856xd7 从 `issue/` 移入本批 | 已完成 | ac9cd25 |
| 定位根因 | 已完成 | 记于下 |
| 修复：默认分支先问远端实际 HEAD，本地 `origin/HEAD` 只作离线回落；两者不一致时提示 | 已完成 | 9e741b7 |
| 测试：本地 `origin/HEAD` 过期指向旧分支的复现用例 | 已完成 | 9e741b7 |
| 刷新 create 快照；归档本批，`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 收工 | | |

## 边界

- 分支：从 master `faea516` 切 `fix/create-stale-origin-head`；push、合并、发版由用户执行（总协调转达不算发版授权）。
- 只改本仓；template-hub 只读。
- 共享骨架独占：无。

## 根因

- 复现：`done-coding create -p <本机 template-hub> --templateDirectory templates/apps/admin-app-vue3-member --list-questions` 报「模板目录不存在」。
- create 0.20.0 起（`8344fba`），本地模板仓不带 `-b` 时默认取远端默认分支：`git fetch origin` 后读本地 `refs/remotes/origin/HEAD`。
- 本机 template-hub 克隆的 `refs/remotes/origin/HEAD` 是 2026-09-26 一次 fetch 留下的，指向 2026-06 的 `origin/feat/raw-prep`；远端实际 HEAD 是 `master`（`git ls-remote --symref origin HEAD`）。`git fetch` 不更新这个指针，于是检出了旧分支，该分支没有 `templates/apps/` 下的模板。
- 「11-16 夜里还能过」：当时全局 done-coding 是 0.23.3，自带 create 0.18.0，还没有「默认远端分支」；2026-11-17 16:30 全局升到 0.24.2（create 0.21.0）后暴露。template-hub 一侧没有问题。

## 验证（2026-11-17）

- 新用例「本地 origin/HEAD 过期指向旧分支」：修复前报「模板目录不存在」（与 issue 同一报错），修复后取 `origin/stable` 并提示 `git remote set-head origin -a`。
- 原用例「无 origin/HEAD 时优先 origin/master」的本意是「拿不到默认分支信息时回落 origin/master」；新逻辑会先问远端，故该用例把远端 HEAD 也设成取不到，断言不变。
- create 包：vitest 51 例全过，eslint、tsc、prettier 无报错，build 通过。
- 实测：本分支构建跑 issue 原命令（本机 template-hub，`origin/HEAD` 仍指 `feat/raw-prep`），正常输出预设问题；template-hub 的 `origin/HEAD` 与 worktree 未被改动（本次运行的临时 worktree 已清理）。

## 留给别处

- 要在本机生效需发版（create 与主包 done-coding）；发版由用户确认。未发版前绕行：在 template-hub 执行 `git remote set-head origin -a`，或 create 显式带 `-b master`。
- 本机 template-hub 另有 5 个 2026-11-12 至 11-16 残留的 `done-coding-template-*` 临时分支（其中 4 个带 worktree 登记），来自更早被中断的 create 运行，不是本批产生；清理属 template-hub 本机维护，未动。
- template-hub 本地 master 领先 origin 114 条：未给 `-b` 时 create 按设计取远端默认分支，本地未推送的模板改动不会被用到。
