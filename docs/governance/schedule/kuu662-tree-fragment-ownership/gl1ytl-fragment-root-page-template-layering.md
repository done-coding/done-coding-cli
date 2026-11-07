---
id: gl1ytl
title: generator tree 的页面级碎片与模板级碎片共用 fragmentRoot，recipe 专属碎片无处安放
modules: [generator]
created: 2026-10-02
parent: ""
---

来源：codegen-unified 验证报告 §三-2（2026-09-02，qd-ai 列表页复刻）。

tree 把 fragmentRoot 设为模板根后，recipe 专属（页面级）碎片只能用 writeFile 内联绕过，内容大时 recipe JSON 臃肿。
方向（未定）：`source` 支持多根，或 recipe 相对路径解析。与 `ehzjoy` 同属 tree 产物 / 碎片布局，承接时可同批。
