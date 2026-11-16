import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DOMAINS_SOURCE } from "@/core/check";
import {
  CodeGateEnum,
  GateModeEnum,
  runCodeGates,
  type GatesConfig,
} from "@/core/gates";
import type { OwnershipConfig } from "@/core/ownership";
import { SEAM_MARKER } from "@/core/seams";
import { cleanup, makeRepo, updateRepo } from "./helpers";

const GOV = "docs/governance";

const MODULES = `# MODULES

## 领域模块

| 领域模块 | 一句能力 | status | paths | public |
|---|---|---|---|---|
| \`alpha\` | 甲 | active | \`web/src/domains/alpha/\`、\`web/tests/domains/alpha/\`、\`svc/src/app/alpha/**\`、\`svc/tests/alpha/\` | \`web/src/domains/alpha/index.ts\`、\`svc/src/app/alpha/__init__.py\` |
| \`beta\` | 乙 | active（首切片） | \`web/src/domains/beta/\` | \`web/src/domains/beta/index.ts\` |
| \`gamma\` | 丙 | not_implemented | \`svc/src/app/gamma/\` | |

## 共享骨架与横向领域

| 共享骨架 | paths | public | 说明 |
|---|---|---|---|
| web 壳 | \`web/**\` | \`web/src/runtime.ts\`、\`web/src/seams/**\` | 入口、运行时 |
| 后端壳 | \`svc/**\` | \`svc/src/app/core/**\` | 装配 |
`;

const SNAPSHOT = `# SNAPSHOT

## done-coding 缺口表（blueprint 0041ⓔ）

| # | 缺口 | 接缝件 | issue | 状态 |
| --- | --- | --- | --- | --- |
| G1 | 页顶提示条 | \`web/src/seams/Notice.ts\` | template-hub abc123 | 等待 |
| G2 | 表格可访问名称 | 无 | forge 记录 \`records/x.md\` | 等待 |
| G3 | 默认落点 | \`web/src/main.ts\` | template-hub def456 | 已替换 |

## 其它
`;

/** 合规夹具：TS 用 @/ 别名与相对路径，Python 用 src 布局 */
const BASE: Record<string, string> = {
  [`${GOV}/MODULES.md`]: MODULES,
  [`${GOV}/SNAPSHOT.md`]: SNAPSHOT,
  "README.md": "# repo\n",
  "web/package.json": "{}\n",
  "web/tsconfig.json":
    '{\n  // 注释\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] }, },\n}\n',
  "web/src/main.ts":
    'import { alpha } from "@/domains/alpha";\nimport { beta } from "@/domains/beta/index";\nimport "./runtime";\n',
  "web/src/runtime.ts": "export const useApi = () => 1;\n",
  "web/src/seams/Notice.ts": `// ${SEAM_MARKER} template-hub abc123：页顶提示条\nexport const Notice = 1;\n`,
  "web/src/domains/alpha/index.ts": 'export { alpha } from "./inner";\n',
  "web/src/domains/alpha/inner.ts":
    'import { useApi } from "@/runtime";\nimport { Notice } from "../../seams/Notice";\nimport { beta } from "../beta";\nexport const alpha = useApi() + Notice + beta;\n',
  "web/src/domains/beta/index.ts": "export const beta = 2;\n",
  "web/tests/shell.test.ts":
    'import "../src/main";\nimport { alpha } from "@/domains/alpha";\n',
  "web/tests/domains/alpha/inner.test.ts":
    'import { alpha } from "../../../src/domains/alpha/inner";\n',
  "svc/src/app/__init__.py": "",
  "svc/src/app/main.py":
    "from app.alpha import router\nfrom app.core import db\n",
  "svc/src/app/core/__init__.py": "",
  "svc/src/app/core/db.py": "x = 1\n",
  "svc/src/app/alpha/__init__.py": "from .service import router\n",
  "svc/src/app/alpha/service.py":
    "from app.core.db import x\nimport app.core.db\nrouter = x\n",
  "svc/src/app/gamma/MODULE.md": "# gamma\n",
  "svc/tests/alpha/test_service.py": "from app.alpha.service import router\n",
};

let root = "";
afterEach(() => cleanup(root));

const run = (
  gates?: GatesConfig,
  extra: { strict?: boolean; ownership?: OwnershipConfig } = {},
) =>
  runCodeGates({
    projectRoot: root,
    governanceRoot: path.join(root, GOV),
    domains: DEFAULT_DOMAINS_SOURCE,
    gates,
    ...extra,
  });

