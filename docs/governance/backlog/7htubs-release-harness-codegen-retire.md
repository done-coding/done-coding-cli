---
id: 7htubs
title: 发版：feat/harness-codegen-skills 合入 master + lerna 发布 + npm deprecate cli-ai / cli-mrm
modules: [harness, generator, create, mcp, cli-skills]
created: 2026-10-02
parent: ff5p5s
---

从批次 `mhzjan` 拆出（`ff5p5s` 的「发布 cli-harness」+ `6w35pj` 的 npm deprecate）：均为对外动作，需当轮授权，批次交付时未获授权。

## 要做

1. 推 `feat/harness-codegen-skills`（原 `docs/workspace`，2026-10-22 改名，未推送过）到 GitHub，PR → `master`，**merge commit 合入（[MUST NOT] squash：lerna 按逐条 conventional commit 定版本与 CHANGELOG）**。
2. PR `master → release` 合入，由 CI（`release-publish.yml`）执行 lerna publish、推 tag、快进 master。2026-10-22 预演：9 包待发（cli-harness 0.0.0→0.1.0 首发；主包 `done-coding` 0.21.0→0.22.0，含 BREAKING：移除 `DC ai` / `DC mrm`；cli-skills / create / generator / mcp 升 minor；cc-switch / component / dex 升 patch），构建后无非 d.ts 脏文件。
3. `npm deprecate @done-coding/cli-ai` / `@done-coding/cli-mrm`，文案指向 dex / cc-switch；[MUST NOT] unpublish。
4. 发布后核实 npm 版本；向 template-hub 提 issue（`register:create` 一键登记、治理闸切 dc-harness、可删 `x-create` 与 cfhiub 规避）；插件仓 done-coding-agent-plugins 按新方向修订（hub / 插件仓自行跟进，走拉取，不建回执）。
