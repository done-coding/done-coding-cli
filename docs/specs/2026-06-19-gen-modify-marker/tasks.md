# gen modify + marker `===` + namespace 参数化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（荐）或 superpowers:executing-plans 逐任务实现。步骤用 `- [ ]` 复选框跟踪。配套 spec：同目录 `requirements.md` / `design.md`。

**Goal:** 给 cli-generator 加 `modify` 子命令（复用模板原位改 insert 值），marker 哨兵加 `===` 对称外壳，marker namespace 从硬编码改为调用方注入。

**Architecture:** marker 引擎（`packages/template`）的 4 个纯函数加必填 `markerNs` 入参并改 `===` 格式；compile API 经顶层 option 把 `markerNs` 灌进每个 item；generator（`packages/generator`）新增 `getMarkerNs()` 从自身 `injectInfo.bin` 取 `dc-gen` 注入三处，并在 `operate` 加 `action:"modify"`（过滤 insert 子集 + 预检 must-exist + skip-missing）。component 显式补 `modify` 包装。

**Tech Stack:** TypeScript（ESM，`@/` 路径别名）、vitest、yargs（经 `@done-coding/cli-utils`）、pnpm workspace + lerna。

## 恢复锚点（新会话从这里读起，2026-06-21 收口）

- **阶段**：RDT 三件套（requirements/design/tasks）**已定稿 + 全 commit**，均经 codex 交叉审。**实现尚未开始**（T1~T7 全部 `- [ ]` 未勾）。
- **下一步**：从 **Task 1** 起按本计划逐任务 TDD 执行。强依赖顺序 **T1→T2→T3→T4→T5→T6→T7**（T7 回归基准重生成必须卡在所有 marker 改动之后）。
- **执行方式**：建议 subagent-driven（每任务 fresh subagent + 任务间 review）；本会话未启动执行。
- **所在仓/分支**：`done-coding-cli`，分支 `feat/create-mcp-cli-skills`（非 master，可直接开工；如要干净分支可新建 `feat/gen-modify-marker`）。
- **关键已决（勿翻案，依据见 requirements F 组 / design）**：
  - modify = M1 单块版：复用模板原位改 insert 值、不记历史、过滤 insert-only 再喂引擎。
  - NS **必填无默认**（`DEFAULT_MARKER_NS` 仅显式引用），generator 从 `injectInfo.bin` 取 `dc-gen`，三处注入。
  - marker 加 **对称 `===`**（两端各 3）、保冒号结构、**禁 `--`**（破 XML）。
  - 事务 = **预检原子**（不做写盘快照回滚）；`--skip-missing` **块级**。
  - 兼容：template/component **CLI 调用层无感知**；gen 程序化 API 可破坏；唯一消费方 hub 重生成迁移。
- **未决/待办**：① 实现全程未动代码；② 本批不 push（需另行明文授权）；③ 旁支任务 plugin-space 已在 `done-coding-forge/packages/` 生成（未提交，残留空 scratch `.done-coding/` 待清，与本批无关）。
- **配套**：`requirements.md`（含 F 组兼容性）、`design.md`（两轮 codex 审折叠，§2.3/§3.2/§4.2 为 codex 修正后版本）。

## Global Constraints

- 单测框架 **vitest**；fixtures/产物落**临时目录**（`os.tmpdir()`），[MUST NOT] 写 `packages/*/src` 或污染工作树，用例后清理。
- marker namespace 实际值处处仍 `dc-gen`（generator bin）；NS 入参**必填无默认**，低层导出 `DEFAULT_MARKER_NS = "dc-gen"` 仅供显式引用，[MUST NOT] 作隐式兜底。
- `===` 两端各 **3 个**，对称；保留 `:start:`/`:end:` 冒号结构；[MUST NOT] 用 `--`（破 XML 注释）。
- dc-template / dc-component 的 **CLI 调用层无感知**（命令/flag/退出码不变）；gen 程序化 API 可破坏。
- 唯一消费方 done-coding-template-hub，`===` 格式变更靠重生成迁移（无迁移脚本）。
- [MUST NOT] 发布（`pnpm push`）。
- 各包命令在该包目录下跑：`cd packages/<pkg> && pnpm vitest run <file>`。

---

## 文件结构（改动落点）

