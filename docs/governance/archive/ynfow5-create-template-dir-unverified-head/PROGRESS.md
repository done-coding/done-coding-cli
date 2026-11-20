---
id: ynfow5
title: create 本地模板仓离线时默认分支按模板目录回落，缺目录报错点名分支
modules: [create]
created: 2026-11-20
source: 总协调 2026-11-20 派单（business-code-studio 走查：注册表模板不写 branch，0.24.2 不传 -b 报「模板目录不存在」）；与 g4p7sa（issue 856xd7）同源，补其离线缺口
after: g4p7sa
---

# create 本地模板仓离线时默认分支按模板目录回落，缺目录报错点名分支

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| 定位根因 | 已完成 | 记于下 |
| 修复：远端 HEAD 未能核实时按模板目录挑候选；模板目录缺失时报错点名 ref；本地默认分支领先远端时告警 | 已完成 | 96c3803 |
| 回归修正：缺目录判定挪回检出后、沿用改动前的 existsSync，挑候选认符号链接 | 已完成 | e04e298 |
| 评审缺陷：符号链接模板复制出指向临时检出目录的悬空链接（改动前即存在） | 已完成 | e7d7235 |
| 评审追问：编译阶段经模板里的链接或路径读写到项目目录之外（改动前即存在） | 已完成 | 1db8fad |
| 补齐：create 编译前读模板配置（预设问题 / 使用步骤 / secret key）同样判定 | 已完成 | 2c8ee13 |
| generator 批次：输出 / 模板输入越界判定解开符号链接（总协调定方案 ①） | 已完成 | ee0fded |
| generator tree / assemble：落地、碎片读取、base 来源越界判定解开符号链接 | 已完成 | 本提交 |
| 测试：离线 + 过期 origin/HEAD、默认分支缺目录报错、本地未推送告警 | 已完成 | 96c3803 |
| 刷新 create 快照与 create-done-coding skill；归档本批，`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 收工 | | |

## 边界

- 分支：与 g4p7sa 同一缺口，接在 g4p7sa 的 `fix/create-stale-origin-head` 上（该分支从 master `faea516` 切出；不叠分支）；push、合并、发版由用户执行（总协调转达不算发版授权）。
- 只改本仓；template-hub、business-code-studio 只读。
- 默认取远端默认分支、不取当前检出的设计（zsz54k，用户定）不变。

## 根因

- 复现：本机 template-hub 的 `refs/remotes/origin/HEAD` 指向 2026-06 的 `origin/feat/raw-prep`（无 `templates/apps/`）；`git fetch` / `ls-remote` 因 SSH agent 拒签失败（studio 子进程同样无交互凭据）。g4p7sa 只在联网时改按远端实际 HEAD 取，离线仍回落这个过期指针，于是检出旧分支、报「模板目录不存在」（报的是临时目录路径，看不出取了哪个分支）。
- 另见：template-hub 本地 master 领先 `origin/master` 148 个提交、模板目录差 367 个文件，`admin-app-vue3-standalone` 只在本地 master 有。按设计不传 `-b` 取远端，本地未推送的模板改动不会用到，此前无任何提示。

## 改法

- 远端 HEAD 经 `ls-remote` 核实时以它为准（不变）；未能核实时，候选（本地 `origin/HEAD` → `origin/master` → `origin/main` → 本地 `master` / `main`）中取第一个含模板目录的，跳过首选时告警并提示 `git remote set-head origin -a` / `-b`。
- 检出后模板目录不存在时（判定仍是检出目录上的 `existsSync`，与改动前同一条件）报错点名 ref，本地 master / main 有该目录时直接给出 `-b <分支>`。
- 回归修正（2026-11-20 复核）：96c3803 原在检出前用 `git cat-file` 判定且只认目录，会把两种原本可用的情况误判为缺失——大小写不敏感文件系统上 directory 大小写与仓内不一致、模板目录是仓内符号链接（96c3803 报错；0.24.2 并非可用，见下条评审缺陷，e04e298 提交说明此处有误）。已挪回检出后按原条件判定，按目录挑候选时任意对象类型都算存在；补 2 例，换回 96c3803 均失败。
- 评审缺陷（2026-11-20，总协调评审 e04e298，改动前即存在）：`copyTemplateSourceRoot` 的 `cpSync` 不解链接——模板目录本身是符号链接时，目标处得到指向临时检出目录的绝对路径链接；子树内的相对链接也被 cpSync 改写成指向临时目录的绝对路径。worktree / clone 随即清理，全部悬空。实测 0.24.2：`--list-questions` 照常返回（读不到模板配置，返回空问题）、完整 create 在编译阶段报 `ENOENT … stat …/app`。本地与远程两条路径共用该函数。
  - 修复：顶层按 `realpath` 复制真实文件，解开后越出检出目录即拒绝（模板仓内容不可信，不能借链接把本机目录拷进项目）；子树内链接用 `verbatimSymlinks` 保留原相对文本。
  - 子树链接不跟随的理由：模板里的链接是模板作者有意放的结构（同目录互指等），保留文本后在项目里照样成立；跟随会把目标内容复制成两份、改变项目结构，指向模板之外的链接还会把模板仓外的内容读进项目。指向模板目录之外的相对链接在项目里会悬空，与直接 clone 该模板得到的结果一致。
  - 用例：本地 / 远程（clone）各 1 例断言生成目录是真实目录、文件内容可读、子树链接保留 `content.txt` 文本且可读，本地例另断言返回时临时 worktree 已清理；越界链接拒绝 1 例。换回 e04e298 3 例均失败。
  - 实测（构建产物）：顶层链接模板，0.24.2 完整 create 报 ENOENT 退出 1；新版退出 0，生成真实目录、子树链接 `b.txt -> a.txt` 可读，模板仓 worktree 无残留。
- 默认取到远端跟踪分支、而本地同名分支有未推送提交时告警（行为不变，仍按远端取）。

- 评审追问（2026-11-20，改动前即存在，范围比追问更大）：create 编译阶段经 cli-template `compileTemplate` / `getData` 用 `fs.readFileSync` / `writeFileSync` 处理配置列出的文件，二者都跟随符号链接；且 input / output 由 `path.resolve(rootDir, …)` 得来、无边界判定，不靠链接、直接写 `../`、绝对路径也能越出项目目录（`packages/template/src/utils/compile-common.ts`、`get-data.ts`）。实测改动前构建：模板放 `evil -> <项目外文件>` 并以 replace 列入编译，create 成功并改写了项目外文件。
  - 修复：cli-template 新增受限编译 `confineToRootDir`（`src/utils/confine.ts`）：配置文件、input、output、replace 编译后的文件名在读写 / 建目录前按 realpath 判定（不存在的路径按最近已存在祖先推算，悬空链接按链接文本继续解），越出 rootDir 即拒绝。只认调用方参数，模板配置项写了不生效；缺省不开，`dc template` 与 generator / extract 行为不变。create 两处编译调用开启。
  - 补齐（总协调 2026-11-20 要求，依据 e7d7235「模板内容不可信，不让链接把本机文件读进来」，读也算）：create 编译前读模板配置的三处（预设问题、使用步骤、secret key）统一经 `readTemplateConfig`（`packages/create/src/utils/create-artifacts.ts`），读前用同一判定（cli-template 导出 `assertInsideRootDir`），配置文件解开链接越出项目目录即拒绝。用例 1 例：配置文件链到项目外时 prepare 拒绝且清草稿、secret key 与使用步骤读取均拒绝；改动前 prepare 会读到外部配置并返回其问题。batch 模式的 `env` 文件本就被忽略。
  - 用例：template 9 例（input 链接、output 经 `../` / 绝对路径 / 目录链接 / 悬空链接、replace 文件名越界、项目内链接照常、未开启行为不变、配置文件链接越界与配置项关不掉），换回改动前 7 例失败（另 2 例为「行为不变」对照，两边都过）；create 端到端 1 例，用改动前的 cli-template 构建产物失败（create 成功、未拒绝）。

- generator 批次（总协调 2026-11-20 定方案 ①，改动前即存在）：读代码确认写没有合法越界用法（output 已须字面落在 execDir 内，`packages/generator/src/core/operate.ts` M8），读有（批次模板目录按 cwd → 父目录 → 全局 `~/.done-coding/<type>/` 发现，input 本就在项目外），故不给编译开 `confineToRootDir`，而在 `prepareItem` 字面判定后再用 cli-template 的 `assertInsideRootDir` 解开链接判定：output 须在 execDir 内、input 须在 templateDir（`hit.realDir`）内。`assertInsideRootDir` 改为对象参数并可指定报错里的根称呼（`rootLabel`）。收紧点：templateDir 内指向其外的模板文件链接此前可读，现拒绝。
  - 用例 4 例：经项目内目录链接写出、经悬空链接写出、模板文件链出 templateDir 均拒绝；templateDir 在项目外（模拟全局 / 父目录批次）且含目录内链接时照常生成。换回改动前 3 个越界例失败、正常例通过。generator vitest 414 例全过。

- generator tree / assemble（2026-11-20 核查，改动前即存在）：只按字面路径判定的几处都能经链接逃逸——`recipe.output` 经项目内指向外部的目录链接（flush 在其父目录建临时目录再 rename，产物落到项目外，`src/assemble/engine.ts` outputAbs / `vfs.ts` flush）；落地树里的软链节点（碎片目录 preserve 带入）其下的文件写到落地目录之外（`vfs.ts` materialize）；碎片按内容读取（`symlinkPolicy: "deref"`、textPatch / jsonMerge 等经 `readFragment`）时链到外部文件被读进产物（`render.ts`）；`base.from` 本身是指向外部的链接时整树读入（`engine.ts` buildBaseVfs）。注入点（`inject.ts`）原已 realpath 双解，不改。
  - 修复：四处在字面判定后再用 `assertInsideRootDir` 解开链接判定。碎片读取的边界取 fragmentRoot 下第一段的真实路径：全局层 `~/.done-coding/templates/<模板>` 是指向模板仓的软链（本机即如此分发），整体跟随；模板内再链出模板目录的文件拒绝。收紧点：`deref` 链出所属模板目录的碎片此前可读，现拒绝；preserve 仍原样带链接、不读内容。
  - 用例 5 例：output 经目录链接、落地树软链节点下写入、deref 链出模板目录（模板子目录与碎片根顶层各一）、base.from 链出均拒绝；模板目录本身是指向模板仓的软链时照常生成。换回改动前 4 个越界例失败、正常例通过。generator vitest 419 例全过。
  - 实测：`pnpm test:hub`（本地构建对 template-hub 23 配方 `assemble check --all`）退出 0、全部无漂移；三个用全局软链模块模板的业务仓（chat-studio / agent-studio / code-studio）`tree check --all` 新旧版本输出与退出码完全一致（前两仓各有 1 处既有漂移，与本次无关）。

## 验证（2026-11-20）

- 新增 3 例：换回改动前代码 3 例均失败；补齐后 template 49 例、create 60 例、mcp 28 例全过；eslint、tsc、prettier 无报错，template / create / mcp build 通过（heavy-lock）。
- 实测（本机 template-hub，fetch 失败、`origin/HEAD` 仍指 `feat/raw-prep`）：全局 0.24.2 对 `admin-app-vue3-member` 报「模板目录不存在」；本分支构建取 `origin/master`（8edf826）并告警跳过旧分支、本地 master 领先 148 个提交；`admin-app-vue3-standalone` 取本地 master（e98ad52）；`-b origin/main` 取不存在的目录报错点名 `origin/main` 并提示 `-b master`。template-hub 的 `origin/HEAD`、worktree 与临时分支数未变。实测在本机实例注册表留下的条目已删除。

## 留给别处

- 要在本机生效需发版（create 与主包 done-coding），由用户确认。
- business-code-studio：修复后不配 `STUDIO_TEMPLATE_BRANCH` 也能取到模板，但取的是 `origin/master`（比本地 master 旧 148 个提交）；要用本地最新模板仍需 `-b master`（现有 `.env` 配置保留），或由 template-hub 推送 master。
