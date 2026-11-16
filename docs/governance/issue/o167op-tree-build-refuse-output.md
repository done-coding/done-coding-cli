---
id: o167op
title: generator tree build 拒写时打出整段调用栈，且提示的 --force-clean 与 --help 的 --forceClean 写法不一
created: 2026-11-13
from: done-coding-template-hub
---

## 现象

`dc-generator tree build` 因 output 里有不在 manifest 的文件而拒写时（受保护、未覆盖，属预期拒绝）：

ⓐ 原因说完后又以 `Error:` 重复一遍，并打出整段调用栈（10 行 `at …`，指向 `es/index.mjs` 与 yargs 内部），接入方读起来像生成器崩溃。
ⓑ 提示写「如确需全量重写，使用 --force-clean」，而 `tree build --help` 列的是 `--forceClean`（`--allowUntrackedDelete` 的说明里又写 `--force-clean`）。实测两种写法都被接受，但文档与提示各写一种，接入方不确定该用哪个。

cli-generator 0.4.0 与 0.5.0 表现相同。

## 复现

1. 空 git 仓，加一份 `base: { kind: "empty" }`、output 为 `svc/docs/rules` 的配方，`tree build --recipe <配方>` 写入；
2. 在 `svc/docs/rules/` 放一份 `mine.md`；
3. 再 `tree build --recipe <配方>`：退出码 1，输出约 16 行，含两遍原因与 10 行调用栈。

## 影响

模板中心规则同步（`module-templates/rules`）首个接入仓（done-creating-analysis 75dorm）反馈了这两点；模板中心 README 已注明「拒写的调用栈不是崩溃」「两种写法等价」作为临时说明。

## 附：fxybmi 复核结果（供分诊参考，不改原条目）

fxybmi（`assignWith is not defined`）当时写的原因未确认，现已复核：lodash.template 4.18.0 的 `index.js` 调用 `assignWith` 但未定义，4.18.1 补上；4.5.0 / 4.18.1 被标 deprecated、4.18.0 未标，npm 新装 `^4.5.0` 落在 4.18.0。cli-generator 0.5.0 已把它钉到 4.5.0（cli-template 也有同类修复 bf44585）。实测 done-creating-analysis 11 份配方 `tree check --all`：`npx @done-coding/cli-generator@0.5.0` 全部无漂移；0.4.0（npx）、done-coding 0.24.0（npx）、全局 0.23.3 仍报错。fxybmi 看起来已由 0.5.0 修复。
