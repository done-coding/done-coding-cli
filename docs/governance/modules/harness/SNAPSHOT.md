# SNAPSHOT — harness

> 文档定位：快照型 · 覆盖更新、只写当前状态。

## 技术快照

- 状态：**已实现** `lists` / `check` / `owners` / `catalog` / `instructions` / `issue` / `scope`（`packages/harness`，bin `dc-harness`，主 CLI 挂载为 `DC harness`）；当前版本以 `packages/harness/package.json` 与 `cbec4c9` 的 tag 为准。
- 结构：`src/core/`（`lists` 清单渲染 · `instructions` 指令预算与兼容入口 · `check` 治理闸 · `gates` 代码类三闸编排 · `ownership` 归属 · `imports` 引用扫描与边界 · `seams` 缺口表 · `catalog` 能力目录 · `glob` / `md-table` / `git-files` 原语 · `issue` 跨仓提单 · `scope` 仓库注册表 · `config` 配置解析 · `frontmatter` / `fs-entries` 原语）+ `src/handlers/`（各子命令 cli 边界，退出码落 `process.exitCode`；`scope` 为 `scope list|check|register` 三个动作）。
- **治理清单 / 闸 / issue / scope 的唯一实现**（用户 2026-10-22 定）：harness-workspace skill 只描述规则语义；skill 内仍附带的 `governance-lists.py` 待 dotfiles 侧删除改调本命令，过渡期两者输出逐字节一致（本仓与 `~/.dotfiles/docs/governance` 实测）。frontmatter 用行级正则，刻意不用 YAML 解析器；清单头文案仍写「由 `scripts/governance-lists.py` 重生成」，py 删除时统一改。
- 批次领域集合 = 条目 `modules` ∪ `PROGRESS.md` frontmatter `modules`（`readBatchModules`，清单「所涉领域」与并行闸共用）；`BACKLOG.md` 无「备注」列。
- `check` 并行闸豁免按 skill 批次串：`PROGRESS.md` 的 `after` 链（批次 id = 目录名前缀），同链前驱 / 后继相交不报；after 悬空（schedule ∪ archive 无）/ 分叉 / 成环即违规。
- `check` 仓间唯一差异 = 领域表来源：`<项目根>/.done-coding/harness/governance/config.json` 的 `domains: { file, section? }`，缺省治理目录下 `MODULES.md` 全文；`governanceDir` 缺省 `docs/governance`，`--dir` 优先。
- `issue` 经 `git` 子进程在目标仓只提交 issue 文件 + `ISSUE.md`；目标 `ISSUE.md` 有未提交改动即拒绝。目标可写仓名：已存在目录按路径用，否则查注册表，`issueInbox` 为 null 即拒绝。
- `issue` 写入前把 title 与正文中的当前用户家目录（`os.homedir()`，后接 `/` 或字符串结束）替换为 `~`，不改源文件；仅有替换时在 stdout 提示合计处数。
- `scope`：注册表 `~/.done-coding/harness/scope/<转义键>/repo.json`（`DC_HARNESS_SCOPE_DIR` 可覆盖）；`check` 校验字段 / path 存在 / 目录名与 path 键一致 / 收件箱存在 / name 唯一；`register` 登记当前 git 仓，收件箱按治理目录下有无 `issue/` 推出，撞键拒绝覆盖。
- 本仓接入：根 `package.json` 的 `gov:lists` / `gov:check` 直跑 `packages/harness/es/`；全新 clone 先 `pnpm -F "@done-coding/cli-harness..." build`。injectInfo 在 vite.config 内经 `generateFile` 生成，不依赖 `dc-inject` bin。
- `instructions [--json]`：Git 根 cwd-only；Git 跟踪文件的工作树内容，单文件预算 root 16384 B / nested 8192 B，链路 chain 32768 B；兼容入口须为普通文件且首个非空行导入 AGENTS.md。配置 `instructions.budget` / Git glob `exclude` / `gate`（默认 false，true 并入 check）；独立命令无需治理目录。
- 代码类三闸（2skbbw，0.5.0 已发布；0kmyf7 修正与可选规则 0.6.0 已发布）：`check` 在元闸等之后跑归属闸 / 引用闸 / 缺口表闸，配置 `gates.<ownership|imports|seams>` = `auto`（缺省：有数据就跑，缺数据输出「未启用」不失败）/ `on`（缺数据即失败）/ `off`；`check --strict` 全按 on。数据只读表格、配置、标注词：领域表按表头取 `paths` / `status` / `public` 列；首列表头 `共享骨架` 的表登记壳（领域优先，可按容器整块登记）；治理 `SNAPSHOT.md` 的 `## done-coding 缺口表`（列 缺口 / 接缝件 / issue / 状态）与代码里的 `@done-coding-seam` 双向核对；已替换行接缝件随替换删掉写「已删」，标注后的 issue 标识只对上已替换行即报「标注应去掉」，一个文件可承载多个接缝。查的文件 = 跟踪文件 + 未 git add 的新文件（`.gitignore` 忽略的不算，归属闸附注写数量）。有闸失败时末尾汇总「✅ 通过」与「❌ 未通过：<闸>（条数）」。路径模式自写（无通配 = 文件或目录、`**`、`*`、`?`、`{a,b}`、命中目录覆盖其下），不加 glob 依赖。代码文件按扩展名认定，`ownership.exclude` / `extensions` 可调；引用扫描 TS/JS（tsconfig paths、相对 extends）、Vue/Svelte（只扫 `<script>` 块）与 Python（相对导入、src 布局；字符串与注释不算；测试模块找不到时按 pytest 测试基准目录解析），`imports.include` 分段启用。public 条目可加 `骨架:` / `测试:` 前缀限定使用方（测试文件缺省按路径认，`imports.tests` 可替换）；可选 `imports.exportedNames`（缺省关）：跨归属 `from X import name` 须在 `__all__` 内。须在 git 项目根执行。
- `owners [文件…] [--unowned] [--json]`：各归属代码文件数 / 全部无主文件 / 指定文件归属；不要求骨架表已建，供存量仓对齐用。
- `catalog`（ggjh2p，0.5.0 已发布）：能力目录，现取不存清单——npm 官方源按维护者检索（维护者取自本包自身 maintainers，只收同一 GitHub 组织的仓），逐包读 latest；另读注册表里本机仓的工作区包（非 private 或带 publishConfig 的 npm 包 + `packages/` 下的 pyproject）。系列 = 仓；概述取注册表定位，否则取同名聚合包描述；聚合 = dependencies 含 ≥ 2 个同系列包，peer 标「须搭配」。`--installed` 查当前项目（同版本发布的系列装得不一致即提示；npm 未比对时按本包与本机仓的作用域补列），`--check` 在本机落后 npm / 缺描述 / 缺概述 / 清单读取失败或未比对时退 1。取数用全局 fetch（不读 npmrc，`--registry` 可换），网络错误退避重试。
- 测试：vitest 71 例（夹具全在临时目录，issue 用临时 git 仓与注入 / mock 的 home，scope 用临时注册表）。

