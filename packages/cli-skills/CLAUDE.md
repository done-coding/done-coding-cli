# AI 指令 — @done-coding/cli-skills

本包是各 done-coding CLI 命令对应 Agent Skill(s) 的**聚合包 + 安装器**：`skills/<name>/SKILL.md` 为内置 skill 源，`dc-cli-skills install` 把选中的 skill 拷到 `.claude/skills/`（`-g` 全局 / `-a` 全部 / `-s <name>` 指定 / `-f` 覆盖）。skill 内命令一律走 `npx <cli>@latest`，本包对各 CLI 零运行时依赖。

## 包管理器

`pnpm`

## 环境健康检查

```
node -v && pnpm -v
```

## 项目命令

| 命令 | 脚本 |
|---|---|
| 测试 | `vitest` |
| Lint | `eslint --fix .` |
| 构建 | `pnpm build` |
| 清理 | `rm -rf es lib types` |

---

## 硬规则

规则编号顺序递增，作废时留空缺位，不重新编号。
每条规则：一句话，可执行，可证伪。

### 通用基础规则（1–5，不可修改）

1. [MUST] 每次新会话，在任何代码修改前先读本文件。
2. [MUST NOT] 将变更范围扩展到用户明确要求之外——不重构、不重命名、不重格式化非目标文件。
3. [MUST] 遵循仓库的 lint 和格式配置，声明任务完成前先运行 lint。
4. [MUST] 优先复用现有抽象，不创建冗余封装——修改前先搜索代码库。
5. [MUST] 行为变更时添加或更新测试，除非用户明确跳过。

### 项目专属规则（从 6 开始）

6. [MUST] `skills/<name>/SKILL.md` 内钉死的 `npx <cli>` 命令（flag/参数）须与其驱动的 CLI 当前真实接口一致——改了某 CLI 的命令行接口，[MUST] 同步对应 SKILL.md（本包不做 conformance 测试，靠此约定防漂移）。

---

## 规则更新协议

WHEN 用户更正暗示新规则或模式时，在写入任何文件前：

1. 在对话中输出提案块（不写入文件）
2. 等待用户确认
3. 只写入已批准的内容，[MUST NOT] 改写无关章节

---

## Compact Instructions

上下文压缩时，[MUST] 优先保留以下内容（按优先级排序）：

1. 当前任务等级及所处阶段
2. Direct Targets — 计划修改或已修改的文件路径
3. 最近一次验证命令及其退出码
4. 硬规则章节

压缩时 [MUST NOT] 丢弃：活跃 spec 文档中的进度块、用户的明确确认记录。
