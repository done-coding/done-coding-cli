# 设计 — gen modify 子命令 + marker `===` 外壳 + namespace 参数化

> 配套需求：`requirements.md`（已经 codex 交叉审折叠）。本文件讲 HOW：函数签名、NS threading 注入点、modify 接入层、逐文件改动清单、测试映射。
> 范围包：`packages/template`（marker 引擎 + compile API）、`packages/generator`（modify + NS 注入）、`packages/component`（modify 透传跟进）。

---

## §1 marker 引擎改造（packages/template/src/utils/marker.ts）

### §1.1 `===` 外壳（R-A1～A4）

`buildMarkerLines` 的 `wrap` 改造（仅此一处，写入/回退/校验全经它）：

```ts
// 现状
const wrap = (body: string): string =>
  `${open} ${MARKER_NS}:${body}:${markerKey} ${close}`.trimEnd();
// 改后（=== 对称外壳 + NS 入参化）
const wrap = (body: string): string =>
  `${open} === ${markerNs}:${body}:${markerKey} === ${close}`.trimEnd();
```

- 两端各 3 个 `=`，`===` 与 token 间各一空格。
- 冒号结构 `:start:`/`:end:` 不变；`computeInsert`/`computeRollback` 的成对匹配、防伪造、`assertMarkerPairing` 全自动取新格式（逐字符一致由单一来源保证）。

### §1.2 namespace 入参化（R-B1/R-B4）

- 删除 `const MARKER_NS = "dc-gen"`，改为 **导出常量** `export const DEFAULT_MARKER_NS = "dc-gen"`（仅供显式引用，[MUST NOT] 作隐式默认兜底）。
- 4 个函数新增**必填** `markerNs: string` 参数（无默认值）：

```ts
buildMarkerLines(comment, markerKey, markerNs)
computeInsert(oldContent, rendered, { comment, markerKey, markerNs, anchor, outputPath, onNotice })
computeRollback(oldContent, { comment, markerKey, markerNs, outputPath })
validateMarkerKey(markerKey, comment, outputPath, markerNs)   // ${markerNs}: 保留前缀防伪造校验取入参
```

- `resolveMarkerComment` 不涉 NS，签名不变。

### §1.3 导出纯 probe helper（codex 缺口补，供 modify 预检）

新增并导出 `probeMarkerBlock(content, { comment, markerKey, markerNs }): boolean`——只判该 markerKey 的成对块是否存在（复用 `assertMarkerPairing` 内部 0/1 判定，返回 `pairing === 1`），**不抛「回退未命中」、不返回删除后内容、不读模板**。modify 预检用它，避免依赖 `computeRollback` 的 rollback 语义文案与副作用。`assertMarkerPairing` 当前未导出——本 helper 作为其受控出口（或一并导出 helper，不直接导出 assert 内部）。

---

## §2 template compile API 透传（packages/template/src/{types,utils/compile-common,handlers/batch-compile}）

### §2.1 类型（types/index.ts）

`CompilePublicConfig` 新增 **可选** `markerNs?: string`（INSERT 专用，与 `markerKey`/`anchor` 同组）。

> 为何类型层可选、运行时必填：`CompilePublicConfig` 被所有 mode 共用，强制全量必填会逼非 insert 调用方传无关字段。改为「类型可选 + INSERT 路径运行时 fail-loud」既满足 R-B4「不静默兜底」，又不污染 overwrite/append 等无关路径。

### §2.2 compile-common.ts（INSERT/rollback 两分支，line 73-89 / 244-256）

两处调 marker 函数前，从 options 取 `markerNs`，**缺失即 fail-loud**：

```ts
// INSERT 分支 & rollback 分支均加：
if (!markerNs) throw new Error(`INSERT/回退需注入 markerNs（调用方未提供，禁默认兜底）：${outputPath}`);
// 再传入 validateMarkerKey / computeInsert / computeRollback
```

### §2.3 batch-compile.ts（NS 透传机制——codex 修正：必须落到每个 item）

> **codex 高危修正**：marker 字段不是从 handler options 的 `...rest` 流到 `compileTemplate` 的——`compileTemplate(item, { rootDir, rollback })` 的 marker 字段取**第一参 item**（`batch-compile.ts:199/224`，`compile-common.ts:31/41`）。第二参只给 `rootDir/rollback`。故 `markerNs` 加到 handler 顶层 options 而不落 item 会**失效**。

