---
name: cli-harness
description: Use when maintaining a harness-workspace governance directory (docs/governance) — regenerating BACKLOG / SCHEDULE / ARCHIVE-DONE / DROPPED / ISSUE lists, running the governance / instruction gates before dispatch or delivery (AGENTS.md / CLAUDE.md), or filing an issue into another repo's inbox（重生成治理清单、跑治理闸；给 <仓名> 提 issue / 反馈给 <仓名> / 向兄弟仓提 issue；查哪些仓收 issue、登记本仓到仓库注册表）. Drives the dc-harness CLI via an installed CLI or npx — no resident MCP needed.
---

# 治理目录工具（cli-harness / dc-harness）

用 `dc-harness` 维护 harness-workspace 治理目录（默认 `docs/governance/`）的**机械部分**：清单生成、治理闸、跨仓提 issue、仓库注册表。`dc-harness` 是这些机械操作的**唯一实现**（清单格式以它的输出为准）；治理规则的语义见 harness-workspace 方法论与各仓治理目录的指令文件（`AGENTS.md` / `CLAUDE.md`）。

## 调用入口

按序用 `command -v` 判断，命中即停：ⓐ 已装 `done-coding` → `done-coding <X> …`；ⓑ 否则已装子包 → `dc-<X> …`；ⓒ 都没有 → `npx <子包>@latest …`。两者都装时优先 `done-coding <X>`，参数完全一致。

下文 CLI 示例统一写 `done-coding <X>`；执行时将入口整体等价替换为上述选中的入口。可用以下 Bash 数组保留入口和参数边界，调用时写 `"${dc_entry[@]}" <参数…>`：

```bash
if command -v done-coding >/dev/null 2>&1; then
  dc_entry=(done-coding harness)
elif command -v dc-harness >/dev/null 2>&1; then
  dc_entry=(dc-harness)
else
  dc_entry=(npx @done-coding/cli-harness@latest)
fi
```

**命令都在项目根执行**（治理目录按项目根解析）。

## 何时用

| 场景                                                                         | 命令                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| 改了 `backlog/` `schedule/` `archive/` `dropped/` `issue/` 下任何条目 / 批次 | `done-coding harness lists`                          |
| 下发批次前、交付收口前、提交治理改动前                                       | `done-coding harness check`                          |
| 要向**另一个仓**（本治理目录管辖之外）反馈问题                               | `done-coding harness issue <仓名或仓根>`             |
| 查哪些仓收 issue / 某仓是做什么的                                            | `done-coding harness scope list --inbox`             |
| 把本仓登记进仓库注册表 / 校验注册表                                          | `done-coding harness scope register` / `scope check` |

## lists — 重生成清单

```bash
done-coding harness lists            # 从条目 frontmatter 重写有差异的清单
done-coding harness lists --check    # 只比对不写盘，有差异退出码 1
```

清单 [MUST NOT] 手改；条目变了就重生成，并与条目改动**同一笔提交**。

## check — 治理闸

```bash
done-coding harness check            # 任一违规退出码 1，逐条输出 ❌
```

检查项：

- **元闸**：`backlog/` 与在途批次条目的 `modules` 非空，且每个值都在领域表里。
- **并行闸**：两个在途批次领域集合相交即违规；同一批次串（后一批 `PROGRESS.md` frontmatter 写 `after: <前一批 id>`，批次 id = 目录名 `<id>-<slug>` 前缀）上的批次豁免。
- **批次串**：`after` 指向的批次在 `schedule/` 与 `archive/` 都不存在（悬空）、两个在途批次 `after` 同一批（分叉）、after 链成环，均违规。
- **收口形态**：在途批次有 `PROGRESS.md`；`archive/<批次>/` 只剩 `PROGRESS.md`；`dropped/` 条目有 `dropped:` 或 `merged_into:`；`issue/` 条目有 `from:`。
- **清单零 diff**。

## instructions — 指令预算与兼容入口

改动 `AGENTS.md` / `CLAUDE.md` 后、交付收口前 [MUST] 运行：

```bash
done-coding harness instructions          # 逐条 ❌ 或单行 ✅，退出码 0/1
done-coding harness instructions --json   # { budget, files: [{ file, bytes }], errors }
```

