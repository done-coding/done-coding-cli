# @done-coding/cli-harness

done-coding 工作区治理（harness-workspace）工具：治理清单生成、治理闸、跨仓提 issue、仓库注册表。各仓 `docs/governance/` 的清单与闸以本命令为唯一实现，规则语义见 harness-workspace skill。

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-harness.svg)](https://www.npmjs.com/package/@done-coding/cli-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

```bash
npm install -g @done-coding/cli-harness
# 或免安装
npx @done-coding/cli-harness <command>
# 或作为主 CLI 子命令
DC harness <command>
```

## 命令一览

| 命令                                                                                                 | 说明                                                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `dc-harness lists [-d <dir>] [-c]`                                                                   | 从条目 frontmatter 重生成 `BACKLOG` / `SCHEDULE` / `ARCHIVE-DONE` / `DROPPED` / `ISSUE` |
| `dc-harness check [-d <dir>]`                                                                        | 治理闸：元闸 + 并行闸 + 收口形态 + 清单零 diff，任一不过退出码 1                        |
| `dc-harness issue <仓名或仓根> -t <标题> -s <slug> -b <正文文件>`                                    | 向另一仓的 issue 收件箱提单                                                             |
| `dc-harness scope list [--inbox] [--json]`                                                           | 列出仓库注册表里登记的仓                                                                |
| `dc-harness scope check`                                                                             | 校验注册表                                                                              |
| `dc-harness scope register [-n <名>] [-p <定位>] [-a <受理范围>] [--tier <档位>] [--dir <治理目录>]` | 把当前 git 仓登记进注册表                                                               |

所有命令在**项目根**执行（只认当前目录，不向上查找）。

## lists / check

- 治理目录缺省 `docs/governance`；`-d` 或项目配置可改。
- `lists -c` 只比对不写盘，清单与条目不一致即退出码 1。
- `check` 的检查项：
  - **元闸**：`backlog/` 与在途批次里的条目都有 `modules`，且只用领域表里登记的名字。
  - **并行闸**：在途批次（`schedule/` 下）的领域集合两两不相交；同一 `after` 链上的批次（同窗口串行）豁免。`after` 指向不存在的批次、分叉或成环即违规。
  - **收口形态**：在途批次有 `PROGRESS.md`；`archive/` 下批次只留 `PROGRESS.md`；`dropped/` 条目写明 `dropped` 理由或 `merged_into`；`issue/` 条目有 `from`。
  - **清单零 diff**：同 `lists -c`。
- 批次的领域 = 条目 `modules` ∪ 批次 `PROGRESS.md` 的 `modules`。

项目配置（可选）`<项目根>/.done-coding/harness/governance/config.json`：

```json
{
  "governanceDir": "docs/governance",
  "domains": { "file": "docs/governance/SNAPSHOT.md", "section": "领域模块" }
}
```

`domains` 指定领域表从哪个文件（可限定某个二级标题下）读取，缺省为治理目录下 `MODULES.md` 全文。

## issue：跨仓提单

```bash
dc-harness issue template-hub -t "模板缺少 apps/ 工作区配置" -s monorepo-apps-workspace -b ./body.md
```

- 目标可写仓根路径，或注册表里的仓名（已存在的目录优先按路径解析）。
- 在目标仓 `issue/` 写入 `<id>-<slug>.md`（frontmatter：`id` / `title` / `created` / `from`），重生成其 `ISSUE.md`，并在目标仓**只提交这两个文件**。
- 目标仓 `ISSUE.md` 有未提交改动、或注册表中该仓未开收件箱时拒绝。
- `-f` 指定来源仓名，缺省取当前 git 仓目录名。

## scope：仓库注册表

注册表位于 `~/.done-coding/harness/scope/<由仓路径转义的目录>/repo.json`（环境变量 `DC_HARNESS_SCOPE_DIR` 可改位置），每仓一份：

```json
{
  "name": "dotfiles",
  "path": "/Users/me/.dotfiles",
  "positioning": "一句话定位",
  "accepts": "受理哪些反馈",
  "governance": {
    "dir": "docs/governance",
    "tier": "medium",
    "issueInbox": "docs/governance/issue"
  }
}
```

- `register` 登记当前 git 仓；已登记则更新，目录键被别的仓占用时拒绝覆盖。收件箱按治理目录下是否有 `issue/` 推出，没有则为 `null`。
- `check` 校验字段、`path` 存在、目录名与 `path` 一致、收件箱存在、`name` 唯一。
- `list --inbox` 只列开了收件箱的仓，供「给某仓提 issue」时按名字找目标。

## 在 AI 编码工具里使用

插件 `done-coding` 内含 `cli-harness` skill（安装见 [done-coding-agent-plugins](https://github.com/done-coding/done-coding-agent-plugins)）：说「重生成治理清单」「跑治理闸」「给 <仓名> 提 issue」即可，skill 会调用本命令。

## 许可证

MIT
