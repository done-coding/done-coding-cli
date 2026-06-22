---
title: cli-gen 安全收尾硬化批 — design
date: 2026-06-18
level: Moderate
related: ./requirements.md
status: drafting
---

# 设计 — cli-gen 安全收尾硬化批

## 总原则

纯防御叠加、最小侵入：每处只加 fail-loud 守卫，不改既有数据流/契约。守卫函数尽量纯函数 + 单点注入，便于单测与 codex 审。

## D1 — destructive 入口可疑根守卫（R1）

**落点**：`packages/generator/src/assemble/engine.ts`，新增纯函数 `assertCwdNotSuspiciousRoot(cwd, opts?)`，在 `runPlan`/`runBuild`/`runDiff` 现有 `assertOutputInside` 同处调用（三入口统一）。

```
const SUSPICIOUS = new Set([resolve(homedir()), parse(resolve(cwd)).root])
assertCwdNotSuspiciousRoot(cwd, { allowDangerous }):
  const abs = path.resolve(cwd)
  if (abs === homedir() || abs === path.parse(abs).root)  // 家目录本体 / 盘符根
     → throw `cwd 为可疑根（家目录/文件系统根），assemble 涉整目录替换+删除，拒绝在此运行；如确需请显式 --allow-dangerous`
```

- 判据**只认 cwd 本体 = homedir 或 = 根**，[MUST NOT] 扩到"homedir 子目录"（否则正常的 `~/projects/foo` 被误杀）——精准命中"恰好落在防崩兜底会回落到的那两个危险点"。
- 逃逸通道（R1③）：handler 已有 `allowDangerous`（来自 `resolveHandlerContext`，默认 false）。assemble handler 把 `hctx.allowDangerous` 透传进 `EngineCtx`，engine 守卫 `allowDangerous===true` 时跳过。CLI 侧暴露 `--allow-dangerous`（若 argv 已有同义旗标则复用）。
- **不动 `safeCwd()`**（R1②）：守卫只读 cwd 值判断，共享回落语义零改。

**取舍**：为何不在 `safeCwd` 内拒？因为 `safeCwd` 被 8+ 非 destructive 消费方共享，其契约就是"绝不崩、永远回落出一个可用目录"；在那里 throw 会破坏 `-v`/`-h` 等快路径与其他包。守卫属于 destructive 语义、[MUST] 就近放在 assemble/gen。

## D2 — case-fold 塌路径守卫（R2）

**落点**：`packages/generator/src/assemble/vfs.ts`，`flush` 内 `assertOutputOwnership` 之后、`materialize` 之前，新增纯函数 `assertNoCaseCollision(vfs)`。

```
assertNoCaseCollision(vfs):
  const seen = new Map<string /*folded*/, string /*原键*/>()
  for (const rel of vfs.paths()):
     const folded = rel.toLowerCase()      // case-fold
     if (seen.has(folded) && seen.get(folded) !== rel):
        → throw `大小写塌路径冲突：「${seen.get(folded)}」与「${rel}」在大小写不敏感 FS(macOS/Win) 上塌到同一路径、会静默互覆盖；请重命名其一`
     seen.set(folded, rel)
```

- **FS 无关 + 确定性**（R2②）：纯比 VFS 键，不 stat 磁盘、不问 FS 是否大小写敏感 → CI(Linux) 与本地(macOS) 行为一致，无环境漂移。
- `toLowerCase()` 作 case-fold 近似：覆盖 ASCII + 常见 Unicode 大小写；对极端 Unicode 折叠边角不追求完备（产物路径基本 ASCII，过度工程无收益）。codex 审若指出具体反例再议。
- 调用点在 `flush` 而非 `materialize`：与 `assertOutputOwnership` 并列、throw 前不动 fs，保持"校验全过才落盘"的 flush 既有姿态。
- **段级 vs 全路径**：先按整键 case-fold 比对（最常见 `Foo.json`/`foo.json` 同目录同级）。跨层 `A/b` vs `a/b` 这类不同父不会塌（父目录本身也会各自成键、若父也塌则在父层先命中）——整键比对已覆盖，[MUST NOT] 过度拆段引入误报。

## D3 — removeEmptyInstanceDir 越界守卫（R3）

**落点**：`packages/generator/src/core/instance-dir.ts`。

