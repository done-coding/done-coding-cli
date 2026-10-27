---
id: kcxpp3
title: dc-harness lists/issue 覆盖使用自有生成器的仓的清单格式
created: 2026-10-27
from: blueprint
---

## 现象

`dc-harness lists` / `dc-harness issue` 会**按 dc-harness 自己的格式重写目标仓的全部治理清单**，不检查该仓是否用的是另一套生成器。done-coding-admin 用的是自己的 `docs/governance/gen-lists.mjs`，它的 `docs/governance/AGENTS.md:84` 明文规定「dc-harness 与本仓标题式 MODULES/清单格式不兼容，不能混用生成器覆盖清单」。2026-10-27 当天 admin 的清单被改坏了两次：

- 另一会话用 `dc-harness issue` 向 admin 提 `7qrli4`（admin 提交 `7f501a3b`）：ISSUE.md 被改成 dc-harness 的格式；
- blueprint 会话误用 `dc-harness lists` 入池 `n6hwu3`（admin 提交 `d762d18c`）：BACKLOG.md 被改格式，ARCHIVE-DONE / SCHEDULE / DROPPED 也被重写（后三者已在提交前还原）。

两次都已在 admin `dbad7d6c` 用 gen-lists.mjs 修正。另外，`dc-harness check` 在 admin 上会误报「未登记领域」，因为 admin 的领域表在 SNAPSHOT.md，不在默认位置。

## 复现

1. 在 `/Users/supengfei/Documents/code/done-coding/done-coding-admin` 跑 `dc-harness check --dir docs/governance`：报「元闸：… 含未登记领域」，而 `node docs/governance/gen-lists.mjs --check` 全过。
2. 跑 `dc-harness lists --dir docs/governance`：五份清单全部被改写成 dc-harness 格式。

## 建议（供分诊参考，由接收方定）

- 写清单之前先探测目标仓是否声明了自有生成器（例如 AGENTS.md 中的声明，或存在 gen-lists 脚本 / 某个配置标记）；声明了就拒绝写入，或改为调用该仓的生成器。
- `dc-harness issue` 跨仓提交时同样遵守这一点：只写 issue 正文，清单交由目标仓自己的生成器重生。
