---
id: 2skbbw
title: dc-harness check 增加代码归属、跨领域引用、缺口表三项机械检查
modules: [harness]
created: 2026-11-16
source: 用户 2026-11-16 分诊 issue n0ye9s / lixky9 / i5tx0c（出口：当轮做），总协调转达派单；溯源 次级车道 › 混乱收拢到领域模块 › harness 机械闸
after: ""
---

# dc-harness 代码归属、引用边界、缺口表三项检查

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| 分诊：三条 issue 从 `issue/` 移入本批 | 已完成 | ef5b047 |
| n0ye9s 代码归属：领域 paths + 共享骨架表，以 git 跟踪文件为准，无主 / 重叠即违规 | 已完成 | 67f1016 |
| lixky9 跨领域引用：领域之间、壳到领域、测试到领域只经公开入口；名单直接取 MODULES.md | 已完成 | 67f1016 |
| i5tx0c 缺口表核对：定标准（位置 / 列 / 状态 / 文件标注），表与代码双向核对 | 已完成 | 67f1016 |
| 六个真实仓只读验收 + 故意破坏的夹具；包内 README 与 cli-harness skill 同步 | 已完成 | 67f1016（验收结果记于下） |
| 需 template-hub 配合：模板带骨架登记与公开入口约定 | 已投 issue `td39qy`（template-hub a60e394），不分诊 | |
| 刷新 harness 快照与上层摘要；归档本批（只留 PROGRESS.md），`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 收工 | | |

## 边界

- 分支：从 master `8c715a1` 切 `feat/harness-mechanical-gates`；push、合并、发版由用户执行（总协调转达不算发版授权）。
- 只改本仓；六个业务仓只读，验收在 scratchpad 的 `git clone` 副本里跑，不写回。全局 harness-workspace 方法文档不改、不提 issue，需改处见文末，交总协调。
- 共享骨架独占：无（不加新依赖、不动锁文件）。

## 设计与理由

- **自带检查，不生成各仓 lint 配置**：引用闸在工具内扫 import，领域名单、路径、公开入口全部现读 MODULES.md，无名单可漂移；壳与测试的归属由归属闸给出，方向不会漏。各仓手写 eslint / dependency-cruiser 的教训（asset 同名规则整条被覆盖、collect 根配置忽略 `__tests__`、strategy 放行编排方向）正是生成配置会继承的问题。手写配置可保留作编辑器提示，但不再是边界的依据。
- **不准恒绿**：三闸各有数据判定，配置 `gates.<闸>` = auto（缺省，缺数据输出「未启用：缺什么」）/ on（缺数据即失败）/ off（照样列明）；`check --strict` 全按 on。成功行只列执行过的闸。缺省取 auto 而非 on：存量仓升级不因格式未对齐整片变红，但「未启用」逐条打印，且对齐后写 on 防止数据被删后悄悄失效。例外：缺口表标题已存在或代码已有标注而表缺失，直接按有数据处理（数据不一致不算「未启用」）。
- **领域优先**：骨架按容器登记（与各仓正文「X 中领域文件以外的部分」同义），容器内落在领域 paths 的文件归领域；领域之间、骨架件之间重叠才报。
- **只读结构化内容**：领域表按表头列名取 `paths` / `status` / `public`；骨架表首列表头固定 `共享骨架`；缺口表固定标题与列名；标注用固定词 `@done-coding-seam`（中文「接缝」在各仓既用于接缝件本身也用于引用接缝件的地方，机器分不开）。
- 路径模式自写（约 80 行，`**` / `*` / `?` / `[]` / `{a,b}`，命中目录覆盖其下），不引 glob 依赖。

## 缺口表与标注的标准

- 位置：治理目录 `SNAPSHOT.md`，标题 `## done-coding 缺口表`（其后可加说明），取其下第一张表。
- 列：`缺口` · `接缝件` · `issue` · `状态`（按表头名，可另加 `#`、`备注`）。
- 接缝件：只写反引号包裹的仓根相对路径（可 glob、可多个）；没有接缝件写 `无`；位置说明写进缺口或备注列。
- 状态：`等待` / `已可替换` / `已替换`。
- 标注：接缝件文件内写 `@done-coding-seam <issue 标识>：<一句说明>`，建议在文件头注释；只写在接缝件里，引用方不写。
- 核对：等待 / 已可替换行的文件须带标注；带标注的文件须在等待 / 已可替换行；已替换行路径仍须存在、标注应已去掉。issue 列只查非空（各仓 issue 标识形态不一，forge 无收件箱时是记录路径）。

## 六个真实仓只读验收（2026-11-16，各仓 HEAD：analysis ecec45b、agent 1372d27、chat 15ebe74、engine 10458b5、note 892f83b（源仓另有 77 处未提交改动，未计入）、collect 36cb456）

**现状直接跑（auto）**：六仓归属闸、引用闸均「未启用：无共享骨架表」——各仓壳都只写在正文里。缺口表：analysis、engine 标题已是标准写法但列名为「接缝件位置」→ 报缺列，`check` 退 1；agent（`### done-coding 缺口与接缝件`）、chat（`## 缺口表`）、note（`## 缺口表（blueprint 0041）`）标题不合标准、代码无标注 → 未启用；collect 无缺口表 → 未启用。原有四项检查六仓全过。`owners` 显示无主代码文件 36 / 127 / 110 / 61 / 77 / 86，全部是正文里写着的壳与工程配置。

