---
id: a5di8q
title: dc create 实例不记录模板来源与 commit——建议生成时写 .done-coding/template.lock.json
created: 2026-10-03
from: done-coding-template-hub
---

## 现象

`dc create` 生成的实例项目**不记录自己来自哪一版模板**，事后无法回答「这个项目基于哪个模板、哪个 commit」，也就无从判断它该跟进哪些模板改动。

实测（2026-10-03，本机 `~/.done-coding/create/instances.json`，43 条）：每条只有 `path` / `template` / `templateUrl` / `createdAt`，**无模板目录（`--templateDirectory`）、无分支、无模板 commit、无答案**；实例目录内也不留任何来源信息。另：该注册表只在本机，实例换机器 / 被别人 clone 后来源信息即丢失。

## 复现

1. `dc create -p <hub 仓根> --templateDirectory templates/apps/web-admin-vue3-standalone ...` 建一个实例；
2. 实例目录内找不到模板来源；`instances.json` 新条目不含目录与 commit。

## 期望（供分诊参考，非方案指定）

参照业界脚手架的做法（cruft `.cruft.json`、copier `.copier-answers.yml`：生成时在实例内记模板来源 + commit，`update` 据此做差异合并）：

- **实例内出生记录**：create 成功后写 `<实例>/.done-coding/template.lock.json`（随项目入 git），字段建议：`template`（模板名，若来自清单）、`url`、`directory`、`branch`、**`commit`**（检出时模板仓的 commit sha）、`answers`（`--env` 的 key → 值）、`createdAt`、`cli`（create-done-coding 版本）。
- **敏感答案不落盘**：模板 `.done-coding/template.json` 的问题项可标 `secret: true`（如凭证类），lock 只记 key 不记值。
- **本机注册表同步补字段**：`instances.json` 条目补 `directory` / `branch` / `commit`。
- 本次只要「记录」；按 lock 做模板升级（copier update 式差异合并）不在本 issue 范围，有了记录再议。

## 背景

template-hub 讨论模板版本控制时定的第一步（用户 2026-10-03 同意）：先让每个实例可追溯到模板 commit。模块模板侧已有版本约束（template-hub `base.json` 钉基座 + `schema.json` `base.range`），项目模板侧缺的就是这份出生记录。
