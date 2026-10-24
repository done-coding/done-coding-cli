# AI 指令 — done-coding-cli

> 本仓专属规则（Claude Code 与 Codex 共读）；工作区通用规则见工作区根 `CLAUDE.md` / `AGENTS.md`。优先级：本文件 > coding-dna > 工作区。
> 指令文件约定：规则正文只写各目录的 `AGENTS.md`；同级 `CLAUDE.md` 只含一行 `@AGENTS.md`（兼容不读 `AGENTS.md` 的 Claude），[MUST NOT] 往 `CLAUDE.md` 写规则。依赖从 git 仓根启动（子目录启动时上层 `CLAUDE.md` 的引用不展开）。

## 开发流程

[MUST] 开始处理本项目任务前，读取并遵守
`docs/governance/DEVELOPMENT.md`，其中规则适用于整个项目。
路径相对于本 AGENTS.md 所在的项目根目录，不相对于终端当前目录。

领域划分见 `docs/governance/MODULES.md`；维护治理文档时遵守该目录的 `AGENTS.md`。

## 包管理器 / 工作区

- `pnpm`（`preinstall` 锁定 only-allow pnpm）。多包工作区（`packages/*`）+ lerna；各包命令在子包目录下执行，仓根 `pnpm test` 聚合各包单测（`lerna run test`），`pnpm test:hub` 跑 template-hub 跨仓回归。
- 依赖本仓其他包（含 devDependencies）[MUST] 使用发布后为精确版本的 `workspace:` 协议：`workspace:*` 或 `workspace:<精确版本>`；[MUST NOT] 使用 `workspace:^` / `workspace:~` 或直接写范围版本。本仓外的包不受此约束。理由：`done-coding` 每个版本内含的子包组合固定，测过什么即发什么。
- 单测框架统一 **vitest**（对齐 `packages/{create,mcp,cli-skills}`）；新包 [MUST] 沿用 vitest，[MUST NOT] 另引测试框架。

## CLI 调用入口约定（[MUST]）

- 新子包 bin [MUST] 为 `dc-<子命令名>`，与 `done-coding <子命令名>` 一一对应，参数完全一致；create 保留 `create-done-coding` 兼容 `npm create done-coding`，另提供 `dc-create`。
- `done-coding` [MUST NOT] 声明子包 bin，只声明自身入口（`DC` / `dc-cli` / `done-coding`）；全局安装不会把依赖包的 bin 暴露到 PATH，避免与独立安装的子包争用同名 bin。
- skill 调用按 `command -v` 三档判断：`done-coding` → `done-coding <X>`，否则 `dc-<X>`，都没有才 `npx <子包>@latest`；两者同装优先主命令，其使用随该版本钉死的子包副本。`dc-mcp` / `dc-cli-skills` 未挂主命令，不在此对应约定内。
- 多 bin 包（cli-dex / cli-cc-switch）的 npx 调用 [MUST] 显式选 bin：`npx -p <包>@latest <bin> …`。

## 测试 / 单测 / 回归沙盒约束（[MUST]）

WHEN 执行任何包的测试、单测、回归（尤其 cli-generator(gen/assemble) 程序）：

1. **沙盒隔离副作用**：生成的实例 / 产物 / 夹具 [MUST] 落**临时目录**（`os.tmpdir()` 或 git-ignored 的 `sandbox/`），[MUST NOT] 写入真实 `packages/*/src` 或污染工作树；用例结束 [MUST] 清理 scratch（历史教训：create 曾残留 `.done-coding/tmp`）。
2. **命令走 Bash 沙盒模式**：测试 / 回归命令默认在沙盒模式下跑（限制写出范围、无网络）；需联网或越界写时才显式申请豁免，[MUST NOT] 默认关沙盒。
3. **夹具自包含**：fixtures 用临时目录构造，[MUST NOT] 依赖宿主机现存项目状态或全局 `~/.done-coding/`。
4. **回归基准**：
   - gen — cli-component 重打包对旧 `.done-coding/component` 跑 `add/remove/list` 产物**逐字节 diff 为空**（需求 R5）。
   - assemble — **clean regenerate 到临时目录 → 与已提交产物 diff，任意 diff fail**（需求 A5③ 漂移闸）。
   - 两者均在临时目录比对，[MUST NOT] 在工作树原地比对。