| 文件 | 职责 | 任务 |
|---|---|---|
| `packages/template/src/utils/marker.ts` | `===` 外壳 + NS 入参 + `DEFAULT_MARKER_NS` + `probeMarkerBlock` | T1 |
| `packages/template/test/insert.test.ts` | marker 单测（新格式 + probe + NS） | T1 |
| `packages/template/src/types/index.ts` | `CompilePublicConfig.markerNs?` + 注释样例同步 | T2 |
| `packages/template/src/utils/compile-common.ts` | INSERT/rollback 分支读 `markerNs` + 缺失 fail-loud | T2 |
| `packages/template/src/handlers/batch-compile.ts` | 把 `markerNs` 灌入每个 item | T2 |
| `packages/template/src/handlers/compile.ts` | standalone `--batch` 注入 `DEFAULT_MARKER_NS` | T2 |
| `packages/template/src/handlers/index.ts` | `batch` 子命令注入 `DEFAULT_MARKER_NS` | T2 |
| `packages/template/src/index.ts` | 导出 `DEFAULT_MARKER_NS` / `probeMarkerBlock` | T1/T2 |
| `packages/generator/src/core/marker-ns.ts` | `getMarkerNs()`（单 bin 守卫） | T3 |
| `packages/generator/src/assemble/ops/text-patch.ts` | 5 调用点注入 `markerNs` | T3 |
| `packages/generator/src/core/operate.ts` | gen/remove 注入 `markerNs` + `action:"modify"` | T3/T4 |
| `packages/generator/src/types/index.ts` | `OperateAction` 加 `modify` + `skipMissing` + 注释样例 | T4 |
| `packages/generator/src/handlers/modify.ts` | modify handler | T5 |
| `packages/generator/src/handlers/index.ts` | 导出 + 注册 `modify` 命令 | T5 |
| `packages/component/src/handlers/index.ts` | `modify` 包装 + 注册 | T6 |
| 各 golden / 回归基准 | `===` 后重生成 | T7 |

---

## Task 1: marker 引擎纯函数（`===` 外壳 + NS 入参 + probe helper）

**Files:**
- Modify: `packages/template/src/utils/marker.ts`
- Modify: `packages/template/src/index.ts`
- Test: `packages/template/test/insert.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_MARKER_NS: "dc-gen"`（导出常量）
  - `buildMarkerLines(comment, markerKey, markerNs): { startLine, endLine }`
  - `computeInsert(oldContent, rendered, { comment, markerKey, markerNs, anchor, outputPath, onNotice }): string`
  - `computeRollback(oldContent, { comment, markerKey, markerNs, outputPath }): string`
  - `validateMarkerKey(markerKey, comment, outputPath, markerNs): string`
  - `probeMarkerBlock(content, { comment, markerKey, markerNs }): boolean`

- [ ] **Step 1: 改既有 marker 断言为新格式（先让测试失败）**

在 `packages/template/test/insert.test.ts` 把所有断言里的旧 marker 文本改成新格式，并给所有 marker 调用补第三/末位 `markerNs` 实参。示例（U4 幂等用例）：

```ts
import { DEFAULT_MARKER_NS, buildMarkerLines, computeInsert, computeRollback, probeMarkerBlock } from "@/utils/marker";

const NS = DEFAULT_MARKER_NS; // "dc-gen"
const tsComment = { open: "//", close: "" };

it("buildMarkerLines 产出 === 对称外壳（TS 行注释）", () => {
  const { startLine, endLine } = buildMarkerLines(tsComment, "route:Foo", NS);
  expect(startLine).toBe("// === dc-gen:start:route:Foo ===");
  expect(endLine).toBe("// === dc-gen:end:route:Foo ===");
});

it("HTML 块注释外壳合规（不含 --）", () => {
  const { startLine } = buildMarkerLines({ open: "<!--", close: "-->" }, "k", NS);
  expect(startLine).toBe("<!-- === dc-gen:start:k === -->");
  expect(startLine).not.toContain("--dc");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/template && pnpm vitest run test/insert.test.ts`
Expected: FAIL（旧实现产出无 `===` 的旧格式；`markerNs` 实参 TS 报多余/签名不符）

- [ ] **Step 3: 改 marker.ts —— NS 入参化 + `===` 外壳**

`packages/template/src/utils/marker.ts`：

将 `const MARKER_NS = "dc-gen";`（:19）替换为：

```ts
/** 默认 marker namespace（仅供显式引用，[MUST NOT] 作隐式兜底，见 design R-B4） */
export const DEFAULT_MARKER_NS = "dc-gen";
```

`buildMarkerLines` 改为（:109-117）：

```ts
export const buildMarkerLines = (
  comment: InsertMarkerComment,
  markerKey: string,
  markerNs: string,
): { startLine: string; endLine: string } => {
  const { open, close } = comment;
  const wrap = (body: string): string =>
    `${open} === ${markerNs}:${body}:${markerKey} === ${close}`.trimEnd();
  return { startLine: wrap("start"), endLine: wrap("end") };
};
```

`validateMarkerKey` 第 4 参加 `markerNs`，把 `${MARKER_NS}:` 改 `${markerNs}:`（:133-162）：