const errorsOf = (gate: CodeGateEnum, gates?: GatesConfig) =>
  run(gates).find((r) => r.gate === gate)!.errors;

describe("代码类三闸：合规夹具", () => {
  it("三闸都执行且全过", () => {
    root = makeRepo(BASE);
    const reports = run();
    expect(reports.map((r) => [r.gate, r.state, r.errors])).toEqual([
      [CodeGateEnum.OWNERSHIP, "ran", []],
      [CodeGateEnum.IMPORTS, "ran", []],
      [CodeGateEnum.SEAMS, "ran", []],
    ]);
  });
});

describe("不准恒绿：缺数据时的状态", () => {
  it("auto：领域表无 paths 列 → 归属 / 引用未启用（不失败），并写明缺什么", () => {
    root = makeRepo({
      ...BASE,
      [`${GOV}/MODULES.md`]: "| 领域 | 落点 |\n|---|---|\n| `alpha` | x |\n",
      [`${GOV}/SNAPSHOT.md`]: "# 无缺口表\n",
      "web/src/seams/Notice.ts": "export const Notice = 1;\n",
    });
    const reports = run();
    expect(reports.map((r) => [r.gate, r.state, r.note])).toEqual([
      [CodeGateEnum.OWNERSHIP, "disabled", "MODULES.md 领域表无 paths 列"],
      [
        CodeGateEnum.IMPORTS,
        "disabled",
        "归属闸缺数据（MODULES.md 领域表无 paths 列）",
      ],
      [
        CodeGateEnum.SEAMS,
        "disabled",
        "SNAPSHOT.md 无「## done-coding 缺口表」",
      ],
    ]);
    expect(reports.every((r) => !r.errors.length)).toBe(true);
  });

  it("auto：有 paths 无共享骨架表 → 归属闸未启用；无 public 列 → 引用闸未启用", () => {
    root = makeRepo({
      ...BASE,
      [`${GOV}/MODULES.md`]: MODULES.split("## 共享骨架")[0],
    });
    expect(run()[0].note).toBe(
      "MODULES.md 无共享骨架表（首列表头「共享骨架」）",
    );
    updateRepo(root, {
      [`${GOV}/MODULES.md`]: MODULES.replace("| public |", "| 备注 |"),
    });
    expect(run()[1]).toMatchObject({
      state: "disabled",
      note: "MODULES.md 领域表无 public 列",
    });
  });

  it("on / --strict：缺数据即失败；off：照样列明已关闭", () => {
    root = makeRepo({ ...BASE, [`${GOV}/MODULES.md`]: "| `alpha` | x |\n" });
    expect(
      errorsOf(CodeGateEnum.OWNERSHIP, { ownership: GateModeEnum.ON }),
    ).toEqual(["归属闸：要求启用但缺数据——MODULES.md 领域表无 paths 列"]);
    expect(
      run(undefined, { strict: true }).map((r) => r.errors.length),
    ).toEqual([1, 1, 0]);
    expect(run({ seams: GateModeEnum.OFF })[2]).toMatchObject({
      state: "off",
      note: "配置 gates 关闭",
    });
  });

  it("缺缺口表但代码里已有标注 → 不算未启用，直接报错", () => {
    root = makeRepo({ ...BASE, [`${GOV}/SNAPSHOT.md`]: "# 无表\n" });
    expect(errorsOf(CodeGateEnum.SEAMS)).toEqual([
      `缺口表：web/src/seams/Notice.ts 带标注 ${SEAM_MARKER}，但 SNAPSHOT.md 无「## done-coding 缺口表」`,
    ]);
  });
});