## 配置目录布局约定（[MUST]）

各子 cli 的**项目本地配置**统一落项目根的 `.done-coding` 命名空间，按 **cli 名 + 特性**两级分目录：

```
<projectRoot>/.done-coding/<cliName>/<feature>/...
```

- `<cliName>` = 该 cli **自身名称**（`@done-coding/cli-generator` → `generator`）。
- `<feature>` = 该 cli 的特性 / 子命令（generator 的 assemble → `assemble`）。
- **解析 = cwd-only**：调用方 [MUST] 在**项目根**执行；本约定**不向上逐级搜**（区别于 gen 批次层的 `.done-coding/<type>/` 就近向上+全局解析——两层语义不同：批次是"具名可复用能力"，本约定是"项目本地构建配置"）。

**generator/assemble 落点**（权威常量见 `assemble/recipe.ts` recipeDir/fragmentRoot、`assemble/vfs.ts` manifestPath）：

```
<projectRoot>/.done-coding/generator/assemble/
  recipes/*.json5        # 配方
  fragments/...          # 碎片（readFragment 越界基准 = fragmentRoot）
  manifests/<recipeId>.json   # 生成清单（漂移闸基准，入版控）
```

- 本轮（未发布、唯一消费方本地）一次性收敛到此布局，无兼容旧 `assemble/`、`.assemble/` 的双位 fallback。
- gen 批次层（component 等 `.done-coding/<type>/`）**本轮不动**（已发布，另议）。

## 运行时路径安全（[MUST]）

WHEN 写 / 审 cli 仓涉文件系统的代码：

1. **cwd 解析**：涉 cwd [MUST] 经 `safeCwd()` / `resolveHandlerContext`，[MUST NOT] 裸 `process.cwd()`。
2. **删除 / 整体写盘前**：[MUST] `isInside(受控根, 目标)` 且 目标 ≠ 受控根；涉 symlink 可逃逸路径 [MUST] 先 `fs.realpathSync` 双解再比较，[MUST NOT] 无界 rm / 字面前缀放行。
3. **destructive 入口**（`flush` 整目录替换 / `rmdir` 等）：[MUST] 拒可疑根（家目录本体 / 文件系统根）；逃逸 [MUST] 显式 opt-in（`--allow-dangerous` / `allowDangerous`），默认不开。

## I/O 异步约定（前瞻，约束新增代码）

1. server / 库 / 并发可达路径的文件 I/O [MUST] 用 `fs/promises`，[MUST NOT] 新增裸 `*Sync`。
2. 一次性交互 CLI 快路径可 sync。
3. 对齐 coding-dna 的 sync/async 双版本约定；**本约定约束新增代码**，既有 sync 不强制本批迁移。

> **翻转点注脚（什么时候才该考虑把 sync 改 async）**：决策依据是「**并发公民性**」——
> 该进程在一次 IO 进行时是否需要同时干别的——**不是**「资源利用率 / IO 密集度」。
> sync 不是高效、是「够用且简单」；cli-gen 单次操作文件少、亚秒级、且原子性（rename swap +
> 回滚 + 顺序 op）用 sync 写得线性清晰，盲目 async 反增竞态与复杂度。
> 仅当跨过以下任一条线才需要 async（且届时只迁「并发可达路径」，非全链无脑 async）：
> ⓐ MCP server 要并发处理多请求 / 在长操作中响应 cancel·进度·健康探针；
> ⓑ cli-gen **库化被嵌进某个 async 宿主进程** import 调用（sync 会阻塞**宿主**事件循环，不只自己）。
> ⚠️ 「async 化」≠「并发化」：把 `*Sync` 换成串行 `await` 而无真并发 = 纯增复杂度、零收益。
> 当前形态（CLI 一次性 + MCP 单请求串行）未跨任何线 → 全 sync 合规，async 全链迁移继续挂产品化轨。

## 发布

- 发版 = PR 合入 `release` 分支后由 CI（`.github/workflows/release-publish.yml`）执行 lerna publish；PR 合入 master 用 merge commit（[MUST NOT] squash，lerna 按逐条 conventional commit 定版本）。[MUST NOT] 在常规任务中发布；发布需另行单次明文授权（push 永不豁免）。