```ts
export const validateMarkerKey = (
  markerKey: string | undefined,
  comment: InsertMarkerComment,
  outputPath: string,
  markerNs: string,
): string => {
  // ...前三个校验不变...
  if (markerKey.includes(`${markerNs}:`)) {
    throw new Error(
      `inject markerKey [MUST NOT] 含保留前缀「${markerNs}:」（防伪造哨兵）：${markerKey}`,
    );
  }
  return markerKey;
};
```

`computeInsert` opts 加 `markerNs: string`，内部 `buildMarkerLines(comment, markerKey, markerNs)`（:257-269）。
`computeRollback` opts 加 `markerNs: string`，内部同样传入（:329-334）。
`assertMarkerKey`/`assertMarkerPairing` 内部不变（它们已收 startLine/endLine 由调用方算好）。

- [ ] **Step 4: 加 `probeMarkerBlock` 纯探测（design §1.3）**

在 `marker.ts` 末尾追加：

```ts
/**
 * 纯探测：该 markerKey 的成对块是否存在（pairing===1）。
 * 不抛「回退未命中」、不返回删除内容、不读模板。供 modify 预检（design §1.3 / R-D4）。
 */
export const probeMarkerBlock = (
  content: string,
  opts: { comment: InsertMarkerComment; markerKey: string; markerNs: string },
): boolean => {
  const { comment, markerKey, markerNs } = opts;
  const { startLine, endLine } = buildMarkerLines(comment, markerKey, markerNs);
  const lines = splitLines(content);
  const startCount = countExact(lines, startLine);
  const endCount = countExact(lines, endLine);
  return startCount === 1 && endCount === 1
    && lines.indexOf(endLine) >= lines.indexOf(startLine);
};
```

- [ ] **Step 5: 导出新符号**

`packages/template/src/index.ts` 的 marker re-export 块加 `DEFAULT_MARKER_NS`、`probeMarkerBlock`（与现有 `buildMarkerLines` 等并列，:16-20 附近）。

- [ ] **Step 6: 补 probe 单测**

`packages/template/test/insert.test.ts` 追加：

```ts
it("probeMarkerBlock：成对存在→true，缺失→false", () => {
  const withBlock = "// === dc-gen:start:k ===\nx\n// === dc-gen:end:k ===\n";
  expect(probeMarkerBlock(withBlock, { comment: tsComment, markerKey: "k", markerNs: NS })).toBe(true);
  expect(probeMarkerBlock("no marker here", { comment: tsComment, markerKey: "k", markerNs: NS })).toBe(false);
});
```

- [ ] **Step 7: 跑 marker 测试至通过**

Run: `cd packages/template && pnpm vitest run test/insert.test.ts`
Expected: PASS（全部断言新格式 + probe 通过）

- [ ] **Step 8: Commit**

```bash
git add packages/template/src/utils/marker.ts packages/template/src/index.ts packages/template/test/insert.test.ts
git commit -m "feat(template): marker === 外壳 + namespace 入参化 + probeMarkerBlock"
```

---

## Task 2: template compile API NS 透传 + standalone 防回归（template 包全绿）

**Files:**
- Modify: `packages/template/src/types/index.ts`
- Modify: `packages/template/src/utils/compile-common.ts`
- Modify: `packages/template/src/handlers/batch-compile.ts`
- Modify: `packages/template/src/handlers/compile.ts`
- Modify: `packages/template/src/handlers/index.ts`
- Test: `packages/template/test/`（新增 standalone batch insert 用例）

**Interfaces:**
- Consumes（T1）：`computeInsert/computeRollback/validateMarkerKey(... , markerNs)`、`DEFAULT_MARKER_NS`。
- Produces：`CompilePublicConfig.markerNs?: string`；`batchCompileHandler` 把顶层 `markerNs` 灌入每个 item。

- [ ] **Step 1: 类型加 `markerNs?`**

`packages/template/src/types/index.ts` 的 `CompilePublicConfig`（:71-109）在 `markerComment?` 后加：

```ts
  /** [INSERT 专用] marker namespace（调用方注入，batch handler 灌入每个 item；design R-B1/R-B4） */
  markerNs?: string;
```

同步把该文件内 marker 文本注释样例（:101）改为 `<open> === dc-gen:start:<markerKey> === <close>`（R-B5）。

- [ ] **Step 2: 写失败测试 —— compile-common INSERT 缺 markerNs 应 fail-loud**