describe("归属闸：故意破坏", () => {
  it("无主文件（骨架未覆盖）、领域重叠、未实现领域有代码、active 无代码", () => {
    root = makeRepo({
      ...BASE,
      "scripts/dev.sh": "echo dev\n",
      "svc/src/app/gamma/service.py": "x = 1\n",
      [`${GOV}/MODULES.md`]: MODULES.replace(
        "| `beta` | 乙 | active（首切片） | `web/src/domains/beta/`",
        "| `beta` | 乙 | active（首切片） | `web/src/domains/beta/`、`web/src/domains/alpha/inner.ts`",
      ).replace(
        "| `gamma` |",
        "| `delta` | 丁 | active | `svc/src/app/delta/` | |\n| `gamma` |",
      ),
    });
    expect(errorsOf(CodeGateEnum.OWNERSHIP)).toEqual([
      "归属：重叠 web/src/domains/alpha/inner.ts 同属领域 `alpha`、`beta`",
      "归属：无主 scripts/dev.sh（不在任何领域 paths 或共享骨架表中）",
      "归属：未实现领域路径下只许说明与占位，发现 svc/src/app/gamma/service.py（`gamma`）",
      "归属：active 领域 `delta` 没有任何代码文件（未实现应标 not_implemented）",
    ]);
  });

  it("status 非法、paths 为空、骨架件重叠、public 失效、领域不在 paths 表", () => {
    root = makeRepo({
      ...BASE,
      [`${GOV}/MODULES.md`]: `${MODULES.replace(
        "| active（首切片） |",
        "| 首批不启用 |",
      )
        .replace(
          "| `web/src/domains/alpha/index.ts`、",
          "| `web/src/domains/alpha/gone.ts`、",
        )
        .replace("| `svc/src/app/gamma/` |", "| |")
        .replace(
          "| 后端壳 | `svc/**` |",
          "| 后端壳 | `svc/**`、`web/src/main.ts` |",
        )}\n## 横向\n\n| \`omega\` | 只在首列登记 |\n`,
    });
    expect(errorsOf(CodeGateEnum.OWNERSHIP)).toEqual([
      "归属：领域 `omega` 不在含 paths 列的领域表中",
      "归属：领域 `beta`（MODULES.md:8）的 status「首批不启用」不合法，须以 active / not_implemented / retired 开头",
      "归属：领域 `gamma`（MODULES.md:9）未写 paths",
      "归属：重叠 web/src/main.ts 同属共享骨架 「web 壳」、「后端壳」",
      "归属：领域 `alpha` 的 public `web/src/domains/alpha/gone.ts` 没有命中本领域的代码文件",
    ]);
  });

  it("exclude / extensions 配置：排除的生成物不要求归属", () => {
    root = makeRepo({ ...BASE, "gen/api.ts": "export {};\n" });
    expect(errorsOf(CodeGateEnum.OWNERSHIP)).toHaveLength(1);
    const reports = run(undefined, { ownership: { exclude: ["gen/"] } });
    expect(reports[0].errors).toEqual([]);
  });
});

describe("引用闸：故意破坏（领域之间 / 壳到领域 / 测试到领域 / 领域到壳）", () => {
  it("TS：别名与相对路径越过公开入口；Python：绝对导入越过 __init__", () => {
    root = makeRepo({
      ...BASE,
      "web/src/domains/beta/index.ts":
        'import { alpha } from "../alpha/inner";\nexport const beta = 2;\n',
      "web/src/main.ts":
        'import { alpha } from "@/domains/alpha/inner";\nimport "./runtime";\n',
      "web/tests/shell.test.ts":
        'import { beta } from "../src/domains/beta/index.ts";\nimport { x } from "@/domains/alpha/inner.js";\n',
      "web/src/domains/alpha/inner.ts":
        'import { start } from "@/main";\nexport const alpha = start;\n',
      "svc/src/app/main.py": "from app.alpha.service import router\n",
      "svc/src/app/alpha/service.py":
        "from app import main\nfrom ..core import db\n",
    });
    expect(errorsOf(CodeGateEnum.IMPORTS)).toEqual([
      "引用：svc/src/app/alpha/service.py:1 → svc/src/app/main.py（领域 `alpha` 引 共享骨架「后端壳」 的内部文件，只许经该行 public）",
      "引用：svc/src/app/main.py:1 → svc/src/app/alpha/service.py（共享骨架「后端壳」 引 领域 `alpha` 的内部文件，只许经其 public）",
      "引用：web/src/domains/alpha/inner.ts:1 → web/src/main.ts（领域 `alpha` 引 共享骨架「web 壳」 的内部文件，只许经该行 public）",
      "引用：web/src/domains/beta/index.ts:1 → web/src/domains/alpha/inner.ts（领域 `beta` 引 领域 `alpha` 的内部文件，只许经其 public）",
      "引用：web/src/main.ts:1 → web/src/domains/alpha/inner.ts（共享骨架「web 壳」 引 领域 `alpha` 的内部文件，只许经其 public）",
      "引用：web/tests/shell.test.ts:2 → web/src/domains/alpha/inner.ts（共享骨架「web 壳」 引 领域 `alpha` 的内部文件，只许经其 public）",
    ]);
  });

  it("imports.include：只查范围内的引用方，并在附注写明范围", () => {
    root = makeRepo({
      ...BASE,
      "web/src/main.ts": 'import { alpha } from "@/domains/alpha/inner";\n',
      "svc/src/app/main.py": "from app.alpha.service import router\n",
    });
    const report = runCodeGates({
      projectRoot: root,
      governanceRoot: path.join(root, GOV),
      domains: DEFAULT_DOMAINS_SOURCE,
      imports: { include: ["web/"] },
    })[1];
    expect(report.errors).toEqual([
      "引用：web/src/main.ts:1 → web/src/domains/alpha/inner.ts（共享骨架「web 壳」 引 领域 `alpha` 的内部文件，只许经其 public）",
    ]);
    expect(report.note).toBe("只查引用方落在 imports.include（web/）内的引用");
  });

  it("骨架表无 public 列：领域 → 壳不设限，并在附注写明", () => {
    root = makeRepo({
      ...BASE,
      [`${GOV}/MODULES.md`]: MODULES.replace(
        "| 共享骨架 | paths | public | 说明 |",
        "| 共享骨架 | paths | 职责 | 说明 |",
      ),
      "web/src/domains/alpha/inner.ts": 'import { start } from "@/main";\n',
    });
    const report = run()[1];
    expect(report.errors).toEqual([]);
    expect(report.note).toBe("共享骨架表无 public 列，领域 → 壳方向不设限");
  });
});

describe("缺口表闸：故意破坏", () => {
  it("缺列 → 只报缺列", () => {
    root = makeRepo({
      ...BASE,
      [`${GOV}/SNAPSHOT.md`]: SNAPSHOT.replace("| 接缝件 |", "| 接缝件位置 |"),
    });
    expect(errorsOf(CodeGateEnum.SEAMS)).toEqual([
      "缺口表：SNAPSHOT.md:5 缺列 接缝件（表头须含 缺口 / 接缝件 / issue / 状态）",
    ]);
  });

  it("状态非法、路径不存在、非路径片段、issue 为空、漏标注与多出标注", () => {
    root = makeRepo({
      ...BASE,
      [`${GOV}/SNAPSHOT.md`]: SNAPSHOT.replace(
        "| 等待 |\n| G2",
        "| 进行中 |\n| G2",
      )
        .replace(
          "| 无 | forge 记录 `records/x.md` |",
          "| 在 main.ts 的 `/` 一行 | |",
        )
        .replace(
          "| G3 | 默认落点 | `web/src/main.ts`",
          "| G3 | 默认落点 | `web/src/gone.ts`",
        ),
      "web/src/domains/beta/index.ts": `// ${SEAM_MARKER} 未登记\nexport const beta = 2;\n`,
    });
    expect(errorsOf(CodeGateEnum.SEAMS)).toEqual([
      "缺口表：SNAPSHOT.md:7 状态「进行中」不合法（等待 / 已可替换 / 已替换）",
      "缺口表：SNAPSHOT.md:8 issue 为空",
      "缺口表：SNAPSHOT.md:8 接缝件 `/` 须为仓根相对路径",
      "缺口表：SNAPSHOT.md:9 接缝件 `web/src/gone.ts` 不存在（未命中跟踪文件）",
      `缺口表：web/src/domains/beta/index.ts 带标注 ${SEAM_MARKER}，但不在缺口表的等待 / 已可替换行`,
      // G1 状态非法即不算未结行，其接缝件的标注随之落空
      `缺口表：web/src/seams/Notice.ts 带标注 ${SEAM_MARKER}，但不在缺口表的等待 / 已可替换行`,
    ]);
  });

  it("等待行的接缝件没带标注；已替换行不要求标注", () => {
    root = makeRepo({
      ...BASE,
      "web/src/seams/Notice.ts": "export const Notice = 1;\n",
    });
    expect(errorsOf(CodeGateEnum.SEAMS)).toEqual([
      `缺口表：web/src/seams/Notice.ts（SNAPSHOT.md:7）未带标注 ${SEAM_MARKER}`,
    ]);
  });
});