- 设计：`CompileBatchHandlerOptions` 新增顶层 `markerNs?: string`；`batchCompileHandler` 把 list→items 映射时，**把 `markerNs` 灌入每个 item**（与 item 自带 markerKey/anchor 并列）。这样 operate / standalone 只需在顶层传一次 `markerNs`，item 自动继承。
- `compile-common.ts` 的 INSERT/rollback 分支从 item 读 `markerNs`，缺失 fail-loud（§2.2）。

### §2.4 standalone dc-template 批量 INSERT 防回归（codex 修正：覆盖两个入口）

`dc-template compile` 单发 `--mode` choices 不含 INSERT（`compile.ts:43-54`），单发够不到 INSERT、不受影响。但**两个**批量入口可含 `mode:insert` → R-B4 必填 NS 下会 fail-loud：
1. `compile.ts` 的 `--batch` 分支调 `batchHandler(publicConfig)`（`compile.ts:87`）；
2. **`dc-template batch` 子命令**直接走 `batchCompileHandler(argv)`（`template/src/handlers/index.ts:47/50`）。

- **修复**：**两个入口都**显式注入 `markerNs: DEFAULT_MARKER_NS`（= `dc-gen`，**显式注入、非静默兜底**，仍守 R-B4）。保 standalone 批量 INSERT 可用、NS 值不变（仅 `===` 外壳变，随 hub 重生成迁移）。
- [MUST NOT] 在此用 template 自己 bin（`dc-template`）作 NS——会把 standalone INSERT 的 namespace 从 `dc-gen` 改成 `dc-template`，平添 on-disk 迁移面。统一锁 `DEFAULT_MARKER_NS`。
- 测试：standalone `dc-template compile --batch` 与 `dc-template batch`（均含 insert 项）→ 不 fail-loud、产出 `=== dc-gen:start:… ===`。

---

## §3 generator NS 注入（packages/generator）

### §3.1 NS 取值（R-B3/B3a/B5）

新增 `src/core/marker-ns.ts`：

```ts
import injectInfo from "@/injectInfo.json";
/** 从本包 injectInfo.bin 取 marker namespace；要求单 bin，多 bin fail-loud（R-B3a） */
export const getMarkerNs = (): string => {
  const bins = Object.keys(injectInfo.bin ?? {});
  if (bins.length !== 1) throw new Error(`marker NS 取值要求本包单 bin，实得 ${bins.length}：${bins.join(",")}`);
  return bins[0]; // "dc-gen"
};
```

### §3.2 注入点（R-B3，codex 修正落点）

- **operate.ts gen 路径**：调 `batchCompileHandler({ rootDir, rollback, extraEnvData, collectEnvData, markerNs: getMarkerNs() }, { list })`——`markerNs` 走 §2.3 的顶层 option，由 batch handler 灌入每个 item（[MUST NOT] 只加到不落 item 的位置，`operate.ts:447/458`）。
- **operate.ts remove 路径**：直调 `computeRollback(...)` 处补 `markerNs: getMarkerNs()`。
- **assemble/ops/text-patch.ts（5 个调用点，codex 校正）**：`hasExistingBlock` 内 `validateMarkerKey`（:72）、`buildMarkerLines`、`computeInsert`（:88）、`computeRollback`（:101）均补 `markerNs: getMarkerNs()`。注意 `computeInsert` 当前未先 validate `conflictKeyOf(op)`——改签名时**两处 key 校验的 NS 口径须一致**（同取 `getMarkerNs()`）。

---

## §4 modify 子命令（packages/generator）

### §4.1 命令注册（R-C1）

- 新增 `src/handlers/modify.ts`，导出 `modifyHandler: GeneratorHandler`。
- `src/main.ts`/命令树：注册 `dc-gen modify <type> <name>`，选项 `--env` / `--envFile` / `--skip-missing`，与 add 同级。
- `src/index.ts` 导出 `modifyHandler`（供 component 包 import）。

### §4.2 接入层（codex 修正：modify 逻辑落 operate，非 handler）