`packages/template/test/` 新增 `marker-ns-required.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { compileTemplate } from "@/utils/compile-common";
import os from "node:os"; import fs from "node:fs"; import path from "node:path";

describe("INSERT 路径 markerNs 必填", () => {
  it("缺 markerNs → fail-loud", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-mns-"));
    const target = path.join(dir, "f.ts");
    fs.writeFileSync(target, "// anchor\n");
    await expect(compileTemplate(
      { inputData: "x", output: target, mode: "INSERT" as any,
        anchor: { pattern: "anchor", position: "after" }, markerKey: "k", envData: {} },
      { rootDir: dir },
    )).rejects.toThrow(/markerNs/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: 跑确认失败**

Run: `cd packages/template && pnpm vitest run test/marker-ns-required.test.ts`
Expected: FAIL（当前未校验，INSERT 会用旧硬编码 NS 跑通而非抛错）

- [ ] **Step 4: compile-common 两分支读 markerNs + fail-loud**

`packages/template/src/utils/compile-common.ts` 的 rollback 分支（:73-80）与 INSERT 分支（:244-253），在调 `validateMarkerKey/computeRollback/computeInsert` 前取 `markerNs` 并守卫：

```ts
// 两分支同：从 options 解构 markerNs（与 markerKey/markerComment 同处）
const { markerKey, markerComment, markerNs } = options; // 按本文件既有解构处补 markerNs
if (!markerNs) {
  throw new Error(`INSERT/回退需注入 markerNs（调用方未提供，禁默认兜底）：${outputPath}`);
}
const comment = resolveMarkerComment(outputPath, markerComment);
const key = validateMarkerKey(markerKey, comment, outputPath, markerNs);
// computeRollback(oldContent, { comment, markerKey: key, markerNs, outputPath })
// computeInsert(oldContent, outputContent, { comment, markerKey: key, markerNs, anchor, outputPath, onNotice })
```

- [ ] **Step 5: batch-compile 把 markerNs 灌入每个 item**

`packages/template/src/handlers/batch-compile.ts`：从 handler 第一参取顶层 `markerNs`，在 list→item 映射处给每个 item 注入（item 自带 markerNs 优先，否则用顶层）：

```ts
// handler options 解构处加 markerNs
const { extraEnvData = {}, markerNs: topMarkerNs, ...restOpts } = options;
// 构造每个 compile item 时：
const itemWithNs = { ...item, markerNs: item.markerNs ?? topMarkerNs };
// 用 itemWithNs 调 compileTemplate
```

- [ ] **Step 6: standalone 两入口注入 DEFAULT_MARKER_NS（§2.4）**

`packages/template/src/handlers/compile.ts` 的 `--batch` 分支（:87 `batchHandler(publicConfig)`）改为：

```ts
return batchHandler({ ...publicConfig, markerNs: DEFAULT_MARKER_NS });
```

`packages/template/src/handlers/index.ts` 的 `batch` 子命令 handler（调 `batchCompileHandler(argv)` 处，:47/50 附近）改为在第一参注入 `markerNs: DEFAULT_MARKER_NS`。两处 import `DEFAULT_MARKER_NS`（来自 `@/utils/marker`）。

- [ ] **Step 7: 补 standalone batch insert 不回归用例**

`packages/template/test/marker-ns-required.test.ts` 追加：standalone `compile --batch`（含一个 `mode:insert` 配置项）→ 不抛错、产出 `=== dc-gen:start:` 文本。（用临时目录构造 batch config + 模板文件，断言目标文件含新格式 marker。）

- [ ] **Step 8: 跑 template 全包测试 + 类型检查**

Run: `cd packages/template && pnpm vitest run && pnpm tsc --noEmit`
Expected: PASS（含 T1 用例 + 新 NS 用例；包整体类型通过）

- [ ] **Step 9: Commit**

```bash
git add packages/template/src packages/template/test
git commit -m "feat(template): compile API markerNs 透传(灌 item) + standalone INSERT 防回归"
```

---

## Task 3: generator NS 注入（getMarkerNs + text-patch + operate 现有路径）

**Files:**
- Create: `packages/generator/src/core/marker-ns.ts`
- Modify: `packages/generator/src/assemble/ops/text-patch.ts`
- Modify: `packages/generator/src/core/operate.ts`
- Test: `packages/generator/test/marker-ns.test.ts`、更新 `generator/test/inject.test.ts`、`generator/test/assemble/ops.text-patch.test.ts`

**Interfaces:**
- Consumes（T1/T2）：marker 函数带 `markerNs`；compile 顶层 `markerNs`。
- Produces：`getMarkerNs(): string`（= `"dc-gen"`，单 bin 守卫）。

- [ ] **Step 1: 写 getMarkerNs 测试（失败）**

`packages/generator/test/marker-ns.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { getMarkerNs } from "@/core/marker-ns";

describe("getMarkerNs", () => {
  it("从本包单 bin injectInfo 取 dc-gen", () => {
    expect(getMarkerNs()).toBe("dc-gen");
  });
});
```

- [ ] **Step 2: 跑确认失败**

Run: `cd packages/generator && pnpm vitest run test/marker-ns.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 marker-ns.ts**

`packages/generator/src/core/marker-ns.ts`：

