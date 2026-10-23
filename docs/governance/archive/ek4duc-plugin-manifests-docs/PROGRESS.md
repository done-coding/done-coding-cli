---
id: ek4duc
title: 插件清单对齐 superpowers + harness / 主 cli 文档补齐
modules: [cli-skills, harness, create]
created: 2026-10-23
source: 用户 2026-10-23 当轮需求
after: ""
---

# PROGRESS — ek4duc

授权边界：实现 + 本地验证 + 提交；push / 发版各需单独授权。市场目录仓 done-coding-agent-plugins 的 ⓑ 改动在该仓提交。
共享骨架独占：`packages/cli/README.md`（主 cli 文档）。

## 进度

- [x] gfakgf 插件清单：`build` 后由 `scripts/plugin-manifests.mjs` 按 package.json 生成 `.claude-plugin/plugin.json` / `.codex-plugin/plugin.json`，纳入 `package.files`、生成物 gitignore（沿用 injectInfo 做法，未用 lerna version 生命周期脚本：版本只有 package.json 一个来源，无需回写提交）。
- [x] ww7mfy 文档补齐：harness README 命令手册；主 cli README 补 dex / harness / create template-config、删失效的 `-c` 与不存在的 `.done-coding.config.js`；根两快照、harness / create 模块快照、cli-skills 包快照。
- [x] 市场目录仓（done-coding-agent-plugins 批次 oekr57）：Codex 条目加 `category` / `policy`、目录加 `interface.displayName`，Claude 条目加 `category`；`e11e5b8` · `1f5e217`。
- [x] 验证（Codex gpt-6.1-sol，隔离目录 + 隔离 HOME / CLAUDE_CONFIG_DIR / CODEX_HOME）：lerna 7.4.2 源码确认 publish 先改版本后 prepack；版本改 0.3.1-verify.0 后 `npm pack` 解包两清单版本一致；构建后工作树无非 d.ts 脏文件（清单命中 .gitignore）；Claude `plugin validate` 通过、`plugin list` 显示 `Version: 0.3.1-verify.0`；Codex 安装后版本 0.3.1-verify.0、`interface.displayName` 取自本包清单、4 个 `done-coding:*` skill 均启用。
- 生效条件：需发版（cli-skills minor）；push / 发版待用户授权。

## 交付

> dd56f75 之后的提交经用户确认压为一次提交；下表为压缩前 sha，原历史在本地备份分支 `backup/plugin-manifests-pre-squash`。

| 条目 | sha | 结果 |
|---|---|---|
| gfakgf | c9f09f3 | 两份插件清单随包发布，版本随 package.json |
| ww7mfy | 473b6e1 | harness / 主 cli / 快照文档补齐 |