```
removeEmptyInstanceDir(instanceDir, config, execDir):   // 新增 execDir 形参
  if (!config.removeEmptyDir) return
  if (!isInside(execDir, instanceDir) || resolve(instanceDir) === resolve(execDir)):
     → throw `removeEmptyInstanceDir：instanceDir 越界 execDir 或等于 execDir，拒绝 rmdir：${instanceDir}`
  if (!existsSync) return
  if (readdir empty) rmdirSync
```

- **签名变更**：当前 `(instanceDir, config)` → `(instanceDir, config, execDir)`。`execDir` 已在 `EnvContext.execDir` 可得；调用方（remove handler / batch 流程）[MUST] 同步传入。复用 engine 同款 `isInside`（抽到 utils 或就地复刻，二选一见 D5）。
- 行为对既有 component 用例零变化：component 的 instanceDir 本就 `path.resolve(execDir, rendered)` 落 execDir 内。

## D4 — CLAUDE.md 规则（R4）

`done-coding-cli/CLAUDE.md` 新增两节（追加在「硬规则」或新「运行时约定」节，不改既有编号语义）：

```
## 运行时路径安全（[MUST]）
- 涉 cwd → 经 safeCwd()/resolveHandlerContext，禁裸 process.cwd()
- 删除/整体写盘前 → isInside(受控根) 且 目标≠受控根；禁无界 rm
- destructive 入口（flush/rmdir 等）→ 拒可疑根（homedir 本体/文件系统根）

## I/O 异步约定（前瞻，约束新增代码）
- server/库/并发可达路径文件 I/O → fs/promises；禁新增裸 *Sync
- 一次性交互 CLI 快路径 → 可 sync
- 对齐 coding-dna sync/async 双版本；既有 sync 不强制本批迁移
```

- 措辞可证伪（每条可指认违反点）。与既有「测试沙盒」节正交、不冲突。
- coding-dna 镜像（typescript.md）**可选**，本批默认只写项目 CLAUDE.md（最小面）；codex 若建议镜像再补。

## D5 — isInside 复用（横切）

engine.ts 与 vfs.ts 各有本地 `isInside`，instance-dir 也将需要。**本批不抽公共**（避免为 3 行函数引跨包依赖扰动），instance-dir 就地复刻同款（与 engine 字面一致）。若 codex 强烈建议收敛再议——优先稳定不扩面。

## D6 — docs/ gitignore（R5）

- 先 `git ls-files docs/ | head` 核查 docs/ 下是否有已跟踪文件。
- 若**无**跟踪文件（预期）：`.gitignore` 追加 `docs/`，`git check-ignore docs/` 验证命中。
- 若**有**跟踪文件：[MUST] 停下报用户（可能是他人有意提交的文档），[MUST NOT] 自行 `git rm`——R5② 红线。

## 测试设计（沙盒）

| 用例 | 类型 | 沙盒 |
|---|---|---|
| D1 cwd=homedir → throw；cwd=正常项目 → 通过；--allow-dangerous → 跳过 | 单测 | fake homedir via 注入 / mock；tmpdir |
| D2 VFS 含 Foo.json+foo.json → throw；仅 Foo.json → 通过；大小写同键不误报 | 单测 | 纯内存 VFS，无磁盘 |
| D3 instanceDir 越界(../ 逃逸 / 绝对) → throw；正常子目录空 → rmdir；非空 → 不删 | 单测 | tmpdir execDir |
| 回归 | e2e/golden | 既有 272 + component golden，零回归 |

- 所有 fixtures 落 `os.tmpdir()`，`afterEach` 清理；[MUST NOT] 触真实 `~/.done-coding`。
- D1 的 homedir 注入：守卫读 `homedir()`，测试用依赖注入（守卫接受可选 `homeDir` 形参，缺省 `os.homedir()`）或 vi.spyOn(os,'homedir')，避免污染真实家目录。

## §修订（codex 设计审第一轮，5 条全采纳，2026-06-18）

codex 总评"打回"——D1 漏 gen 入口、D3 漏 symlink realpath 致安全目标未闭环。以下修订**取代**上文 D1/D2/D3 对应处，实现以本节为准。

