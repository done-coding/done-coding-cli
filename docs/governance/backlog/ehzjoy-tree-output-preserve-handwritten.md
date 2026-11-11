---
id: ehzjoy
title: generator tree 产物目录整级所有权，不能与手写文件混住（需 recipe preserve 共存声明）
modules: [generator]
created: 2026-10-02
parent: ""
---

来源：codegen-unified 模板体系验证（`validation-list-page.md`「P2 目录混住限制」，2026-09-02）。

tree build 对产物目录按 manifest 整级接管，同目录内手写文件会被判为孤儿 / 漂移；业务页面常需在生成目录旁放手写扩展。
方向：recipe 增 preserve（共存白名单）声明。待 admin-core 组件划分重整（对齐 element-plus）后以 reference 重建作第二验证场时一并定案。

## 退回需求池（2026-11-08）

- 曾随批次 kuu662 → ngco25 下发，未开工即撤回（77a9c0d）；用户 2026-11-07 表示不记得有此需求。
- 重新下发的触发条件：有业务仓需要在 tree 产物目录内放手写文件、被判为孤儿或漂移而受阻，并重新提出。
