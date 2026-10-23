---
id: bjpfyu
title: npm deprecate @done-coding/cli-ai / cli-mrm（文案指向 dex / cc-switch）
modules: [cli-skills]
created: 2026-10-23
parent: 7htubs
---

从 `7htubs` 拆出：2026-10-23 发版已完成，两包代码与主命令入口已于该版移除，但 npm 上未加弃用标记（`npm view <包> deprecated` 为空）。需本机 npm 登录凭据，由用户执行：

```bash
npm deprecate @done-coding/cli-ai "已退役，对话请改用 @done-coding/cli-dex"
npm deprecate @done-coding/cli-mrm "已退役，模型切换请改用 @done-coding/cli-cc-switch"
```

[MUST NOT] unpublish。执行后以 `npm view @done-coding/cli-ai deprecated` 非空为准。
