# SNAPSHOT — harness

> 文档定位：快照型 · 覆盖更新、只写当前状态。

## 技术快照

- 状态：**已实现** `lists` / `check` / `issue` / `scope`（`packages/harness`，bin `dc-harness`，主 CLI 挂载为 `DC harness`）；版本 0.1.0（2026-10-23 首发）。
- 结构：`src/core/`（`lists` 清单渲染 · `check` 治理闸 · `issue` 跨仓提单 · `scope` 仓库注册表 · `config` 配置解析 · `frontmatter` / `fs-entries` 原语）+ `src/handlers/`（各子命令 cli 边界，退出码落 `process.exitCode`；`scope` 为 `scope list|check|register` 三个动作）。
- **治理清单 / 闸 / issue / scope 的唯一实现**（用户 2026-10-22 定）：harness-workspace skill 只描述规则语义；skill 内仍附带的 `governance-lists.py` 待 dotfiles 侧删除改调本命令，过渡期两者输出逐字节一致（本仓与 `~/.dotfiles/docs/governance` 实测）。frontmatter 用行级正则，刻意不用 YAML 解析器；清单头文案仍写「由 `scripts/governance-lists.py` 重生成」，py 删除时统一改。
- 批次领域集合 = 条目 `modules` ∪ `PROGRESS.md` frontmatter `modules`（`readBatchModules`，清单「所涉领域」与并行闸共用）；`BACKLOG.md` 无「备注」列。
- `check` 并行闸豁免按 skill 批次串：`PROGRESS.md` 的 `after` 链（批次 id = 目录名前缀），同链前驱 / 后继相交不报；after 悬空（schedule ∪ archive 无）/ 分叉 / 成环即违规。
- `check` 仓间唯一差异 = 领域表来源：`<项目根>/.done-coding/harness/governance/config.json` 的 `domains: { file, section? }`，缺省治理目录下 `MODULES.md` 全文；`governanceDir` 缺省 `docs/governance`，`--dir` 优先。
- `issue` 经 `git` 子进程在目标仓只提交 issue 文件 + `ISSUE.md`；目标 `ISSUE.md` 有未提交改动即拒绝。目标可写仓名：已存在目录按路径用，否则查注册表，`issueInbox` 为 null 即拒绝。
- `scope`：注册表 `~/.done-coding/harness/scope/<转义键>/repo.json`（`DC_HARNESS_SCOPE_DIR` 可覆盖）；`check` 校验字段 / path 存在 / 目录名与 path 键一致 / 收件箱存在 / name 唯一；`register` 登记当前 git 仓，收件箱按治理目录下有无 `issue/` 推出，撞键拒绝覆盖。
- 本仓接入：根 `package.json` 的 `gov:lists` / `gov:check` 直跑 `packages/harness/es/`；全新 clone 先 `pnpm -F "@done-coding/cli-harness..." build`。injectInfo 在 vite.config 内经 `generateFile` 生成，不依赖 `dc-inject` bin。
- 测试：vitest 27 例（夹具全在临时目录，issue 用临时 git 仓，scope 用临时注册表）。

## 业务快照

- 取代：本仓 `docs/governance/scripts/gates.py`（已删）；尚未取代：harness-workspace skill 自带的 `governance-lists.py`（`~/.dotfiles` 体系层，已向其收件箱提删除 issue）、template-hub 的 `gates.py`（hub 仓自行切换，需配 `domains` 指向其 `SNAPSHOT.md`「## 领域模块」）。
- 未覆盖：`~/.dotfiles/docs/governance` 的 `MODULES.md` 领域名为加粗写法，`check` 解析不出领域（同上 issue 待其定格式）。
- 注册表现状：随 `~/.done-coding` 纳入 `~/.dotfiles` 版本管理；全局体系登记为 `dotfiles`（`~/.dotfiles`，收件箱 `docs/governance/issue`），由 `dc-harness scope register` 维护。
- 对接 AI 宿主：`cli-skills` 的 `cli-harness` skill（宿主中立；「给 <仓名> 提 issue」→ `scope list --inbox` 匹配 + 对照 `accepts` → `issue <name>`），主路径随插件 `done-coding` 安装（市场目录仓 done-coding-agent-plugins，内容 = npm `@done-coding/cli-skills`），`dc-cli-skills install` 备用；不做 MCP。用户文档见 `packages/harness/README.md`。

## UX 快照

无 UI 面（命令行）。输出逐条 `❌` 违规 / 单行 `✅` 通过。
