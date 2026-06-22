# 会话收口 — 2026-06-22（gen-modify-marker 实现完成 + assemble 分叉发现）

> /ready:compact 落盘。压缩/新会话从本文件 + [[gen-modify-marker-batch]] memory + tasks.md 恢复锚点读起。

## 一、本会话已完成（全部 commit、未 push、未合 master）

1. **gen-modify-marker 实现**：T1~T7 全交付（subagent-driven TDD + 每任务双验收 + opus 全分支终审 ready-to-merge）。
2. **codex 异构交叉审 + 修复**：codex 挑出 1 Important（`modify --skip-missing` 把损坏 marker 块误当缺失静默跳过）→ 已修（commit 内 `probeMarkerPairing` 三态替换 boolean `probeMarkerBlock`，损坏块在写盘前 fail-loud）。
3. **分批压缩**：把 `4087989` 之后 31 commit 压成按包 8 批（新分支 `feat/cli-generator-batches`，tree 与原 `feat/gen-modify-marker` HEAD `8b1e9ee` 等价）。
4. **命名去冗余**：`done-coding-dir-resolver.ts` → `dir-resolver.ts`（符号 `resolveDoneCodingDir` 等保留，用户选只改文件名），折叠进 utils 批。
5. **新规则**：`.harness/workspace-claude.md` 加「命名去冗余（禁 done-coding 冗余冠名）」节（commit `f50442f`，含例外 + 判据 + 适用范围：只约束新增、存量不回改、无痛透明才改）。

## 二、🔴 重大未决发现：assemble 两线分叉（最高优先，压缩勿丢）

P4a 之后开发分两条线，分叉点 = `eb11c7a`（2026-06-18，安全收尾 spec）：

| | 主线 `feat/gen-modify-marker`(=`cli-generator-batches`) | 侧支 `feat/cli-gen`（9af037d，06-19 停滞） |
|---|---|---|
| 功能 | **最全**：P1~P4a + 安全收尾 + marker===/namespace/modify | P1~P4a + 安全收尾 + **raw-assemble** |
| assemble 配置路径 | 🔴 **旧裸 `<cwd>/assemble/recipes\|fragments`**（recipe.ts:17/21）+ manifest `<cwd>/.assemble/`（vfs.ts:175）— **未命名空间化** | ✅ 收敛到 `.done-coding/generator/assemble/{recipes,fragments,manifests}` |
| 行为 | P4a 初版 | + 默认原样拷（render opt-in）+ 保真守卫 |

- **主线缺**：assemble 配置目录命名空间收敛（应为 `.done-coding/generator/assemble/`，与批次约定 `.done-coding/<type>/` 对齐）+ 原样拷/保真守卫。
- **待回收**：`feat/cli-gen` 的 3 个 commit — `d82b555`(默认原样拷+保真守卫)、`76add84`(配置收敛 `.done-coding/generator/assemble`)、`9af037d`(spec)。
- **整合方向（已定）**：**以主线为基**，把 cli-gen 这 3 commit 的 raw-assemble 摘过来。⚠️ 非平凡：`text-patch.ts`/`recipe.ts`/`types.ts`/`engine.ts`/`vfs.ts` 两边都改、会冲突，需人工裁决。建议单独开整合 spec。
- **[MUST NOT] 删 `feat/cli-gen` worktree**（`.claude/worktrees/cli-gen-raw-assemble`）——它是 raw-assemble 工作的唯一载体。

## 三、其它未决 / 待办

- **B. 配置目录约定未文档化**（harness 缺陷）：「配置需放 `.done-coding/<cli名>/`」这条约定**两个 CLAUDE.md 都没明文写**（只隐含在代码 + R5 回归基准间接出现 `.done-coding/component`）。正是主线 assemble 跑偏到裸 `assemble/` 的根因。建议补进 `done-coding-cli/CLAUDE.md`。
- **C. utils 预存 tsc 错误**：`packages/utils/src/prompts.ts(143,10) TS2352`，非本批引入（prompts.ts/tsconfig 都不在 40879898..HEAD），未修。
- **D. push / 合并**：cli 仓 `feat/cli-generator-batches`（32 commit 未 push、未合 master）；harness `f50442f` 未 push。均需用户明文授权（push 永不豁免）。

## 四、分支 / worktree 全景

| 分支 | HEAD | 角色 |
|---|---|---|
| `feat/cli-generator-batches` ←当前 | `966cc44` | 本会话成品（8 批压缩 + 改名），主线等价 |
| `feat/gen-modify-marker` | `8b1e9ee` | 压缩前原始（15 实现 commit），安全网 |
| `feat/cli-gen` | `9af037d` | raw-assemble 侧支（**不可删**，待回收） |
| `master` | `ce637a1` | = origin/master，本次未合并 |
| worktree `agent-ae53ba88ab8c3f553` | `ce637a1` | 0 独有，= master，**可删** |

## 五、下一步（建议顺序）

1. （可选）删可删的 worktree `agent-ae53ba88ab8c3f553`。
2. **开 assemble 整合任务**（spec）：以主线为基回收 cli-gen raw-assemble 3 commit（配置收敛 `.done-coding/generator/assemble/` + 原样拷 + 保真守卫），解决重叠文件冲突。
3. 补 `done-coding-cli/CLAUDE.md`「配置目录约定（`.done-coding/<cli名>/`）」（走规则更新协议 + 提案确认）。
4. 修 utils `prompts.ts:143` 预存 tsc（独立小改）。
5. 待用户授权后 push / 合并 master / 发布（lerna independent，各包未 bump）。
