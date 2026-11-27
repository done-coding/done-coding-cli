# 外部反馈收件箱（ISSUE）

> 文档定位：快照型清单 · **[MUST] 由 `scripts/governance-lists.py` 重生成，[MUST NOT] 手工维护**
> 正文在 `issue/<id>-<slug>.md`；其中条目只有一个状态：**未分诊**。
> 分诊 [MUST] 由用户触发，三个出口全部 `git mv`：`schedule/<批次>/`（当轮就做）· `backlog/`（成立但不是现在）· `dropped/`（不成立 / 已修 / 重复）。
> **issue 是报告不是派单**：外部方无回执可期、无进度可问，处置权在本仓。
> 按登记日升序——**最上面的就是积压最久的**。

共 **6** 条待分诊。

| id | 标题 | 来源 | 登记 | 文件 |
|---|---|---|---|---|
| `5pmb5g` | dc-harness 三闸：未跟踪的新文件不被检查（恒绿）；另有方向、__all__、骨架 public 分测试、读 | business-chat-studio | 2026-11-16 | [5pmb5g-harness-gates-pilot-feedback.md](issue/5pmb5g-harness-gates-pilot-feedback.md) |
| `xf85fi` | generator 没有以 OpenAPI 文档为输入的生成能力，生成调用层只能各仓接外部工具 | done-creating-ledger | 2026-11-16 | [xf85fi-generator-openapi-input.md](issue/xf85fi-generator-openapi-input.md) |
| `1931wd` | 归档清单头部缺「不保证是现状」的提示 | dotfiles | 2026-11-21 | [1931wd-archive-list-not-current-notice.md](issue/1931wd-archive-list-not-current-notice.md) |
| `6av5rn` | 提 issue 时目标填目录不提示改用注册表仓名 | dotfiles | 2026-11-21 | [6av5rn-issue-target-prefer-registry-name.md](issue/6av5rn-issue-target-prefer-registry-name.md) |
| `t8fyan` | 归档清单没有时间顺序，找不到某领域最近交付的批次 | dotfiles | 2026-11-21 | [t8fyan-archive-list-time-order.md](issue/t8fyan-archive-list-time-order.md) |
| `pgb9y6` | check 增加公开仓的内部信息扫描 | blueprint | 2026-11-25 | [pgb9y6-public-surface-scan.md](issue/pgb9y6-public-surface-scan.md) |
