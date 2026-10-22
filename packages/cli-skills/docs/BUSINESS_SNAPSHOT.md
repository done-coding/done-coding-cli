# 业务快照 — @done-coding/cli-skills

> 文档定位：快照型 · 覆盖更新、只写当前状态。技术结构见同目录 `TECH_SNAPSHOT.md`。

## 1. 定位

done-coding CLI 各命令的 **Agent Skills 聚合包 + 安装器**：把「AI 何时、怎样调用 done-coding 命令」写成 skill（`SKILL.md`），随 npm 包分发，并提供 `dc-cli-skills install` 装进各 AI 编码工具的 skills 目录。

- 本包是 CLI 类 skill 的**唯一源头**；插件仓（done-coding-claude，规划改名）同步本包产物对外分发，[MUST NOT] 在下游手改拷贝。
- skill 正文按 Agent Skills 规范写、**宿主中立**（Claude Code / Codex 等通读），CLI 调用一律「已装 bin / `npx`」两路。

## 2. 内置 skill

| skill | 领域 | 用途 |
|---|---|---|
| `create-done-coding` | create | 用模板非交互建项目（少问多推断 + 回显确认） |
| `cli-generator` | generator | 具名批次生成 / assemble 组装 |
| `module-generate` | generator | 经模块模板配置驱动生成代码模块（tree build / check） |
| `cli-harness` | harness | 治理清单 / 治理闸 / 跨仓 issue / 仓库注册表 |

各 skill 目录归属所服务命令的领域（见仓库 `docs/governance/MODULES.md`），本包只持有聚合与安装骨架。

## 3. 安装

```bash
dc-cli-skills install [-g] [-t claude|codex|agents ...] [-l] [-a | -s <名> ...] [-f]
```

| 选项 | 行为 |
|---|---|
| `-t / --target`（可多个，缺省 `claude`） | `claude` → `.claude/skills` · `codex` → `.codex/skills` · `agents` → `.agents/skills`（跨工具共享目录） |
| `-g / --global` | 落家目录；缺省落当前项目根 |
| `-l / --link` | 软链到包内 skill 目录而非复制，随包升级自动生效；包来自 npx 临时缓存时拒绝（缓存清理后链会悬空） |
| `-a` / `-s` | 全部 / 指定 skill；都不给则交互多选 |
| `-f / --force` | 覆盖同名项（含悬空软链）：软链只摘链、实体目录限定在 skills 根内删除，**不会**写进软链指向的包内源目录 |

安装器只认「宿主 skills 目录」，不关心该目录由谁管理（如 dotfiles 软链出去的家目录配置）。

## 4. 约束与已知边界

- 不做 MCP：skill + CLI 已覆盖，免常驻服务与多宿主配置。
- 安装是复制或软链两种形态，不做版本比对 / 自动更新（软链形态天然跟随包版本）。