```ts
import injectInfo from "@/injectInfo.json";

/** 从本包 injectInfo.bin 取 marker namespace；单 bin 约束，多 bin fail-loud（design R-B3a）。 */
export const getMarkerNs = (): string => {
  const bins = Object.keys(injectInfo.bin ?? {});
  if (bins.length !== 1) {
    throw new Error(`marker NS 取值要求本包单 bin，实得 ${bins.length}：${bins.join(",")}`);
  }
  return bins[0];
};
```

- [ ] **Step 4: 跑确认通过**

Run: `cd packages/generator && pnpm vitest run test/marker-ns.test.ts`
Expected: PASS

- [ ] **Step 5: text-patch 5 调用点注入 markerNs**

`packages/generator/src/assemble/ops/text-patch.ts`：import `getMarkerNs`，在 `hasExistingBlock`（:72 `validateMarkerKey`、:73 `buildMarkerLines`）、insert（:88 `computeInsert`）、remove（:101 `computeRollback`）各调用补 `markerNs: getMarkerNs()`（computeInsert 是 opts 加字段；validateMarkerKey 是末位实参）。两处 key 校验 NS 口径一致。

- [ ] **Step 6: operate 现有两路径注入 markerNs**

`packages/generator/src/core/operate.ts`：import `getMarkerNs`。
- gen 路径：`batchCompileHandler` 第一参（:447 附近 `{ rootDir, rollback, extraEnvData, collectEnvData }`）加 `markerNs: getMarkerNs()`。
- remove 路径的 `dryRunRemovePrecheck` 内若直调 `computeRollback`，补 `markerNs: getMarkerNs()`（搜该文件 `computeRollback` 调用点）。

- [ ] **Step 7: 更新既有断旧 marker 的 generator 用例**

把 `generator/test/inject.test.ts`、`generator/test/assemble/ops.text-patch.test.ts` 中硬断 `dc-gen:start`/`dc-gen:end` 的期望值改为 `=== dc-gen:start:… ===` 新格式。

- [ ] **Step 8: 跑 generator 相关测试至通过**

Run: `cd packages/generator && pnpm vitest run test/marker-ns.test.ts test/inject.test.ts test/assemble/ops.text-patch.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/generator/src/core/marker-ns.ts packages/generator/src/assemble/ops/text-patch.ts packages/generator/src/core/operate.ts packages/generator/test
git commit -m "feat(generator): getMarkerNs 单bin守卫 + text-patch/operate 注入 markerNs"
```

---

## Task 4: operate `action:"modify"`（过滤 insert + 预检 must-exist + skip-missing）

**Files:**
- Modify: `packages/generator/src/types/index.ts`（`OperateAction` + `OperateOptions.skipMissing`）
- Modify: `packages/generator/src/core/operate.ts`
- Test: `packages/generator/test/modify.test.ts`

**Interfaces:**
- Consumes：`probeMarkerBlock`（template）、`getMarkerNs`、`resolveMarkerComment`、既有 `prepareItem`/`assertNoMarkerKeyConflict`。
- Produces：`operate({ action: "modify", batch, env, skipMissing? })` —— 仅原位替换 insert 块。

- [ ] **Step 1: 类型扩展**

`packages/generator/src/types/index.ts`：`OperateAction` 联合加 `"modify"`；`OperateOptions` 加 `skipMissing?: boolean`。同步把该文件 marker 注释样例（:102）改 `=== dc-gen:start:… ===`（R-B5）。

- [ ] **Step 2: 写 modify 行为测试（失败）**

`packages/generator/test/modify.test.ts`（沙盒临时目录构造一个含 1 个 insert FileEntry 的批次 + 已 add 过的目标文件）：

```ts
import { describe, it, expect } from "vitest";
import { operate } from "@/core/operate";
// ...构造 batch + env 的 helper（复用 inject.test.ts 同款临时夹具）...

describe("operate action:modify", () => {
  it("改值：同 markerKey 块原位替换为新 env 渲染", async () => {
    // 先 add 出 === dc-gen:start:t:foo === 块（值=1），再以 env{v:2} modify
    await operate({ action: "add", batch, env: envV1 });
    await operate({ action: "modify", batch, env: envV2 });
    const content = readTarget();
    expect(content).toContain("const x = 2");
    expect(content).not.toContain("const x = 1");
    expect((content.match(/dc-gen:start:/g) || []).length).toBe(1); // 未重复插
  });

  it("目标块不存在 → 默认整体中止、零写盘", async () => {
    await expect(operate({ action: "modify", batch, env: envFresh }))
      .rejects.toThrow(/缺失|不存在/);
  });

  it("零 insert 配方 → fail-loud", async () => {
    await expect(operate({ action: "modify", batch: overwriteOnlyBatch, env: envV1 }))
      .rejects.toThrow(/无 insert/);
  });

  it("--skip-missing：缺块跳过、存在块照改", async () => {
    // 两 insert 块，仅一块已存在
    await operate({ action: "modify", batch: twoInsertBatch, env: envV2, skipMissing: true });
    // 断言存在块更新、缺失块未创建、报告含跳过项
  });
});
```

