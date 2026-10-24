# AI 指令 — @done-coding/cli-skills

本包是各 done-coding CLI 命令对应 Agent Skill(s) 的**聚合包 + 安装器**：`skills/<name>/SKILL.md` 为内置 skill 源，`dc-cli-skills install` 把选中的 skill 装到宿主 skills 目录（`-t claude|codex|agents` 可多选，缺省 claude / `-l` 软链而非复制 / `-g` 全局 / `-a` 全部 / `-s <name>` 指定 / `-f` 覆盖）。skill 内 CLI 调用按 `command -v` 三档判断：已装 `done-coding` 用 `done-coding <X>`，否则已装子包用 `dc-<X>`，都没有才用 `npx <子包>@latest`；两者同装优先主命令，参数完全一致，示例统一用 `done-coding <X>`，本包对各 CLI 零运行时依赖。

## 包管理器

`pnpm`

## 环境健康检查

```
node -v && pnpm -v
```

## 项目命令

| 命令 | 脚本                  |
| ---- | --------------------- |
| 测试 | `vitest`              |
| Lint | `eslint --fix .`      |
| 构建 | `pnpm build`          |
| 清理 | `rm -rf es lib types` |

## 项目专属规则（从 6 开始）

6. [MUST] `skills/<name>/SKILL.md` 内钉死的 `npx <cli>` 命令（flag/参数）须与其驱动的 CLI 当前真实接口一致——改了某 CLI 的命令行接口，[MUST] 同步对应 SKILL.md（本包不做 conformance 测试，靠此约定防漂移）。
