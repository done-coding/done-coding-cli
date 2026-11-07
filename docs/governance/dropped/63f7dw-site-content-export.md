---
id: 63f7dw
title: 导出内容产物到组织站（nav.json 结构已定义）
created: 2026-11-05
from: done-coding.github.io
modules: [showcase]
parent: ""
dropped: 已由 9584e89、1558540 实现，2026-11-06 组织站已用真实产物发布验证
dropped_at: 2026-11-06
---

## 现象

done-coding.github.io 已能读取内容产物，但尚未收到导出，站点显示「文档建设中」。契约原本没有定义 `nav.json` 的结构，现已定义，导出时需按此生成。

## 契约

完整内容见 done-coding.github.io 仓根 `AGENTS.md` 的「内容产物契约」。导出到 `apps/<产品>-site/content/<版本>/`，并更新 `apps/<产品>-site/content/current.json`：

- `current.json`：`{ "version": "<版本>", "source": "<产品仓>@<提交>" }`，两个字段都必填。
- `docs/`：Markdown 文档，站内链接用相对路径。文档发布在 `/<产品>/docs/` 下，站点首页由站点外壳提供。
- `demo/`：可选，须含 `index.html`，以 `/<产品>/demo/` 作 base 构建。
- `nav.json`（本次新定义）：非空数组，每项 `{ "text": 标题, "link"?: 相对 docs/ 的路径, "items"?: 子项 }`，`link` 和 `items` 至少有一个；`link` 可省略 `.md`，目录写成 `guide/`，对应 `guide/index.md`。
- 产物不含源码和 source map。

## 复现路径

在 done-coding.github.io 运行 `pnpm verify`，或查看 `packages/site-kit/fixtures/content/` 的样例。产物不合契约时构建失败，并在报错里指明文件和原因。