- [ ] **Step 3: 跑确认失败**

Run: `cd packages/generator && pnpm vitest run test/modify.test.ts`
Expected: FAIL（operate 不识 action:"modify"）

- [ ] **Step 4: operate 加 modify 分支**

`packages/generator/src/core/operate.ts` 的 `operate`：在 `items` 构造 + `assertNoMarkerKeyConflict` 之后、`rollback` 判断处，插入 modify 专路（`action === "modify"` 时不进 add/remove 落盘主路）：

```ts
import { probeMarkerBlock, resolveMarkerComment } from "@done-coding/cli-template";
import { getMarkerNs } from "@/core/marker-ns";
import fs from "node:fs";

// ...items + assertNoMarkerKeyConflict 之后：
if (action === "modify") {
  const ns = getMarkerNs();
  // 1. 过滤 insert 子集（strategy inject→INSERT）
  let insertItems = items.filter((it) => it.strategy === "inject");
  const skippedNonInsert = items.length - insertItems.length;
  // 2. 零 insert fail-loud
  if (insertItems.length === 0) {
    throw new Error("该批次无 insert，modify 无意义");
  }
  // 3. 预检 must-exist（probeMarkerBlock；读现有目标文件，不存在视为缺失）
  const probe = (it: typeof insertItems[number]) => {
    const content = fs.existsSync(it.output) ? fs.readFileSync(it.output, "utf-8") : "";
    const comment = resolveMarkerComment(it.output, it.markerComment);
    return probeMarkerBlock(content, { comment, markerKey: it.markerKey!, markerNs: ns });
  };
  const missing = insertItems.filter((it) => !probe(it));
  if (missing.length && !opts.skipMissing) {
    throw new Error(`modify 预检失败，缺失块：\n  - ` +
      missing.map((it) => `${it.output} :: ${it.markerKey}`).join("\n  - "));
  }
  if (opts.skipMissing && missing.length) {
    insertItems = insertItems.filter((it) => probe(it));
    // 剔除后重校同文件 markerKey 冲突（保序）
    assertNoMarkerKeyConflict(insertItems, renderedEnv);
  }
  // 4. 落盘：仅 insert 子集走 batchCompileHandler（rollback=false → computeInsert pairing===1 原位替换）
  const list = insertItems.map(({ strategy, ...rest }) => ({ ...rest, markerNs: ns }));
  await batchCompileHandler(
    { rootDir: env.execDir, rollback: false, extraEnvData: renderedEnv,
      collectEnvData: extractAnswers(renderedEnv), markerNs: ns },
    { globalEnvData: {}, collectEnvDataForm: toTemplateForm(config.collectEnvDataForm),
      list: list as CompileTemplateConfigListItemRaw[] },
  );
  outputConsole.success(`modify 操作完成（跳过非 insert ${skippedNonInsert} 项` +
    (opts.skipMissing && missing.length ? `，跳过缺失块 ${missing.length} 项` : "") + "）");
  return;
}
```

> 注：`it.output`/`it.markerKey`/`it.markerComment`/`it.strategy` 为 `prepareItem` 返回字段，沿用其现有命名；若实际字段名不同，按 `prepareItem` 返回类型对齐（实现期 `grep -n "return" operate.ts` 内 prepareItem 定义确认）。

- [ ] **Step 5: 跑 modify 测试至通过**

Run: `cd packages/generator && pnpm vitest run test/modify.test.ts`
Expected: PASS（4 用例全绿）

- [ ] **Step 6: Commit**

```bash
git add packages/generator/src/types/index.ts packages/generator/src/core/operate.ts packages/generator/test/modify.test.ts
git commit -m "feat(generator): operate action:modify（过滤insert+预检must-exist+skip-missing）"
```

---

## Task 5: modify handler + dc-gen 命令注册

**Files:**
- Create: `packages/generator/src/handlers/modify.ts`
- Modify: `packages/generator/src/handlers/index.ts`
- Test: `packages/generator/test/modify-handler.test.ts`

**Interfaces:**
- Consumes：`operate({ action:"modify", skipMissing })`、add handler 同款供答管线（`resolveEnvSupply`/`collectInteractiveAnswers`/`discoverBatch`/`ensureNameLegal`/`createEnvContext`）。
- Produces：`modifyHandler: GeneratorHandler`；`dc-gen modify <type> <name> [--env|--envFile|--skip-missing]`。

- [ ] **Step 1: 写 modify handler 集成测试（失败）**

`packages/generator/test/modify-handler.test.ts`：在临时 cwd 注入 ctx，先 `addHandler` 造块，再 `modifyHandler({ type, name, env: '{"v":2}' }, ctx)`，断言目标文件块更新为 2。

