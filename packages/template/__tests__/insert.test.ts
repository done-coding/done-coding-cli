import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileTemplate } from "@/utils";
import { OutputModeEnum } from "@/types";
import type { InsertAnchor, InsertMarkerComment } from "@/types";
import {
  DEFAULT_MARKER_NS,
  buildMarkerLines,
  probeMarkerPairing,
} from "@/utils/marker";

const NS = DEFAULT_MARKER_NS; // "dc-template"
const tsComment = { open: "//", close: "" };

/**
 * T1：cli-template INSERT 模式 + 语言感知 marker 健壮回退（P2，design §3/§12）。
 *
 * 全沙盒：夹具落 os.tmpdir()，afterEach 清理，不污染工作树（项目沙盒铁律 K7）。
 * 覆盖：forward before/after、多语言 marker、幂等替换、回退按 marker 精确删、
 * 免疫块内手改、错误矩阵 E1/E3/E4/E7/E10-E15、EOL、A1 回退独立于模板。
 */
describe("INSERT 模式 + marker 健壮回退", () => {
  let rootDir: string;

  const write = (rel: string, content: string): void => {
    const p = path.resolve(rootDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf-8");
  };
  const read = (rel: string): string =>
    fs.readFileSync(path.resolve(rootDir, rel), "utf-8");
  const exists = (rel: string): boolean =>
    fs.existsSync(path.resolve(rootDir, rel));

  const runInsert = (opts: {
    output: string;
    inputData?: string;
    anchor?: InsertAnchor;
    markerKey?: string;
    markerComment?: InsertMarkerComment;
  }) =>
    compileTemplate(
      {
        inputData: opts.inputData ?? "",
        output: opts.output,
        mode: OutputModeEnum.INSERT,
        envData: {},
        markerNs: NS,
        ...(opts.anchor ? { anchor: opts.anchor } : {}),
        ...(opts.markerKey ? { markerKey: opts.markerKey } : {}),
        ...(opts.markerComment ? { markerComment: opts.markerComment } : {}),
      },
      { rootDir, rollback: false },
    );

  const runRollback = (opts: {
    output: string;
    markerKey?: string;
    markerComment?: InsertMarkerComment;
    rollbackDelNullFile?: boolean;
  }) =>
    compileTemplate(
      {
        inputData: "", // A1：回退不读模板，传空也无妨
        output: opts.output,
        mode: OutputModeEnum.INSERT,
        envData: {},
        markerNs: NS,
        ...(opts.markerKey ? { markerKey: opts.markerKey } : {}),
        ...(opts.markerComment ? { markerComment: opts.markerComment } : {}),
        ...(opts.rollbackDelNullFile === undefined
          ? {}
          : { rollbackDelNullFile: opts.rollbackDelNullFile }),
      },
      { rootDir, rollback: true },
    );

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-tmpl-insert-"));
  });
  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("U1 forward after：.ts 用 // marker，插在锚点之后", async () => {
    write("routes.ts", "const routes = [\n];\n");
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,\n",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "route:Foo",
    });
    expect(read("routes.ts")).toBe(
      "const routes = [\n" +
        "// === dc-template:start:route:Foo ===\n" +
        "  fooRoute,\n" +
        "// === dc-template:end:route:Foo ===\n" +
        "];\n",
    );
  });

  it("U2 forward before：插在锚点之前", async () => {
    write("routes.ts", "const routes = [\n];\n");
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "];", position: "before" },
      markerKey: "route:Foo",
    });
    expect(read("routes.ts")).toBe(
      "const routes = [\n" +
        "// === dc-template:start:route:Foo ===\n" +
        "  fooRoute,\n" +
        "// === dc-template:end:route:Foo ===\n" +
        "];\n",
    );
  });

  it("U3 多语言 marker：vue<!--/css/*/py#", async () => {
    write("a.vue", "<template>\n</template>\n");
    await runInsert({
      output: "a.vue",
      inputData: "  <Foo />",
      anchor: { pattern: "<template>", position: "after" },
      markerKey: "c:Foo",
    });
    expect(read("a.vue")).toContain("<!-- === dc-template:start:c:Foo === -->");
    expect(read("a.vue")).toContain("<!-- === dc-template:end:c:Foo === -->");

    write("a.css", ".root {}\n");
    await runInsert({
      output: "a.css",
      inputData: ".foo {}",
      anchor: { pattern: ".root", position: "after" },
      markerKey: "s:Foo",
    });
    expect(read("a.css")).toContain("/* === dc-template:start:s:Foo === */");
    expect(read("a.css")).toContain("/* === dc-template:end:s:Foo === */");

    write("a.py", "ITEMS = [\n]\n");
    await runInsert({
      output: "a.py",
      inputData: "  foo,",
      anchor: { pattern: "ITEMS = [", position: "after" },
      markerKey: "p:Foo",
    });
    expect(read("a.py")).toContain("# === dc-template:start:p:Foo ===");
    expect(read("a.py")).toContain("# === dc-template:end:p:Foo ===");
  });

  it("U4 回退按 marker 精确删，回到插入前", async () => {
    const original = "const routes = [\n];\n";
    write("routes.ts", original);
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "route:Foo",
    });
    await runRollback({ output: "routes.ts", markerKey: "route:Foo" });
    expect(read("routes.ts")).toBe(original);
  });

  it("U5 回退免疫块内手改（R8① 健壮）", async () => {
    const original = "const routes = [\n];\n";
    write("routes.ts", original);
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "route:Foo",
    });
    // 手改块内容
    const edited = read("routes.ts").replace(
      "  fooRoute,",
      "  fooRouteEDITED, // x",
    );
    write("routes.ts", edited);
    await runRollback({ output: "routes.ts", markerKey: "route:Foo" });
    expect(read("routes.ts")).toBe(original);
  });

  it("U21/A1 回退独立于模板：即便无模板内容也按 marker 成功", async () => {
    const original = "const routes = [\n];\n";
    write("routes.ts", original);
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "route:Foo",
    });
    // runRollback 传 inputData=""（不依赖任何模板）仍成功
    await expect(
      runRollback({ output: "routes.ts", markerKey: "route:Foo" }),
    ).resolves.not.toThrow();
    expect(read("routes.ts")).toBe(original);
  });

  it("E8 幂等：已存在同 markerKey 块 → 原位替换不重复", async () => {
    write("routes.ts", "const routes = [\n];\n");
    const ins = () =>
      runInsert({
        output: "routes.ts",
        inputData: "  fooRoute,",
        anchor: { pattern: "const routes = [", position: "after" },
        markerKey: "route:Foo",
      });
    await ins();
    await ins(); // 二次：替换，不重复插
    const content = read("routes.ts");
    expect(content.match(/=== dc-template:start:route:Foo ===/g)?.length).toBe(
      1,
    );
  });

  it("E1 anchor 未命中 → fail-loud", async () => {
    write("routes.ts", "const routes = [\n];\n");
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "x",
        anchor: { pattern: "NO_SUCH_ANCHOR", position: "after" },
        markerKey: "route:Foo",
      }),
    ).rejects.toThrow(/inject 锚点未命中/);
  });

  it("E3 目标文件不存在 → fail-loud（不创建）", async () => {
    await expect(
      runInsert({
        output: "nope.ts",
        inputData: "x",
        anchor: { pattern: "a", position: "after" },
        markerKey: "k",
      }),
    ).rejects.toThrow(/inject 目标文件不存在/);
    expect(exists("nope.ts")).toBe(false);
  });

  it("E4 回退 marker 未命中 → fail-loud", async () => {
    write("routes.ts", "const routes = [\n];\n");
    await expect(
      runRollback({ output: "routes.ts", markerKey: "route:Missing" }),
    ).rejects.toThrow(/inject 回退未命中 marker/);
  });

  it("E7 未知扩展名 → fail-loud；markerComment 覆盖可用", async () => {
    write("data.xyz", "ANCHOR\n");
    await expect(
      runInsert({
        output: "data.xyz",
        inputData: "x",
        anchor: { pattern: "ANCHOR", position: "after" },
        markerKey: "k",
      }),
    ).rejects.toThrow(/无内建注释样式/);

    await expect(
      runInsert({
        output: "data.xyz",
        inputData: "x",
        anchor: { pattern: "ANCHOR", position: "after" },
        markerKey: "k",
        markerComment: { open: "//", close: "" },
      }),
    ).resolves.not.toThrow();
    expect(read("data.xyz")).toContain("// === dc-template:start:k ===");
  });

  it("E10 anchor.pattern 空 → fail-loud", async () => {
    write("routes.ts", "a\n");
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "x",
        anchor: { pattern: "", position: "after" },
        markerKey: "k",
      }),
    ).rejects.toThrow(/anchor.pattern 渲染后为空/);
  });

  it("E11 非法 regex → 包装 fail-loud（非裸 SyntaxError）", async () => {
    write("routes.ts", "a\n");
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "x",
        anchor: {
          pattern: "[unclosed",
          position: "after",
          patternType: "regex",
        },
        markerKey: "k",
      }),
    ).rejects.toThrow(/不是合法正则/);
  });

  it("U13 regex 命中", async () => {
    write("routes.ts", "export const routes = [\n];\n");
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: {
        pattern: "^export const routes",
        position: "after",
        patternType: "regex",
      },
      markerKey: "route:Foo",
    });
    expect(read("routes.ts")).toContain("=== dc-template:start:route:Foo ===");
  });

  it("E12 渲染内容含伪造 marker 行 → fail-loud", async () => {
    write("routes.ts", "a\n");
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "// === dc-template:start:k ===",
        anchor: { pattern: "a", position: "after" },
        markerKey: "k",
      }),
    ).rejects.toThrow(/伪造哨兵/);
  });

  it("E13 历史重复块 → fail-loud", async () => {
    // 文件含两份相同 markerKey 块
    write(
      "routes.ts",
      "x\n// === dc-template:start:k ===\nA\n// === dc-template:end:k ===\ny\n// === dc-template:start:k ===\nB\n// === dc-template:end:k ===\n",
    );
    await expect(
      runRollback({ output: "routes.ts", markerKey: "k" }),
    ).rejects.toThrow(/非唯一成对/);
  });

  it("E14 markerKey 非法（含 dc-template: / open 符）→ fail-loud", async () => {
    write("routes.ts", "a\n");
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "x",
        anchor: { pattern: "a", position: "after" },
        markerKey: "dc-template:evil",
      }),
    ).rejects.toThrow(/保留前缀/);
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "x",
        anchor: { pattern: "a", position: "after" },
        markerKey: "a//b",
      }),
    ).rejects.toThrow(/注释起始符/);
  });

  it("E15 position 非枚举 → fail-loud", async () => {
    write("routes.ts", "a\n");
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "x",
        anchor: {
          pattern: "a",
          position: "middle" as unknown as "before",
        },
        markerKey: "k",
      }),
    ).rejects.toThrow(/anchor.position 非法/);
  });

  it("U17 EOL：CRLF 文件 inject 后不产生混合 EOL", async () => {
    write("routes.ts", "const routes = [\r\n];\r\n");
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "route:Foo",
    });
    const content = read("routes.ts");
    // 所有换行均为 \r\n（无裸 \n）
    expect(/(?<!\r)\n/.test(content)).toBe(false);
    expect(content).toContain("\r\n// === dc-template:start:route:Foo ===\r\n");
  });

  it("U17 EOL：LF 文件 inject 后保持纯 LF（不引入 \\r）", async () => {
    write("routes.ts", "const routes = [\n];\n");
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "route:Foo",
    });
    expect(read("routes.ts").includes("\r")).toBe(false);
  });

  it("U17 无尾换行文件 inject：不强加尾换行", async () => {
    write("routes.ts", "const routes = [];");
    await runInsert({
      output: "routes.ts",
      inputData: "  fooRoute,",
      anchor: { pattern: "const routes", position: "after" },
      markerKey: "route:Foo",
    });
    const content = read("routes.ts");
    // 原文件无尾换行 → 插入后仍无尾换行（末行 = end marker）
    expect(content.endsWith("// === dc-template:end:route:Foo ===")).toBe(true);
    expect(
      content.startsWith(
        "const routes = [];\n// === dc-template:start:route:Foo ===",
      ),
    ).toBe(true);
  });

  it("E13 正向：历史重复块 → computeInsert fail-loud", async () => {
    write(
      "routes.ts",
      "x\n// === dc-template:start:k ===\nA\n// === dc-template:end:k ===\ny\n// === dc-template:start:k ===\nB\n// === dc-template:end:k ===\n",
    );
    await expect(
      runInsert({
        output: "routes.ts",
        inputData: "Z",
        anchor: { pattern: "x", position: "after" },
        markerKey: "k",
      }),
    ).rejects.toThrow(/非唯一成对/);
  });

  it("回退后文件仅剩块 + rollbackDelNullFile → 删文件", async () => {
    write(
      "frag.ts",
      "// === dc-template:start:k ===\nbody\n// === dc-template:end:k ===\n",
    );
    await runRollback({
      output: "frag.ts",
      markerKey: "k",
      rollbackDelNullFile: true,
    });
    expect(exists("frag.ts")).toBe(false);
  });

  it("既有模式不受影响：OVERWRITE 正常写", async () => {
    await compileTemplate(
      {
        inputData: "hello",
        output: "o.txt",
        mode: OutputModeEnum.OVERWRITE,
        envData: {},
      },
      { rootDir, rollback: false },
    );
    expect(read("o.txt")).toBe("hello");
  });

  it("buildMarkerLines 产出 === 对称外壳（TS 行注释）", () => {
    const { startLine, endLine } = buildMarkerLines(tsComment, "route:Foo", NS);
    expect(startLine).toBe("// === dc-template:start:route:Foo ===");
    expect(endLine).toBe("// === dc-template:end:route:Foo ===");
  });

  it("HTML 块注释外壳合规（不含 --dc）", () => {
    const { startLine } = buildMarkerLines(
      { open: "<!--", close: "-->" },
      "k",
      NS,
    );
    expect(startLine).toBe("<!-- === dc-template:start:k === -->");
    expect(startLine).not.toContain("--dc");
  });

  it("probeMarkerPairing：缺失→0，成对→1", () => {
    const withBlock =
      "// === dc-template:start:k ===\nx\n// === dc-template:end:k ===\n";
    const outputPath = "/fake/path/file.ts";
    expect(
      probeMarkerPairing(withBlock, {
        comment: tsComment,
        markerKey: "k",
        markerNs: NS,
        outputPath,
      }),
    ).toBe(1);
    expect(
      probeMarkerPairing("no marker here", {
        comment: tsComment,
        markerKey: "k",
        markerNs: NS,
        outputPath,
      }),
    ).toBe(0);
  });

  it("probeMarkerPairing：duplicate start → throw 损坏错误", () => {
    const content = [
      "// === dc-template:start:k ===",
      "body1",
      "// === dc-template:start:k ===",
      "body2",
      "// === dc-template:end:k ===",
    ].join("\n");
    expect(() =>
      probeMarkerPairing(content, {
        comment: tsComment,
        markerKey: "k",
        markerNs: NS,
        outputPath: "/fake/path/file.ts",
      }),
    ).toThrow(/损坏|非唯一成对|手动清理/);
  });

  it("probeMarkerPairing：only-start（无 end）→ throw 损坏错误", () => {
    const content = "// === dc-template:start:k ===\nbody\n";
    expect(() =>
      probeMarkerPairing(content, {
        comment: tsComment,
        markerKey: "k",
        markerNs: NS,
        outputPath: "/fake/path/file.ts",
      }),
    ).toThrow(/损坏|非唯一成对|手动清理/);
  });

  it("probeMarkerPairing：end-before-start → throw 损坏错误", () => {
    const content = [
      "// === dc-template:end:k ===",
      "body",
      "// === dc-template:start:k ===",
    ].join("\n");
    expect(() =>
      probeMarkerPairing(content, {
        comment: tsComment,
        markerKey: "k",
        markerNs: NS,
        outputPath: "/fake/path/file.ts",
      }),
    ).toThrow(/损坏|end 早于 start|手动清理/);
  });
});