## 业务快照

- 取代：本仓 `docs/governance/scripts/gates.py`（已删）；尚未取代：harness-workspace skill 自带的 `governance-lists.py`（`~/.dotfiles` 体系层，已向其收件箱提删除 issue）、template-hub 的 `gates.py`（hub 仓自行切换，需配 `domains` 指向其 `SNAPSHOT.md`「## 领域模块」）。
- 未覆盖：`~/.dotfiles/docs/governance` 的 `MODULES.md` 领域名为加粗写法，`check` 解析不出领域（同上 issue 待其定格式）。
- 注册表现状：随 `~/.done-coding` 纳入 `~/.dotfiles` 版本管理；全局体系登记为 `dotfiles`（`~/.dotfiles`，收件箱 `docs/governance/issue`），由 `dc-harness scope register` 维护。
- 对接 AI 宿主：`cli-skills` 的 `done-coding-catalog` skill（何时查、怎么查、查到后装 / 用 / 接缝 / 手写的流程；不带包清单，cli-skills 测试守住）；`cli-harness` skill（宿主中立；「给 <仓名> 提 issue」→ `scope list --inbox` 匹配 + 对照 `accepts` → `issue <name>`），主路径随插件 `done-coding` 安装（市场目录仓 done-coding-agent-plugins，内容 = npm `@done-coding/cli-skills`），`dc-cli-skills install` 备用；不做 MCP。用户文档见 `packages/harness/README.md`。

## UX 快照

无 UI 面（命令行）。输出逐条 `❌` 违规 / 单行 `✅` 通过。
