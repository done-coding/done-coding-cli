---
id: thpfmb
title: 下次发版准备时删除 lerna.json 的 forcePublish，恢复按变化发版
modules: [showcase]
created: 2026-11-11
---

## 现象

批次 2yiwn1 为让 16 个公开包一起发版（README 文档站链接上 npm 页），在 `lerna.json` 的 `command.version` 加了 `"forcePublish": true`。发版后 CI 把 master 快进到 release，该配置留在 master；不删则此后每次 `lerna version`（含 prerelease 的 alpha）都会全量升 16 个包。

## 做法

在下一次发版准备分支（以 origin/master 为基压缩的那一笔）里删掉 `"forcePublish": true`，用 lerna 预演确认只列出有变化的包。

## 触发条件（何时下发）

2yiwn1 所在发版已由 CI 发布完成后，下一次准备发版（含 prerelease）时 [MUST] 先做本条；若在此前就要发 alpha，也先做本条。
