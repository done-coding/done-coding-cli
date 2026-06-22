# 需求清单 — gen modify 子命令 + marker `===` 外壳 + namespace 参数化

> 范围：`packages/template`（marker 引擎 + compile API 透传）、`packages/generator`（modify 子命令 + NS 注入）。
> 唯一消费方：兄弟仓 done-coding-template-hub，格式变更经重生成迁移。
> 阶段：本文件为**需求**（WHAT，可逐条验收），非设计（HOW）。

## 背景事实（已查证，作为约束）

- marker 引擎在 `packages/template/src/utils/marker.ts`，`MARKER_NS = "dc-gen"` 当前硬编码（`marker.ts:19`）。
- 现有 marker 文本：`<open> dc-gen:start:<markerKey> <close>` / `...:end:...`（`buildMarkerLines` 单一来源，`marker.ts:109-117`）；写入与回退共用它、逐字符一致；回退只认两条 marker 行，免疫块内手改。
- INSERT 幂等：同 markerKey 块已存在 → `computeInsert` 原位 splice 替换、忽略 anchor（`marker.ts:287-293`）。
- marker 纯函数有两组消费者：① template `compile-common.ts`（gen/inject/component 走 INSERT mode 都经它）；② generator `assemble/ops/text-patch.ts`（assemble textPatch）。
- generator gen 路径 `core/operate.ts`：insert 交 template `batchCompileHandler` 内部完成；remove 路径直接调 `computeRollback`。
- 现有 gen 动词：add / remove / list / init / assemble；`dc-component <verb>` ≡ `dc-gen <verb> component`（特化壳）。
- gen **不持久化** add 时的 env（无 lock/manifest），故 modify 必须重新供 env。
- markerKey 缺省 = `${批次类型}:${name}`；同文件多 insert 须各异 markerKey（`assertMarkerPairing` 唯一成对校验）。

---

## A 组 — marker `===` 外壳

- **R-A1** `buildMarkerLines` 输出格式改为两端对称包裹 `=== `：`<open> === <NS>:start:<markerKey> === <close>`，尾部经 `trimEnd`。`=` 个数 = 两端各 3 个。
  - TS/JS/Go（`//`）：`// === dc-gen:start:foo ===`
  - CSS/Less（`/* */`）：`/* === dc-gen:start:foo === */`
  - Vue/HTML/XML/SVG/MD（`<!-- -->`）：`<!-- === dc-gen:start:foo === -->`
  - 井号系（`#`）：`# === dc-gen:start:foo ===`
- **R-A2** 保留 `:start:` / `:end:` 冒号结构与词序，不引入 `INSERT`/空格分词句式。
- **R-A3** [MUST NOT] 使用 `--` 作外壳（违反 XML/SGML 注释禁 `--` 规则，会破坏 `<!-- -->` 注释族）。
- **R-A4** 写入（computeInsert）、回退（computeRollback）、块防伪造校验、唯一成对校验全部经 `buildMarkerLines` 取新格式，逐字符一致，无第二处独立拼装 marker 字面量。
- **R-A5** 这是唯一 on-disk 格式变更；不提供旧↔新格式自动迁移代码，由 hub 重生成换新（单消费方约束）。

## B 组 — namespace 参数化

- **R-B1** 移除 marker 引擎对 namespace 字面量的硬编码，将 namespace 作为入参贯通 4 个 marker 函数：`buildMarkerLines` / `computeInsert` / `computeRollback` / `validateMarkerKey`（后者的 `${NS}:` 保留前缀防伪造校验随之取入参 NS）。
- **R-B2** template 的 compile API（`batchCompileHandler` 及 compile 配置项）新增 NS 透传字段，使 `compile-common.ts` 能把 NS 传到 marker 函数。
- **R-B3** NS 由**调用方注入**：generator 在 ① operate（→ batchCompileHandler，gen 路径）② text-patch（assemble 路径）③ operate remove 路径直调 `computeRollback` 处，从**自己的 `injectInfo.json` 的 `bin` 键名**取值 `dc-gen`（小写，不强制大写）。
- **R-B3a** 从 `injectInfo.bin` 取 NS [MUST] 要求**本包单 bin**；多 bin → fail-loud（generator 单 bin 合规；`packages/cli` 多 bin 属反例，不作 NS 源）。
- **R-B4（必填无默认，codex 采纳）** compile API / generator 调用链的 NS 入参**必填无默认**，强制每个调用方显式注入——NS 是跨工具隔离字段，漏传静默 fallback 成 `dc-gen` 会把别工具的块写错命名空间、令后续 remove/modify 命名空间错位，比 fail-fast 更危险。
  - 低层 marker 函数允许导出 `DEFAULT_MARKER_NS = "dc-gen"` 常量供显式引用，但 **compile/generator 调用链 [MUST NOT] 依赖该默认隐式兜底**，必须显式传值。
- **R-B5** NS 取值口径单一：generator 侧只从 `injectInfo.bin` 取，[MUST NOT] 另写字面量 `dc-gen`。旧 `dc-gen` 格式字面量清理范围**含类型注释与 skeleton 文案**（已知点：`template/src/types/index.ts:101`、`generator/src/types/index.ts:102`、`generator/src/presets/init-skeleton.ts:25`），不止运行时代码。

## C 组 — modify 子命令（核心）

