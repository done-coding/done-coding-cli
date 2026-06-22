# 交接文档 — gen modify + marker `===` + namespace 参数化

> 新会话从本文件 + `tasks.md` 顶部「恢复锚点」读起即可全量衔接。生成于 2026-06-21 收口。

## 0. 一句话

cli-generator 加 `dc-gen modify` 子命令（复用模板原位改 insert 值）+ marker 哨兵加对称 `===` 外壳 + marker namespace 从硬编码改调用方注入。**RDT 三件套已定稿、两轮 codex 交叉审、全 commit；实现尚未开始。**

## 1. 仓 / 分支 / 路径

- 仓：`done-coding-cli`（独立 git 仓）；工作目录 `/Users/supengfei/Documents/code/done-coding/done-coding-cli`。
- 分支：`feat/create-mcp-cli-skills`（沿用上批分支，名与本任务不对版；可选新建 `feat/gen-modify-marker`，从当前 HEAD 切即带上已有 commit）。
- spec：`docs/specs/2026-06-19-gen-modify-marker/{requirements,design,tasks,HANDOFF}.md`。
- 本批 commit 链（最新在上）：`c429b55`(恢复锚点) → `e433a51`(tasks) → `6599026`(F组兼容) → `1200f9f`(design) → `a9996ac`(requirements)。**未 push**。

## 2. 本会话工作大纲（如何走到这一步）

1. 旁支：用 framework-vue3 模板在 `done-coding-forge/packages/` 创建 `plugin-space`（`@done-coding/forge-plugin-space`）——已生成、未提交、残留空 scratch 待清，与本批无关。
2. 用户提议给 generator 加「修改已 insert 值」能力，担心与 replace 重叠。查证后结论：**INSERT 本就幂等可改值**，此仓 `REPLACE` 是「按渲染文件名重命名模板文件」、与改值正交不重叠。
3. brainstorming 钉死 modify 形态：
   - 定位粒度 = **整配方 insert 子集**（`dc-gen modify <type> <name>`，非单块 `--key`）。
   - 入参 = **复用 add 的 `--env`/`--envFile`**（gen 不持久化 env，必须重供）。
   - 缺块 = **默认原子 must-exist + `--skip-missing`（块级）逃生口**。
4. 用户另提两改：marker 加 `===`（防撞 + 易读）、namespace 从 `injectInfo.json` 取（不硬编码）。确认 `--` 破 XML 注释 → 只用 `===`；NS 由调用方注入。
5. 落 requirements.md → **codex 交叉审**（抓出 3 处我的事实错误 + 缺口）→ 折叠。
6. 落 design.md → **codex 二审**（又抓 NS 透传机制、operate 私有函数、standalone 第二入口等硬伤）→ 折叠。
7. 用户追加兼容性约束（F 组）：template/component CLI 调用层无感知、gen 可破坏 → 落 requirements F 组。
8. writing-plans 出 tasks.md（7 任务 TDD 分解）。
9. 收口：恢复锚点 + memory + 全 commit。

## 3. 关键决策（勿翻案，依据在 requirements/design）

| 维度 | 决策 |
|---|---|
| modify 语义 | M1 单块版：复用模板原位改 insert 值、**不记历史**、过滤 **insert-only** 再喂引擎；非 insert op 跳过；零 insert fail-loud |
| 入参 | 复用 add `--env`/`--envFile` 供答管线，不另造 |
| 缺块 | 默认**预检原子 must-exist**（任一缺整体中止、零写盘）；`--skip-missing` **块级**剔除 + 剔后重校 markerKey 冲突 |
| 事务级别 | **预检原子**——不实现写盘中途 IO 失败的快照回滚（与现有 add/operate 同等）。真·写盘原子另立题 |
| marker 格式 | 两端**对称 `===`**（各 3 个）+ 保 `:start:`/`:end:` 冒号结构；**禁 `--`**（破 `<!-- -->` 族 XML 注释） |
| namespace | 4 个 marker 函数加**必填 `markerNs`**（无默认）；导出 `DEFAULT_MARKER_NS="dc-gen"` 仅供显式引用；generator 经 `getMarkerNs()` 从 `injectInfo.bin` 取 `dc-gen`，**单 bin 守卫**；三处注入（operate gen / operate remove / text-patch 5 调用点） |
| 兼容性 | template/component **CLI 调用层无感知**（命令/flag/退出码不变）；gen 程序化 API **可破坏**（唯一消费者是 gen 自己）；marker on-disk 输出字节会变（`===`），靠 **hub 唯一消费方重生成**迁移、无迁移脚本 |

## 4. 关键事实（实现期省查证）

- marker 引擎住在 **`packages/template/src/utils/marker.ts`**（不是 generator）；`buildMarkerLines` 是写入/回退/校验单一来源。
- generator gen 路径 insert 经 **template 的 `batchCompileHandler`** 落地（不是 generator 自己写盘）；remove 路径直调 `computeRollback`。
- **NS 透传机制（codex 修正）**：marker 字段取 `compileTemplate` **第一参 item**，不是 handler options 的 `...rest` → `markerNs` 必须**灌进每个 item**（batch-compile 顶层 option → 分发到 item）。
- **operate 私有函数**（`prepareItem`/`renderGlobalEnvData`/`resolveFormDefaults`/`assertNoMarkerKeyConflict`）handler 够不到 → modify 逻辑**落进 operate `action:"modify"`**，不在 handler 里 reimplement。
- **standalone dc-template 两个 INSERT 入口**都要注入 `DEFAULT_MARKER_NS` 防 fail-loud 回归：① `compile --batch`（`compile.ts:87`）② `dc-template batch` 子命令（`handlers/index.ts:47/50`）。单发 `compile --mode` choices 不含 INSERT、不受影响。
- component 全经 generator（`component/handlers/index.ts` 转调）、inject 不碰 marker；故 component 仅需补 `modify` 包装、inject 无关。
- 既有硬断旧 marker 的测试要改：`template/test/insert.test.ts`、`generator/test/inject.test.ts`、`generator/test/assemble/ops.text-patch.test.ts`。
- R-E6 grep 核空目标是**旧 marker 字面量**（`dc-gen:start`/`dc-gen:end`/`MARKER_NS`），**不是裸 `dc-gen`**（CLI 文案/bin 名合法保留）。

## 5. 下一步

1. （可选）`git checkout -b feat/gen-modify-marker`。
2. 从 **Task 1** 起 subagent-driven TDD，严格顺序 **T1→T2→T3→T4→T5→T6→T7**。
3. **T7 回归基准重生成**：先在临时目录重生成 → 人核 `=== dc-gen:start:` 格式正确 → 再覆盖 golden 基准，[MUST NOT] 工作树原地比对。
4. 全程**不 push**（需另行明文授权）；测试落临时目录沙盒、不污染 `packages/*/src`。

## 6. 风险

- `===` 改格式后所有既有 marker 基准逐字节变 → diff 闸会全红，**必须先重生成基线再锁**（T7 step 2）。
- modify 实现里 `prepareItem` 返回字段名（`output`/`markerKey`/`markerComment`/`strategy`）以实际定义为准，实现期 `grep -n "prepareItem" operate.ts` 核对。