- [ ] **Step 2: 跑确认失败**

Run: `cd packages/generator && pnpm vitest run test/modify-handler.test.ts`
Expected: FAIL（modify.ts 不存在）

- [ ] **Step 3: 实现 modify handler（复刻 add 骨架）**

`packages/generator/src/handlers/modify.ts`（比照 `handlers/add.ts`，落 operate 改 action + 透 skipMissing）：

```ts
/** [modify] dc-gen modify <type> <name>：复用配方原位改 insert 值。 */
import { discoverBatch } from "@/core/batch-discovery";
import { createEnvContext } from "@/core/env-context";
import { operate } from "@/core/operate";
import type { GeneratorHandler } from "@/types";
import { ensureNameLegal } from "@/utils/ensure-name";
import { resolveEnvSupply } from "@/utils/env-supply";
import { collectInteractiveAnswers, listBatchQuestions } from "./shared";
import { resolveHandlerContext } from "@done-coding/cli-utils";

const ensureArgs = (argv: { type?: string; name?: string }) => {
  const missing: string[] = [];
  if (!argv.type) missing.push("type（批次类型，dc-gen modify <type> <name>）");
  if (!argv.name) missing.push("name（实例名，dc-gen modify <type> <name>）");
  if (missing.length) throw new Error(`modify 缺少必填参数：\n  - ${missing.join("\n  - ")}`);
  return { type: argv.type as string, name: argv.name as string };
};

export const handler: GeneratorHandler = async (argv, ctxInit) => {
  const ctx = resolveHandlerContext(ctxInit);
  if (argv.listQuestions) {
    if (!argv.type) throw new Error("--list-questions 需指定批次类型：dc-gen modify <type> --list-questions");
    listBatchQuestions(discoverBatch(argv.type, { cwd: ctx.cwd }).config);
    return;
  }
  const { type, name } = ensureArgs(argv);
  const batch = discoverBatch(type, { cwd: ctx.cwd });
  ensureNameLegal(name, { nameExcludes: batch.config.nameExcludes, typeLabel: type });
  const baseEnv = createEnvContext(name, { execDir: ctx.cwd, templateDir: batch.hit.realDir });
  const supplied = resolveEnvSupply({ env: argv.env, envFile: argv.envFile, cwd: ctx.cwd }) ?? {};
  const answers = await collectInteractiveAnswers({ config: batch.config, supplied, baseEnv, ctx });
  await operate({ action: "modify", batch, env: answers, skipMissing: argv.skipMissing });
};
```

（`argv.skipMissing` 需在 `GeneratorHandlerArgv` 类型加 `skipMissing?: boolean`，同 T4 改 types。）

- [ ] **Step 4: 注册命令 + 导出**

`packages/generator/src/handlers/index.ts`：
- 顶部 `import { handler as modifyHandler } from "./modify";` + `export { modifyHandler };`
- 加 `modifyOptions`（env/envFile/listQuestions/skipMissing）与 `modifyCommandCliInfo`（比照 `addCommandCliInfo`，command `"modify <type> <name>"`）。
- 把 `modifyCommandCliInfo` 加进 `commandCliInfo.subcommands` 数组。

```ts
const modifyOptions: YargsOptionsRecord<
  Pick<GeneratorHandlerArgv, "env" | "envFile" | "listQuestions" | "skipMissing">
> = {
  env: { type: "string", describe: '非交互供答(JSON)，key 对齐 collectEnvDataForm[].name' },
  envFile: { type: "string", describe: "非交互供答 JSON 文件路径" },
  listQuestions: { type: "boolean", describe: "仅打印该批次问题清单(JSON)", default: false },
  skipMissing: { type: "boolean", describe: "跳过不存在的 marker 块（块级），改其余", default: false },
};

const modifyCommandCliInfo: SubCliInfo = {
  command: "modify <type> <name>",
  describe: "复用配方原位修改 insert 块的值",
  positionals: { ...typePositional, ...namePositional },
  options: modifyOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    modifyHandler(toGeneratorArgv(argv))) as SubCliInfo["handler"],
};
```

main.ts 的 usage 文案（`dispatchCommandAndUsage`）补一行 `modify <type> <name>`。

- [ ] **Step 5: 跑 handler 测试至通过**

Run: `cd packages/generator && pnpm vitest run test/modify-handler.test.ts && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/generator/src/handlers/modify.ts packages/generator/src/handlers/index.ts packages/generator/src/main.ts packages/generator/src/types/index.ts packages/generator/test/modify-handler.test.ts
git commit -m "feat(generator): dc-gen modify 子命令（handler + 注册 + --skip-missing）"
```

---

## Task 6: component `modify` 包装 + 注册

