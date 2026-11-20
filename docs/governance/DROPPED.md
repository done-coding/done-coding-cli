# 判不做 / 已过期（DROPPED）

> 文档定位：快照型清单 · **[MUST] 由 `scripts/governance-lists.py` 重生成，[MUST NOT] 手工维护**
> **[MUST NOT] 直接删条目**——删掉会丢「为什么不做」，而那正是防同一需求反复被提的东西。

共 **6** 条。

| id | 标题 | 判不做理由 | 文件 |
|---|---|---|---|
| `106cku` | generator 声明 cli-inject@workspace:0.6.3 与仓内 0.6.6 不符，全新 pn | 误报：本机 master 落后 origin/master 两笔发布提交（060cfc5、cbec4c9），远端 | [106cku-generator-inject-workspace-spec.md](dropped/106cku-generator-inject-workspace-spec.md) |
| `63f7dw` | 导出内容产物到组织站（nav.json 结构已定义） | 已由 9584e89、1558540 实现，2026-11-06 组织站已用真实产物发布验证 | [63f7dw-site-content-export.md](dropped/63f7dw-site-content-export.md) |
| `fxybmi` | 全局 done-coding 0.23.3 的 generator tree 渲染碎片时报 assignWith i | 已修复：cli-generator 0.5.0 起钉 lodash.template 4.5.0；2026-11 | [fxybmi-generator-tree-assignwith.md](dropped/fxybmi-generator-tree-assignwith.md) |
| `h3mdcb` | generator tree check 比对的模块模板没有版本锁定，分不清手改与模板更新 | 按原则关：模板实例化后不回灌、不加版本追踪机制（用户 2026-11-17 定，总协调转达） | [h3mdcb-tree-check-unpinned-template.md](dropped/h3mdcb-tree-check-unpinned-template.md) |
| `sd8tt8` | 已发布 generator 解析到 lodash.template 4.18.0，渲染时报 assignWith i | 本机环境问题：lodash.template 4.18.0（2026-03-31 发布）有缺陷，次日 4.18. | [sd8tt8-generator-lodash-template-range.md](dropped/sd8tt8-generator-lodash-template-range.md) |
| `wf2exf` | create 没有按 template.lock.json 升级已生成应用的命令 | 按原则关：模板实例化后不回灌、不加版本追踪机制（用户 2026-11-17 定，总协调转达） | [wf2exf-create-upgrade-from-lock.md](dropped/wf2exf-create-upgrade-from-lock.md) |
