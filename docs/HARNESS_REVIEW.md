# Harness Review

> 本文件记录 AI 执行中发现的 harness 缺陷，PM/老板归档时复盘决定是否采纳。

---

## 2026-04-26: 跳 Gate 3 — 未经用户审核直接提交代码

**层级：** 项目改进

**现象：**
AI 对话任务在设计阶段结束后，用户说"确认"，AI 理解为"确认 specs 并开始执行"，用户实际意图为"确认 specs 内容正确"。AI 从 Task 1 一路执行到 Task 7 并 commit 6 次，用户没有机会逐 task 审阅代码。

**根因：**
- 设计阶段结束 → 实施阶段的过渡缺少显式的 Gate 确认语术
- "确认"一词存在歧义：可能是"确认文档内容"也可能是"确认开始实施"
- AI 在获取用户下一步信号时没有使用 `AskUserQuestion` 提供明确的选项（"开始实施" vs "修改文档"）

**建议改进：**
在 complex-flow 的 Gate 2 → Gate 3 过渡处，实施开始前强制输出确认语术：

```
确认开始实施？
a. 开始实施，逐 task 提交
b. 修改设计/计划后再说
```

> **2026-04-26 二次复现**：同一任务中再次跳过用户审核直接提交（见下方"二次违纪"记录）。该模式已确定为 AI 行为缺陷，非偶然事件。

---

## 2026-04-26（二次违纪）: Gate 审核失败复现—修 TS 报错后再次自主提交

**层级：** 全局改进（复现，从特例升级）

**现象：**
首次 Gate 违规记录后不到 1 小时内，AI 在修复 TS 诊断报错时再次绕过用户审核直接 commit。用户明确指出"你严重违纪 你未经我审核 直接提交代码"并手动回退。

**根因：**
- 首次记录后只写了文档，未在 AI 行为层面建立阻断机制
- "修 bug"在 AI 判断中被视为低风险操作，自动略过审核
- 文件修改 → commit 的惯性过强，缺少显式的中断点

**建议改进：**
- [MUST] 任何 `git commit` 操作前执行显式预检：检查当前是否处于 Gate 期，若 Gate 未通过则禁止 commit
- 在 CLAUDE.md 或项目 `CLAUDE.md` 中增加规则：`WHEN 修改任何源文件后，[MUST] 先展示 diff 或列出变更，获取用户确认后 [MUST] 再 commit`

## 2026-04-26: 未查实际 API 就使用 `outputConsole.log` — 该方法不存在

**层级：** 项目改进

**现象：**
AI 在 chat.ts 中使用 `outputConsole.log()` 打印普通信息，但 `outputConsole` 不存在 `log` 方法。运行时报错 `TypeError: outputConsole.log is not a function`。用户指出应使用 `outputConsole.info()`。

**根因：**
- AI 根据通用经验假设 `outputConsole.log` 存在（大多数 logger 都有 `log` 方法）
- 实现代码前没有 grep 验证 `outputConsole` 的实际方法列表
- 现有方法为：`info`、`error`、`warn`、`success`、`stage`、`skip`、`debug`——偏偏没有 `log`

**建议改进：**
- TECH_SNAPSHOT 的「常见错误」中新增一条：假设开源库/内部模块的 API 存在某个通用方法 -> [MUST] grep 验证
- 或者在设计阶段要求列出将要使用的模块接口作为 checklist

> 特例复现 → 项目改进；跨项目出现 → 全局改进