### 修订-1（采纳 H1）：可疑根守卫覆盖 gen destructive 入口
- 抽公共纯函数 `assertCwdNotSuspiciousRoot(dir, opts?: { allowDangerous?: boolean; homeDir?: string })`，落 **`packages/generator/src/core/safe-root.ts`**（assemble 与 gen 同包共用，不引 utils 跨包扰动）。判据：`resolve(dir)===resolve(homeDir??os.homedir())` 或 `===path.parse(resolve(dir)).root` → throw（除非 allowDangerous）。
- **assemble 侧**：仅在**真正写盘的 destructive 入口** `runBuild` 调用（plan/diff 不改真实 output——diff 只 flush 到 tmp、plan 不 flush，故不守，避免过度阻塞只读用法）。`EngineCtx` 增 `allowDangerous?`；assemble handler 透传 `hctx.allowDangerous`；`dc-gen assemble build` 暴露 `--allow-dangerous`。
- **gen 侧**：在 `removeEmptyInstanceDir` 真正 rmdir 前调用（见修订-3 合并）；`operate` 把 `allowDangerous` 透传进来（OperateArgs 增 `allowDangerous?` 或经 env 传递），remove handler 传 `ctx.allowDangerous`；`dc-gen remove` 暴露 `--allow-dangerous`。

### 修订-2（采纳 M2）：case-fold 检测按 folded **路径前缀**全覆盖
`assertNoCaseCollision(vfs)` 不止比 leaf 整键，[MUST] 把每个键的**所有路径前缀**纳入 folded map：
- `foldedPrefix → 原始 prefix` 映射；任一 folded prefix 命中多个不同原始 prefix → fail-loud（覆盖 `A/x` vs `a/y` 的父目录 `A`/`a` 塌陷）。
- 另检测 folded 后"文件节点是另一节点的祖先"的 **file-vs-dir 折叠冲突**（如 `Foo` 文件 vs `foo/bar`）。
- 报错列出冲突的原始路径对 + 指明大小写/类型塌陷类别。

### 修订-3（采纳 H2 + M1）：removeEmptyInstanceDir realpath 守卫 + 后向兼容签名
签名改为**可选第三参**（不破已导出 API，M1）：
```
removeEmptyInstanceDir(instanceDir, config, opts?: {
  execDir?: string; allowDangerous?: boolean; homeDir?: string;
}):
  if (!config.removeEmptyDir) return
  if (!existsSync(instanceDir)) return
  if (opts?.execDir === undefined)
     → throw `removeEmptyInstanceDir：removeEmptyDir=true 但未提供 execDir（安全硬化迁移：调用方须传 opts.execDir）`
  assertCwdNotSuspiciousRoot(opts.execDir, { allowDangerous: opts.allowDangerous, homeDir: opts.homeDir })  // 修订-1 gen 侧
  // H2：realpath 双解，防 symlink 逃逸
  const realExec = fs.realpathSync(opts.execDir)        // 失败 → 抛，不回落字面放行
  const realInst = fs.realpathSync(instanceDir)
  if (!isInside(realExec, realInst) || realInst === realExec)
     → throw `instanceDir 经 realpath 解析越界 execDir 或等于 execDir，拒绝 rmdir：${realInst}`
  if (readdir(instanceDir) empty) rmdirSync(instanceDir)
```
- **后向兼容**：旧 `(instanceDir, config)` 两参调用，仅当 `removeEmptyDir=true` 才因缺 execDir fail-loud（迁移错误，明确可诊断）；`removeEmptyDir=false`（默认）零影响。
- 内部唯一调用方 `operate.ts:475` [MUST] 改传 `{ execDir: renderedEnv.execDir, allowDangerous, homeDir }`。
- `isInside` 在 instance-dir 就地复刻（与 engine 字面一致，D5 不抽公共）。

### 修订-4（采纳 L1）：补 gen remove 安全用例
测试表新增：
- gen remove（operate rollback + removeEmptyDir=true）：execDir=fake home/root → throw；allowDangerous → 放行；正常子目录空 → rmdir；execDir 内 symlink→外 → realpath 守卫 throw。
- removeEmptyInstanceDir 缺 execDir 且 removeEmptyDir=true → 迁移错误 throw；removeEmptyDir=false 缺 execDir → 静默不删（兼容）。
- fixtures 全落 os.tmpdir() + afterEach 清理；homedir 经 opts.homeDir 注入，[MUST NOT] 触真实家目录。

## 风险与回滚

- 风险：D3 签名变更漏改调用方 → 编译期 TS 报错兜底（强类型保护），低风险。
- 风险：D2 case-fold 误报合法 Linux 用例 → 已知取舍，作可移植性闸，文档说明。
- 回滚：worktree 隔离，整批可弃（ExitWorktree remove）；每处守卫独立 commit，可单点 revert。
