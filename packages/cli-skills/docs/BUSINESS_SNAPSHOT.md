# 业务快照 — @done-coding/cli-skills

> 文档定位：快照型 · 覆盖更新、只写当前状态。技术结构见同目录 `TECH_SNAPSHOT.md`。

## 1. 定位

done-coding CLI 各命令的 **Agent Skills 聚合包 + 安装器**：把「AI 何时、怎样调用 done-coding 命令」写成 skill（`SKILL.md`），随 npm 包分发，并提供 `dc-cli-skills install` 装进各 AI 编码工具的 skills 目录。

- 本包是 CLI 类 skill 的**唯一源头**，也是插件 `done-coding` 的内容：插件市场目录仓 done-coding-agent-plugins 的 Claude / Codex 两份 `marketplace.json` 直接以 npm 上的本包为插件来源（不拷贝、不同步），本包发版即插件更新。包内带 Claude / Codex 两份插件清单（构建时由 package.json 生成），宿主据此显示插件版本与介绍。
- skill 正文按 Agent Skills 规范写、**宿主中立**（Claude Code / Codex 等通读），CLI 调用一律「已装 bin / `npx`」两路。

## 2. 内置 skill

| skill                | 领域      | 用途                                                 |
| -------------------- | --------- | ---------------------------------------------------- |
| `create-done-coding` | create    | 用模板非交互建项目（少问多推断 + 回显确认）          |
| `cli-generator`      | generator | 具名批次生成 / assemble 组装                         |
| `module-generate`    | generator | 经模块模板配置驱动生成代码模块（tree build / check） |
| `cli-harness`        | harness   | 治理清单 / 治理闸 / 跨仓 issue / 仓库注册表          |

各 skill 目录归属所服务命令的领域（见仓库 `docs/governance/MODULES.md`），本包只持有聚合与安装骨架。

## 3. 安装

**主路径 = 插件**：Claude `/plugin marketplace add done-coding/done-coding-agent-plugins` + `/plugin install done-coding@done-coding`；Codex `codex plugin marketplace add …` + `codex plugin add done-coding@done-coding`。skill 以 `done-coding:<名>` 出现，由宿主管理下载 / 版本 / 更新。

下面的 `install` 命令是**备用**（不装插件的场景）；[MUST NOT] 与插件同时装同名 skill，否则会被加载两份。

```bash
dc-cli-skills install [-g] [-t claude|codex|agents ...] [-l] [-a | -s <名> ...] [-f]
```

| 选项                                     | 行为                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `-t / --target`（可多个，缺省 `claude`） | `claude` → `.claude/skills` · `codex` → `.codex/skills` · `agents` → `.agents/skills`（跨工具共享目录） |
| `-g / --global`                          | 落家目录；缺省落当前项目根                                                                              |
| `-l / --link`                            | 软链到包内 skill 目录而非复制，随包升级自动生效；包来自 npx 临时缓存时拒绝（缓存清理后链会悬空）        |
| `-a` / `-s`                              | 全部 / 指定 skill；都不给则交互多选                                                                     |
| `-f / --force`                           | 覆盖同名项（含悬空软链）：软链只摘链、实体目录限定在 skills 根内删除，**不会**写进软链指向的包内源目录  |

安装器只认「宿主 skills 目录」，不关心该目录由谁管理（如 dotfiles 软链出去的家目录配置）。

## 4. 约束与已知边界

- 不做 MCP：skill + CLI 已覆盖，免常驻服务与多宿主配置。
- 安装是复制或软链两种形态，不做版本比对 / 自动更新。
- 已知局限：pnpm 全局安装时包的真实路径含版本号（`.pnpm/@done-coding+cli-skills@<版本>/…`），软链指向真实路径，升级后旧版本目录被清理即失效，需 `install -f -l` 重建（npm 全局安装无此问题）；`-l` 遇 npx 来源被拒时打印完整报错堆栈而非一行提示。
