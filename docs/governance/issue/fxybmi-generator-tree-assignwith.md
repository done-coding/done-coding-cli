---
id: fxybmi
title: 全局 done-coding 0.23.3 的 generator tree 渲染碎片时报 assignWith is not defined
created: 2026-11-13
from: done-coding-template-hub
---

## 现象

全局安装的 `done-coding` 0.23.3（内带 `@done-coding/cli-generator` 0.3.0）执行 `done-coding generator tree check` / `tree build` 时，只要配方里有需要渲染的碎片（`render: true`，如 forge 模块模板），立即报错退出：

```
ReferenceError: assignWith is not defined
    at template (…/node_modules/.pnpm/lodash.template@4.18.0/node_modules/lodash.template/index.js:1480:3)
    at Object.render (…/@done-coding+cli-generator@0.3.0/…/es/main-c3b20cee.js:970:17)
    at ue (…/main-c3b20cee.js:996:108)
    at Object.apply (…/main-c3b20cee.js:1102:113)
```

`--all` 与单个 `--recipe` 都一样。只含 `render: false` 碎片的配方不受影响。

## 复现

1. 全局装 `done-coding` 0.23.3（`done-coding generator --version` 显示 0.3.0）。
2. 在任一带 forge tree 配方的消费仓（例如 `done-creating-ledger`）仓根执行：
   `done-coding generator tree check --recipe .done-coding/generator/assemble/recipes/ledger-facts-detail.json5 --against worktree`
3. 输出 `assignWith is not defined`，退出。
4. 同一仓、同一配方用 `npx -y @done-coding/cli-generator@0.4.0 tree check --recipe … --against worktree` 正常，报「无漂移」。

（2026-11-13 实测；栈顶在 lodash.template 4.18.0 内部，推测与该版本的独立包有关，未进一步确认。）

## 影响

- 消费仓不能用全局 `done-coding generator tree` 跑 forge 等需要渲染的配方，只能用 `npx -y @done-coding/cli-generator@0.4.0` 绕开（模板中心 `module-templates/rules/README.md` 已按此写）。
- 各仓文档里写的 `done-coding generator tree build/check` 命令在这些仓会直接失败。
