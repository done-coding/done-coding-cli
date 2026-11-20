---
dropped: 按原则关：模板实例化后不回灌、不加版本追踪机制（用户 2026-11-17 定，总协调转达）
dropped_at: 2026-11-17
id: wf2exf
title: create 没有按 template.lock.json 升级已生成应用的命令
created: 2026-11-16
modules: [create]
parent: ""
from: done-creating-asset
---

## 现象

`done-coding create` 生成应用时写了 `.done-coding/template.lock.json`（模板仓、目录、提交、答案），但 CLI 没有按它把已生成的应用升级到模板新提交的命令。done-creating-asset 的 asset-admin 锁定 b3cb73b，template-hub 当前 9052c91，其间 7 笔提交改了 18 个文件；同步只能手工：按 lock 的答案用 `create` 重新生成到临时目录，逐文件比对后拷回，`main.ts` 等手改过的文件手工合并，再换 lock。

## 复现

1. `done-coding create` 生成任一 forge 应用；
2. 模板仓之后有新提交；
3. 没有命令能按 lock 列出「模板自有且未手改 / 手改过 / 新增 / 删除」的文件并完成升级。

## 期望

`done-coding create upgrade`（或等价子命令）：读 lock，以新提交按 lock 答案重新渲染，三方比对（lock 提交的渲染结果 / 当前文件 / 新提交的渲染结果）：未手改的直接替换，新增的加上，手改过的给出冲突或补丁，最后更新 lock。至少先提供只读的 `--check`，列出落后的文件与手改过的文件。
