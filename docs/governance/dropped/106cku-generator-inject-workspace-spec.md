---
dropped: 误报：本机 master 落后 origin/master 两笔发布提交（060cfc5、cbec4c9），远端 generator 已是 workspace:0.6.7，与 inject 一致
dropped_at: 2026-11-07
id: 106cku
title: generator 声明 cli-inject@workspace:0.6.3 与仓内 0.6.6 不符，全新 pnpm install 失败
modules: [generator]
created: 2026-11-07
parent: ""
---

## 现象

`packages/generator/package.json` 的 devDependencies 写 `"@done-coding/cli-inject": "workspace:0.6.3"`，而 `packages/inject` 已是 0.6.6（其余包都已跟到 `workspace:0.6.6`）。master 与 feat/cli-showcase 均如此。

## 复现

全新克隆或清掉 node_modules 后：

```bash
pnpm install --frozen-lockfile
# ERR_PNPM_OUTDATED_LOCKFILE: local dependency "@done-coding/cli-inject" at "../inject" is outdated
pnpm install --no-frozen-lockfile
# No matching version found for @done-coding/cli-inject@workspace:0.6.3 inside the workspace. Available versions: 0.6.6
```

已有 node_modules 的机器（如 mbp2017）测试能跑，掩盖了问题。2026-11-07 主协调在本机复核 b2eef45 时撞上。

## 期望

generator 跟其他包一样写 `workspace:0.6.6`（或查清为何发版流程漏改它），用项目锁定的 pnpm 版本重跑 install 更新 lockfile，并确认全新克隆 `pnpm install --frozen-lockfile` 通过。注意：本机 pnpm 12.15 与生成锁的版本不同时 lockfile 会出现大面积 peer 解析改写，提交前核对 diff 只含预期变动。