必须在 Git 项目根执行（cwd-only），无需治理目录。以 Git 跟踪文件为准，读取工作树当前内容；未跟踪入口不算兼容入口。检查根 AGENTS.md ≤ 16384 B、子层 ≤ 8192 B、根到各层链路 ≤ 32768 B；违规给实际值、预算、超出量，链路列每层字节及最大贡献者。

同级 CLAUDE.md 须为跟踪的普通文件，首个非空行 `@AGENTS.md`，可追加 Claude 专属增量；软链不通过。无 AGENTS.md 的 CLAUDE.md 除单行纯导入外，报「正文仍在 CLAUDE.md」。

建议仓内 pre-commit 在暂存 `AGENTS.md` / `CLAUDE.md` 时运行本命令；检查工作树内容，并非暂存快照。`check` 只有配置 `instructions.gate: true` 才连带检查，默认关闭，因此不能省略上述独立检查。

## issue — 向兄弟仓提 issue

```bash
done-coding harness issue <仓名|仓根路径> -t "一句话标题" -s semantic-slug -b ./issue-body.md
```

**用户说「给 <仓名> 提 issue」时 [MUST] 按此寻址**，[MUST NOT] 凭记忆猜路径：

1. `done-coding harness scope list --inbox --json` 列出收 issue 的仓（`name` / `path` / `positioning` / `accepts`）；
2. 按 `name` 匹配用户说的仓；匹配不到或有多个候选 → 列出候选让用户选；
3. 对照目标的 `accepts` 判断这条反馈是否在其受理范围内，不在就告诉用户，不硬提；
4. `done-coding harness issue <name> ...`：传仓名即按注册表寻址，目标 `issueInbox` 为 `null`（不收 issue）时命令直接拒绝。

- 正文文件写**现象 + 复现路径**；`modules` 不要填（接收方分诊时填）。
- 命令会：生成 id → 写 `<目标仓>/docs/governance/issue/<id>-<slug>.md` → 重生目标仓 `ISSUE.md` → 在目标仓**只提交这两个文件**。
- 目标仓 `ISSUE.md` 有未提交改动时拒绝执行（防卷入他人改动）；目标仓未启用 `issue/` 时拒绝。
- issue 是报告不是派单：提完即结束，[MUST NOT] 追问进度；结果看目标仓 `ISSUE.md` / `DROPPED.md`。

## scope — 仓库注册表

注册表在 `~/.done-coding/harness/scope/<转义键>/repo.json`（一仓一目录；转义键 = 仓根绝对路径的非字母数字字符换成 `-`）。字段：`name` / `path` / `positioning` / `accepts` / `governance{dir, tier, issueInbox}`；`issueInbox` 为 `null` = 不收 issue，`governance` 为 `null` = 未建治理目录。寻址只读 `path`，[MUST NOT] 从目录名反推路径。

```bash
done-coding harness scope list [--inbox] [--json]   # 列出登记的仓
done-coding harness scope check                     # 校验：字段 / path 存在 / 目录名与 path 一致 / 收件箱存在 / name 唯一；违规退出码 1
done-coding harness scope register -p "一句话定位" [-a "受理范围"] [-n 仓名] [--tier medium]
                                           # 在仓内执行：登记当前 git 仓（已登记则更新，未给的字段沿用）；收件箱按治理目录下有无 issue/ 推出；撞键拒绝覆盖
```

## 配置（可选）

`<项目根>/.done-coding/harness/governance/config.json`，缺省全走默认：

```json
{
  "governanceDir": "docs/governance",
  "domains": { "file": "MODULES.md", "section": "## 领域模块" },
  "instructions": {
    "budget": { "root": 16384, "nested": 8192, "chain": 32768 },
    "exclude": [".done-coding/generator/assemble/fragments/**", ".claude/skills/**"],
    "gate": false
  }
}
```

- `governanceDir`：治理目录，默认 `docs/governance`；命令行 `--dir` 优先。
- `domains`：领域表来源，默认治理目录下 `MODULES.md` 全文；首列为反引号领域名的表格行才算领域。`section` 只取该标题到下一个 `## ` 之间。
- `instructions`：预算可逐项覆盖，按 UTF-8 字节计；`exclude` 为相对仓根的 Git glob pathspec（`*` 不跨目录、`**` 跨目录，支持 `?` / 字符组），排除内容不计链路；`gate` 默认 false，true 才并入 `check`。独立 `instructions` 始终检查。
