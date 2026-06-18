# AI 指令 — done-coding-cli

> 子项目级 CLAUDE.md。仅持有 cli 仓专属规则；工作区通用规则见上层 `done-coding/.harness/CLAUDE.md`，优先级：本文件 > coding-dna > 工作区。

## 包管理器 / 工作区

- `pnpm`（`preinstall` 锁定 only-allow pnpm）。多包工作区（`packages/*`）+ lerna，无根级聚合测试脚本，命令在各子包目录下执行。
- 单测框架统一 **vitest**（对齐 `packages/{create,mcp,cli-skills}`）；新包 [MUST] 沿用 vitest，[MUST NOT] 另引测试框架。

## 测试 / 单测 / 回归沙盒约束（[MUST]）

WHEN 执行任何包的测试、单测、回归（尤其 cli-generator(gen/assemble) 程序）：

1. **沙盒隔离副作用**：生成的实例 / 产物 / 夹具 [MUST] 落**临时目录**（`os.tmpdir()` 或 git-ignored 的 `sandbox/`），[MUST NOT] 写入真实 `packages/*/src` 或污染工作树；用例结束 [MUST] 清理 scratch（历史教训：create 曾残留 `.done-coding/tmp`）。
2. **命令走 Bash 沙盒模式**：测试 / 回归命令默认在沙盒模式下跑（限制写出范围、无网络）；需联网或越界写时才显式申请豁免，[MUST NOT] 默认关沙盒。
3. **夹具自包含**：fixtures 用临时目录构造，[MUST NOT] 依赖宿主机现存项目状态或全局 `~/.done-coding/`。
4. **回归基准**：
   - gen — cli-component 重打包对旧 `.done-coding/component` 跑 `add/remove/list` 产物**逐字节 diff 为空**（需求 R5）。
   - assemble — **clean regenerate 到临时目录 → 与已提交产物 diff，任意 diff fail**（需求 A5③ 漂移闸）。
   - 两者均在临时目录比对，[MUST NOT] 在工作树原地比对。

## 发布

- `pnpm push`（lerna publish）。[MUST NOT] 在常规任务中发布；发布需另行单次明文授权（push 永不豁免）。

## 在途程序

- **cli-generator**（gen 泛化 + assemble 组装）RDT 落地中，spec 见工作区 `docs/specs/2026-06-17-185422-*` 与 `2026-06-17-232705-*`；排期 P1→P2→P3→P4a。
