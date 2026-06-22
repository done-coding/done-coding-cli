---
title: cli-gen 安全收尾硬化批 — requirements
date: 2026-06-18
level: Moderate
subproject: done-coding-cli
甲方: 产研统筹（代甲方）
related: ../../../../../docs/specs/2026-06-17-232705-complex-cli-generator-assemble-模板组装能力/RETROSPECTIVE.md
status: drafting
---

# 需求 — cli-gen 安全收尾硬化批

## 背景

cli-generator（`@done-coding/cli-generator`，bin `dc-gen`）P1–P4a 已交付并**已有消费方在用**（component 重打包、MCP server、create 模板源）。P4a 复盘「未决/待办」列出三处已知安全残留（用户已"同意"）+ 两处工程卫生项。本批为**纯防御收尾**：不改既有行为契约、不破坏消费方，只补越界/塌路径的 fail-loud 兜底 + 把运行时安全约束固化进项目 CLAUDE.md。

**范围边界（[MUST NOT] 越界）**：async 全链迁移**不在本批**（挂产品化轨另议）；不重构 P4a 已签收逻辑；不改 5 内建 op 的行为。

## 需求条目

### R1 — destructive 入口可疑根 fail-loud（残留 ⓐ）

`safeCwd()`（`packages/utils/src/safe-cwd.ts`）在 `process.cwd()` 抛错时兜底回落 `homedir()`，这是"**防崩**"语义、非边界校验。assemble 的 `flush` = 整目录替换 + 孤儿删除、gen 的 `removeEmptyInstanceDir` = rmdir，若 cwd 落到 `homedir()` 或文件系统根，destructive 操作会作用在用户家目录/根下的真实目录。

- R1① assemble 引擎入口（plan/build/diff 统一处）[MUST] 在解析出 cwd 后校验其非"可疑根"（= `homedir()` 本身 / 文件系统根 `/` 或盘符根）；命中 → throw fail-loud，提示在具体项目目录内运行。
- R1② [MUST NOT] 修改共享 `safeCwd()` 的回落语义（ai/create/extract/inject/cli-skills/mcp/template 等消费方依赖其"绝不崩"行为）——硬化只在 cli-gen 的 destructive 入口本地施加。
- R1③ 校验 [MUST] 可被显式逃逸通道关闭（如 `allowDangerous` / 显式 opt-in），以免合法的"就在家目录建工程"被误杀；逃逸需显式、默认不开。

### R2 — 大小写不敏感 FS 塌路径 fail-loud（残留 ⓑ）

VFS `normalizeKey` 收敛 `./x` ≡ `x`，但**不收大小写**。在大小写不敏感 FS（macOS/Windows）上，VFS 内 `Foo.json` 与 `foo.json` 是两个不同键、却塌到同一磁盘路径 → `materialize`/flush 时后写静默覆盖先写、丢数据、退出码 0。此为 P4a「target:"." 静默覆盖」同源的残余子面（复盘已记为已知残留）。

- R2① flush（materialize 前或落盘前）[MUST] 检测 VFS 全键集内是否存在"case-fold 后相同、原键不同"的塌路径对；命中 → throw fail-loud，列出冲突键对。
- R2② 检测 [MUST] FS 无关、确定性（不依赖宿主 FS 是否大小写敏感）——即在 case-sensitive Linux 上同样 fail-loud。依据：一个在 macOS/Win 上无法逐字节一致物化的产物即是可移植性缺陷，宁可显式拒绝，对齐 P4a"碰撞不静默覆盖"铁律。
- R2③ 报错信息 [MUST] 指明这是大小写塌路径，并给出可操作建议（重命名其一）。

### R3 — removeEmptyInstanceDir 越界兜底（残留 ⓒ）

`packages/generator/src/core/instance-dir.ts` 的 `removeEmptyInstanceDir` 直接 `fs.rmdirSync(instanceDir)`，未校验 `instanceDir` 仍在 `execDir` 内。`resolveInstanceDir` 用 `path.resolve(execDir, rendered)`，若 `config.instanceDir` 渲染出绝对路径或含 `../` 可逃逸 execDir。

- R3① `removeEmptyInstanceDir` 在 rmdir 前 [MUST] 校验 `isInside(execDir, instanceDir)` 且 `instanceDir !== execDir`；越界 → throw fail-loud。
- R3② 仅作用于 `removeEmptyDir=true` 预设（component）；行为对既有用例零变化（既有 instanceDir 本就落 execDir 内）。

### R4 — 运行时安全约束固化进项目 CLAUDE.md（规则）

把本批落实的两条运行时工程约束写入 `done-coding-cli/CLAUDE.md`，使后续写/审 cli 代码有可证伪的硬规则。

- R4① 新增「运行时路径安全」：涉 cwd [MUST] 经 `safeCwd()`/`resolveHandlerContext`，[MUST NOT] 裸 `process.cwd()`；任何删除/整体写盘前 [MUST] `isInside(受控根)` 且目标 ≠ 受控根，[MUST NOT] 无界 rm；destructive 入口 [MUST] 拒可疑根（homedir/根）。
- R4② 新增「I/O 异步约定」：server/库/并发可达路径的文件 I/O [MUST] 用 `fs/promises`、[MUST NOT] 新增裸 `*Sync`；一次性交互 CLI 快路径可 sync；对齐 coding-dna sync/async 双版本。**本约定为前瞻约束**（约束新增代码），不强制本批迁移既有 sync。
- R4③ 规则写入走「规则更新协议」：先提案块、确认后写（本 RDT 即提案载体，codex 审过 + 用户已同意硬化批即视为确认）。

### R5 — docs/ 卫生（gitignore）

cli 仓 `docs/` 当前未被 `.gitignore` 屏蔽，违工作区 CLAUDE.md「项目 docs/ 为本地 live 文档应屏蔽」。

- R5① cli 仓 `.gitignore` [MUST] 追加 `docs/`（或等效模式），使本地 live spec 不漏进公开仓。
- R5② 若 `docs/` 下已有被 git 跟踪的内容，[MUST] 先核对是否应保留，再决定 untrack；[MUST NOT] 误删他人已提交文档。

## 验收标准（AC）

- AC1：R1/R2/R3 各有 RED→GREEN 单测（沙盒：os.tmpdir + afterEach 清理 + fake home，[MUST NOT] 写真实 src/家目录）。
- AC2：既有 272 测试 + component golden 回归**零回归**（消费方不破）。
- AC3：assemble 覆盖率不低于 P4a 基线（语句 98.78% / 分支 92.61% / 函数 100%）。
- AC4：lint + prettier 通过。
- AC5：RDT 文档 + 最终结果各经 codex 交叉审一轮，本部仲裁、H 级全采纳或显式记残留。
- AC6：CLAUDE.md 新增规则可证伪、与既有规则不冲突；`.gitignore` 生效（`git check-ignore docs/` 命中）。

## 非目标

- async 全链迁移、低代码组装应用层、战略评审——均不在本批。