> **codex 中危修正**：`prepareItem`/`renderGlobalEnvData`/`resolveFormDefaults`/`assertNoMarkerKeyConflict` 均为 `operate.ts` **私有函数**（`operate.ts:82/158/237/411`），handler 够不到、无法「prepare 后过滤」。故 modify 的过滤/预检 [MUST] **落进 operate**，handler 只做供答 + 调 operate。

**operate 扩展 `action:"modify"`**（与 add/remove 并列），在其内部既有预渲染/冲突校验**之后**插入：

1. **过滤 insert 子集**（R-C3/C4）：保留 `resolveStrategy(entry).mode === INSERT` 的 prepared item，其余（overwrite/append/replace/return）剔除、计数。
2. **零 insert fail-loud**（R-D3）：过滤后空 → `throw "该批次无 insert，modify 无意义"`。
3. **重跑同文件同 markerKey 冲突校验**（R-D2/D5，codex 补）：在过滤（及 `--skip-missing` 剔除）后的子集上**重新跑** `assertNoMarkerKeyConflict`，保留同文件 item 原序——防剔除掩盖剩余项冲突或乱诊断序。
4. **预检 must-exist**（R-D1/D4）：对每个 insert item，用 §1.3 导出的纯 probe helper `probeMarkerBlock(content,{comment,markerKey,markerNs})` 探「成对存在/缺失」（dry-run、不读模板、不写盘、不抛 rollback 文案），得清单。
   - 默认：任一缺失 → 整体中止、零写盘、报缺失清单（file + markerKey）。
   - `--skip-missing`（R-D2 块级）：剔除缺失 item、仅存在 item 继续（剔除后回到第 3 步重校冲突）；结束报告跳过项。
5. **落盘**：过滤+预检通过的 insert item 子集走 `computeInsert` pairing===1 原位替换，注入 `markerNs`。
6. **notice**（R-C4）：输出跳过的非 insert op 数 + （若 --skip-missing）跳过的缺失块清单。

handler（`handlers/modify.ts`）：复刻 add 骨架（`resolveHandlerContext`→`ensureArgs`→`discoverBatch`→`ensureNameLegal`→`createEnvContext`→`resolveEnvSupply`→`collectInteractiveAnswers`）→ `operate({ action:"modify", skipMissing })`。

> **事务级别（R-D1）= 预检原子**：预检在落盘前一次性判全，缺则不写；**不**实现写盘中途 IO 失败的快照回滚（与现有 add/operate 同等保证）。真·写盘原子另立题。

### §4.3 复用 vs 新增的边界

- **复用**：供答管线（resolveEnvSupply/级联/builtins）、discoverBatch、operate 既有预渲染/strategy 解析/冲突校验。
- **新增**：operate `action:"modify"` 分支（过滤+预检+skip-missing）、marker probe helper（§1.3）、modify handler/注册、component 透传。
- **[MUST NOT]**：把全量 files 交引擎（会落 overwrite/append）；另造供答管线；写盘快照回滚；在 handler 里 reimplement operate 私有 prepare。

---

## §5 component 包跟进（packages/component，R-C1）

`src/handlers/index.ts` 现显式包装 add/remove/list/init。补：

```ts
import { modifyHandler } from "@done-coding/cli-generator";
export const modify = (argv, ctxInit) => modifyHandler(withBatchType(argv), ctxInit);
```

并在 `commandCliInfo` 的 subcommand 列表注册 `modify`（`dc-component modify <name>` ≡ `dc-gen component modify <name>`）。
> NS 注入仍由 generator 内 `getMarkerNs()` 统一取 generator 自己的 bin `dc-gen`——component 透传不改变 NS（跨工具一致，符合既有"特化壳"语义）。

---

## §6 逐文件改动清单