**Files:**
- Modify: `packages/component/src/handlers/index.ts`
- Test: `packages/component/test/modify.test.ts`

**Interfaces:**
- Consumes：`modifyHandler`（generator）、`withBatchType`。
- Produces：`dc-component modify <name>` ≡ `dc-gen component modify <name>`。

- [ ] **Step 1: 写 component modify 测试（失败）**

`packages/component/test/modify.test.ts`：`modifyCommandHandler({ name, env }, ctx)` 在临时 cwd 改 component 实例的 insert 块。

- [ ] **Step 2: 跑确认失败**

Run: `cd packages/component && pnpm vitest run test/modify.test.ts`
Expected: FAIL（未导出 modify 包装）

- [ ] **Step 3: 包装 + 注册**

`packages/component/src/handlers/index.ts`：
- import 加 `modifyHandler`（来自 `@done-coding/cli-generator`）。
- 加：

```ts
/** modify：dc-component modify <name> == dc-gen component modify <name> */
export const modifyCommandHandler = (
  argv: CliHandlerArgv<GeneratorHandlerArgv>,
  ctxInit?: HandlerContextInit,
) => modifyHandler(withBatchType(argv), ctxInit);
```

- 加 `modifyOptions`（env/envFile/listQuestions/skipMissing，对齐 generator）+ `modifyCommandCliInfo`（command `"modify <name>"`，positionals `namePositional`）。
- `commandCliInfo.subcommands` 数组加 `modifyCommandCliInfo`。

- [ ] **Step 4: 跑至通过**

Run: `cd packages/component && pnpm vitest run test/modify.test.ts && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/component/src/handlers/index.ts packages/component/test/modify.test.ts
git commit -m "feat(component): dc-component modify 包装 + 注册（透传 generator）"
```

---

## Task 7: 回归基准重生成 + 旧字面量核空 + 全量验证

**Files:**
- Modify: 各 golden / 回归基准夹具（gen 重打包基准、assemble committed 产物）
- Modify: 任何残留旧 marker 字面量处

- [ ] **Step 1: grep 旧 marker 字面量清单**

Run:
```bash
cd packages && grep -rn "dc-gen:start\|dc-gen:end\|MARKER_NS" --include="*.ts" --include="*.json5" --include="*.md" . | grep -v "node_modules\|=== dc-gen"
```
Expected: 仅剩 `DEFAULT_MARKER_NS` 定义处 + 已改为 `=== dc-gen:` 的样例；其余旧裸格式应为空。残留者逐一改新格式（含 `generator/src/presets/init-skeleton.ts:25`）。

- [ ] **Step 2: 重生成受影响回归基准**

按 CLAUDE.md 回归约束：gen 重打包基准 / assemble committed 产物因 `===` 必变。在**临时目录**重生成 → 人核格式正确（含 `=== dc-gen:start:` 外壳）→ 覆盖基准夹具为新基线。[MUST NOT] 工作树原地比对。

- [ ] **Step 3: 跑三包全量测试**

Run:
```bash
cd packages/template && pnpm vitest run
cd ../generator && pnpm vitest run
cd ../component && pnpm vitest run
```
Expected: 全 PASS

- [ ] **Step 4: lint + 类型**

Run:
```bash
cd packages/template && pnpm eslint . && pnpm tsc --noEmit
cd ../generator && pnpm eslint . && pnpm tsc --noEmit
cd ../component && pnpm eslint . && pnpm tsc --noEmit
```
Expected: 0 error

- [ ] **Step 5: standalone 冒烟（手验 dc-template / dc-gen / dc-component CLI 无感知）**

在临时目录跑 `dc-gen <type> add` → `dc-gen <type> modify`（改 env 值）→ 确认块原位更新、未重复；`dc-component add`/`modify` 同验。

- [ ] **Step 6: Commit**

```bash
git add -A packages
git commit -m "test(generator): === 回归基准重生成 + 旧 marker 字面量核空 + 全量验证"
```

---

## Self-Review 覆盖核对

- R-A1~A5 → T1（格式/外壳/单点/禁 `--`）；R-A5 迁移 → T7 重生成。
- R-B1~B5/B3a → T1（NS 入参 + DEFAULT 常量）、T2（compile 透传 + 注释样例）、T3（getMarkerNs 单 bin + 注入）、T7（字面量核空）。
- R-C1~C6 → T4（过滤/零insert/原位替换）、T5（命令/供答复用）、T6（component 跟进）。
- R-D1~D5 → T4（预检 must-exist/skip-missing 块级/重校冲突/零insert）。
- R-E1~E7 → 各任务 vitest + 沙盒；T7 回归基准 + 核空 + 不发布。
- R-F1~F5 → T2（template standalone 无感知）、T5/T6（CLI 命令面：add/remove 不变 + modify 增量）、T3/T4（gen 程序化可破坏）。