- **R-C1** 新增动词：`dc-gen modify <type> <name>`，与 add 同级注册。**`dc-component modify` 不自动透出**——component 包当前显式包装 add/remove/list/init（`component/src/handlers/index.ts`），故本批需在 component 包**显式新增 modify handler 包装 + 命令注册**作为交付项。
- **R-C2** 入参形态复用 add：`--env <JSON>` / `--envFile <path>`，走 add 同一 `resolveEnvSupply` + 级联 + builtins 底座；[MUST NOT] 另造供答管线。
- **R-C3** modify 作用域 = 该实例配方里 **mode 为 insert 的 FileEntry 子集**：按新 env 重渲染 → `computeInsert` 走 pairing===1 原位替换。insert 子集 [MUST] **在 prepare（预渲染/解析）之后过滤得出**，再据此判 R-D3 零 insert。
- **R-C4（实现约束，codex 修正）** "非 insert op 跳过"非引擎免费行为：modify [MUST] 在交引擎前**主动把 FileEntry 列表过滤为 insert-only**，只把该子集喂 `batchCompileHandler`/operate；[MUST NOT] 把全量 items 交引擎（否则 overwrite/append/replace 会照常落盘，`operate.ts:447-469`）。执行完输出一行 notice 说明跳过的非 insert op 数量。
- **R-C5** modify [MUST NOT] 记录/读取旧值（无持久化）；「多个 insert 值修改」＝在 env 里改多个键、单次 modify 全部原位更新。
- **R-C6** markerKey 解析口径与 add 一致（缺省 `${type}:${name}`，可 FileEntry 覆盖）。

## D 组 — modify 错误处理与事务边界

- **R-D1（预检原子 must-exist，codex 修正事务级别）** modify 落盘前**预检**：该实例所有目标 insert 块在各自目标文件中**成对存在**。任一缺失 → 整个 modify 中止、一字不写、报缺失清单（文件 + markerKey）。
  - **事务级别 = 预检原子**：保证"写盘前确认全部块在，缺则整体不写"；**不**实现写盘中途 IO 失败的快照回滚（与现有 add/operate 同等保证——operate 实为 `writeFileSync` 顺序写，无 rename swap/写后回滚，`operate.ts:438-470`/`compile-common.ts:254`）。真·跨文件写盘原子（临时文件快照 + 整体回滚）属 generator 全局事务能力，**另立题、不夹带本批**。
- **R-D2（`--skip-missing` opt-in，块级粒度）** 加 `--skip-missing` 旗标：**块级**跳过——同一文件内缺失的块跳过、存在的块照改（非整文件跳过）；结束报告跳过项清单（文件 + markerKey）。默认不开。
- **R-D3** **过滤后** insert 子集为空（配方无 insert op）→ modify fail-loud（明确报「该批次无 insert，modify 无意义」），[MUST NOT] 静默成功（防全非 insert 配方被误判成功跳过）。
- **R-D4** 预检命中探测复用 marker 现有「两条 marker 行精确匹配」口径（不读模板内容、不依赖渲染），与 rollback 同源。
- **R-D5** 同 markerKey 在同一文件出现非唯一成对 → 沿用 `assertMarkerPairing` fail-loud（不被 modify 绕过）。

## E 组 — 测试 / 回归 / 收尾

- **R-E1** 单测框架 vitest；marker `===` 新格式逐字符断言，更新既有断言用例（`template/test/insert.test.ts` 等）。
- **R-E2** NS 参数化双路单测：显式注入 NS / 走默认 fallback，均产出正确 marker 文本与防伪造校验。
- **R-E3** modify 单测覆盖：原子 must-exist（任一缺失整体中止）、`--skip-missing`、跳过非 insert op、零 insert fail-loud、多 insert 块一次性原位更新、同 markerKey 非唯一成对 fail-loud。
- **R-E4** 沙盒隔离：fixtures/产物落临时目录，[MUST NOT] 写 `packages/*/src` 或污染工作树，用例后清理。
- **R-E5** 回归基准：gen 重打包对旧产物逐字节 diff（受 marker 格式变更影响的基准需同步重生成更新）；assemble clean regenerate 临时目录 diff 闸。
- **R-E6** 全仓 grep `dc-gen` 落硬编码清单，确认无第二处旧格式字面量残留（含 types `.d.ts` 注释样例、文档样例）。
- **R-E7** [MUST NOT] 触发发布（`pnpm push`）；发布另行单次明文授权。

## F 组 — 兼容性约束（用户追加，2026-06-20）

- **R-F1（dc-template CLI 无感知）** `dc-template` 的 **CLI 调用层**（命令 / flag / 退出码 / 成败行为）[MUST] 保持不变，属内部优化。具体：§2.4 在 template 两个 standalone 批量入口**内部**显式注入 `DEFAULT_MARKER_NS`，用户照旧调用、不需新参、不因 R-B4 fail-loud。
- **R-F2（dc-component CLI 无感知 + 功能拓展）** `dc-component` 现有 add/remove/list/init 命令 [MUST] 零改；新增 `dc-component modify` 为纯增量功能拓展。
- **R-F3（dc-gen 可破坏）** gen 包消费者即本体，[MUST NOT] 为兼容历史而加垫片——operate 加 `action:modify`、内部签名变更等可自由破坏，不考虑沉没成本。
- **R-F4（口径边界，用户确认）** "无感知" = **CLI 调用方式不变**；marker 的 **on-disk 输出字节会变**（`===` 外壳对 template/component 产出的 marker 一视同仁，引擎共享），靠 hub 重生成迁移——此为本就要的 `===` 改造、不属"调用层无感知"违背。[MUST NOT] 按调用方分叉 marker 格式。
- **R-F5（程序化导出可破坏，用户确认）** 底层 marker 导出函数（`@done-coding/cli-template` 的 `buildMarkerLines`/`computeInsert` 等）加必填 `markerNs` 属破坏性变更，**允许**——实测唯一程序化消费者是 gen（component 经 gen、inject 不碰、template 自用），R-F1 的"无感知"不延伸到程序化导出零破坏。