| 文件 | 改动 |
|---|---|
| `template/src/utils/marker.ts` | `===` 外壳；删 `MARKER_NS` 常量、导出 `DEFAULT_MARKER_NS`；4 函数加必填 `markerNs` |
| `template/src/types/index.ts` | `CompilePublicConfig` 加 `markerNs?`；同步注释里 `dc-gen` 样例（R-B5） |
| `template/src/utils/compile-common.ts` | INSERT/rollback 分支取 `markerNs`、缺失 fail-loud、透传 |
| `template/src/handlers/batch-compile.ts` | 确认 `markerNs` 经 `...rest` 透传 |
| `template/src/handlers/compile.ts` | standalone `--batch` 入口注入 `markerNs: DEFAULT_MARKER_NS`（§2.4 防回归） |
| `template/src/handlers/index.ts` | `dc-template batch` 子命令入口注入 `markerNs: DEFAULT_MARKER_NS`（§2.4 第二入口） |
| `generator/src/core/marker-ns.ts` | 新增 `getMarkerNs()`（单 bin 守卫） |
| `generator/src/core/operate.ts` | gen 路径 + remove 路径注入 `markerNs`；新增 `action:"modify"` 分支（过滤 insert 子集 + 零 insert 守卫 + 预检 must-exist + skip-missing + 重校冲突，§4.2） |
| `generator/src/assemble/ops/text-patch.ts` | 4 处 marker 调用注入 `markerNs` |
| `generator/src/handlers/modify.ts` | 新增 modify handler |
| `generator/src/main.ts` | 注册 `modify` 命令 + 选项 |
| `generator/src/index.ts` | 导出 `modifyHandler` |
| `generator/src/types/index.ts` | 注释 `dc-gen` 样例同步（R-B5）；如需 modify 专属类型在此加 |
| `generator/src/presets/init-skeleton.ts` | skeleton 文案 `dc-gen` 样例同步（R-B5） |
| `component/src/handlers/index.ts` | 包装 + 注册 modify |

---

## §7 测试映射（R-E1～E6，vitest + 沙盒临时目录）

| 需求 | 测试点 |
|---|---|
| R-A1～A4 | marker `===` 新格式逐字符断言（各注释族）；**更新所有硬断旧 marker 的既有用例**（codex 补：`template/test/insert.test.ts:87`、`generator/test/inject.test.ts:84`、`generator/test/assemble/ops.text-patch.test.ts:61`，及 component byte-identical golden 若链路含 marker 需重生成） |
| R-D4 | `probeMarkerBlock` 纯探测：成对存在→true、缺失/不成对→false，不抛、不写、不读模板 |
| R-B1/B4 | marker 函数必填 `markerNs`：传入产出正确文本；compile INSERT 路径缺 `markerNs` → fail-loud |
| R-B3a | `getMarkerNs()` 单 bin 通过 / 多 bin fail-loud |
| R-C3/C4 | modify 只改 insert 块；含 overwrite/append 的配方 → 那些文件不被 modify 触碰；notice 报跳过数 |
| R-D1 | 缺一块 → 整体中止、零写盘、报缺失清单 |
| R-D2 | `--skip-missing` 块级：同文件缺块跳过、存在块照改、报告跳过项 |
| R-D3 | 零 insert 配方 → fail-loud |
| R-D5 | 同文件同 markerKey 非唯一成对 → fail-loud（沿用 assertMarkerPairing） |
| R-E5 | gen 重打包逐字节 diff（受 `===` 影响的基准同步重生成）；assemble clean regenerate 临时目录 diff 闸 |
| R-E6 | grep **旧 marker 字面量/硬编码 NS 拼装**核空（codex 校正：裸 `dc-gen` 不能核空——大量 CLI 文案/命令名/bin 合法保留）。目标串：`dc-gen:start`、`dc-gen:end`、`MARKER_NS`、注释里 `dc-gen:` 防伪造样例（`template/src/types/index.ts:101`、`generator/src/types/index.ts:102`、`generator/src/presets/init-skeleton.ts:25`、`marker.ts:19`） |

---

## §8 风险与未决

- **R-E5 回归基准漂移**：`===` 改格式后，所有既有 marker 基准产物逐字节会变；需**重生成基准**再设为新基线，否则 diff 闸全红。实施时先重生成、人核一遍格式正确，再锁基线。
- **跨工具 NS 一致性**：本批 NS 实际值处处仍 `dc-gen`（generator bin），inject/template standalone 若未来直连 compile 用 INSERT，需各自显式注入 NS（缺则 fail-loud，不会静默错配）——已由 R-B4 保证。
- **component 透传 NS**：`dc-component modify` 经 generator handler，NS 取 generator bin `dc-gen`（非 `dc-component`），与既有 add/remove 行为一致，符合特化壳语义。