**模拟对齐后再跑**（只在副本里：骨架表按各仓正文转写为容器级行；`public` 机械取各领域已有的 `index.ts` / `public.ts` / `page.route.ts` / 领域包 `__init__.py`；缺口表标题与列名改标准写法；前 5 行带「接缝」的文件插入标注词）：

- 归属闸：analysis、agent、chat、engine、collect 零违规（各仓 paths 写得准）。note 2 条：`customer-access`、`order` 的 status 写「首批不启用」——真问题（格式），应写 `not_implemented（首批不启用）`（chat 的写法）。
- 引用闸·前端：analysis、agent、chat、engine 零违规。note 4 条：壳的手写页面入口 `src/pages/*/page.route.ts`（接缝 S5）直引领域页面组件，领域无公开入口——真问题（缺公开入口）。collect 42 条：扩展外壳 `src/app/*`（含壳测试 `src/app/__tests__`）直引 `modules/collect`、`modules/feedback` 内部（store / task / extractor 等）——真问题，正是 lixky9 所说「壳方向无约束」：其边界测试只管领域之间与领域到壳。
- 引用闸·后端：五仓都大量报（analysis 21、agent 约 45、chat 约 52、engine 126、note 22），两类：ⓐ 服务装配（`main.py`、迁移、服务根测试如 `test_error_response.py`）直引领域内部；ⓑ 领域之间直引内部——engine `operation-execution` → `resource-gateway` / `cost-metering`（src 16 处、tests 47 处），agent `agent-run` → `decision-approval` / `agent-definition`（5 处），chat `conversation` ↔ `knowledge-base` / `answer-feedback`（4 处），note `promo-post` 测试 → `note-draft`（3 处）。判定：规则成立，后端领域从未声明公开入口（0041 只管前端、后端未定）；ⓐ 需各仓把装配要用的文件（router、settings、migrate 等）写进 `public` 或改经包入口，ⓑ 是真实的跨领域耦合，需逐条决定改走公开入口还是声明公开。过渡用 `imports.include: ["frontend/"]` 先只开前端。
- 缺口表：格式对齐项（agent、chat 路径相对应用目录；`接缝件` 格里写了非路径片段如 `/readings/:product`、`label[for]`、`ListLayout`、`formError`；「无接缝」行要写 `无`）。真漂移：chat 表里的 `src/auth/account.ts`（G2）、`src/domains/knowledge-base/format.ts` 文件里没有任何接缝标注；agent 表里的 `notice.ts`、`domains/tool-grant/GrantPanel.vue`（formError 行）、`main.ts`（`/` → `/agents` 行）同样没有标注。模拟产物（非问题）：analysis、engine、note 的 `main.ts` 标注在文件中部，本标准允许，模拟脚本只插了文件头。
- 规则据验收调整：加 `imports.include`（分段启用）。考虑过未改：status 允许任意文本（会让「首批不启用」这类自造状态无法机读）、缺口表列名兼容「接缝件位置」（格里多为相对路径和说明，兼容列名仍过不了，徒增歧义）。

## 存量仓过渡办法

1. 升级 cli-harness 后：原有四项不变；三项新闸为「未启用」。例外：缺口表标题已是 `## done-coding 缺口表` 的仓（analysis、engine）会因列名报错——对齐表格，或临时在配置写 `"gates": { "seams": "off" }`（输出照样列明已关闭）并在 backlog 记一条。
2. 对齐顺序：ⓐ MODULES.md 加共享骨架表（`dc-harness owners --unowned` 列出全部无主文件对照补齐），通过后配置 `gates.ownership: "on"`；ⓑ 领域表加 `public` 列，`imports.include` 先只放前端，后端公开入口定好后去掉 include，再 `on`；ⓒ 缺口表按标准改写、接缝件补标注词，通过后 `on`。
3. 引用闸生效后，各仓手写的边界名单可删可留，留下的不再作为依据。

## 方法文档需跟进处（harness-workspace SKILL.md，交总协调向用户申请）

- §一ⓓ：领域表按表头列名取 `status` / `paths` / `public`；`status` 须以 active / not_implemented / retired 开头（括号内可加说明）；`public` 列写领域公开入口；路径模式语义（无通配 = 文件或目录、命中目录覆盖其下、`*` 即全部）。
- §一ⓕ：「dc-harness 0.1/0.2 不检查 status、paths、归属或重叠」在本批发布后改为：发布后的版本由归属闸检查；仍保留「先核对实际能力」。
- §一「跨模块只走 public API」：公开入口登记在 `public` 列，由引用闸检查领域之间、壳到领域、测试到领域三个方向。
- §四共享骨架：除批次独占外，须在 MODULES.md 首列表头为 `共享骨架` 的表登记（paths，可选 public），按容器登记、领域优先。
- §四元闸：数据驱动闸的启用模式 auto / on / off 与「未启用」输出，作为「检查闸有没有数据」的通用落地。
- 0041 缺口表的位置、列、状态、标注词，若方法文档收录 0041 则同步。

## 进度

- 2026-11-16：分诊提交 ef5b047；实现 + 测试 + 文档 67f1016（harness vitest 66 例全过、`eslint` 零报、`tsc` 只有既有的 `issue.ts` 一处与本批无关、`vite build` 退 0；cli-skills vitest 15 例全过）；本仓 `check` 三项新闸未启用、原四项全过。template-hub issue td39qy 已投。
