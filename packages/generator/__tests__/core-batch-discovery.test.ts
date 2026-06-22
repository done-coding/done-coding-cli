/**
 * [T4] batch-discovery core 单测：R2 边界（index.json 校验 / 未命中 fail / 大小写冲突 / 错误聚合）。
 * 夹具落 tmp，afterEach 清理（K7）。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverBatch,
  listDiscoveredBatches,
  readBatchConfig,
} from "@/core/batch-discovery";

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-disc-")),
  );
  tmpRoots.push(dir);
  return dir;
};

/** 在 <base>/.done-coding/<segment>/ 造合法批次（index.json + config.json5） */
const mkBatch = (
  base: string,
  segment: string,
  configBody = `{ instanceDir: "\${execDir}/src/\${nameKebab}", files: [] }`,
): string => {
  const dir = path.join(base, ".done-coding", segment);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.json"),
    `{ "config": "./config.json5" }`,
  );
  fs.writeFileSync(path.join(dir, "config.json5"), configBody);
  return dir;
};

afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

describe("[T4] discoverBatch（R2）", () => {
  it("命中 project 层 + 读 config.json5（json5.parse）", () => {
    const cwd = mkTmp();
    mkBatch(cwd, "widget");
    const batch = discoverBatch("widget", { cwd });
    expect(batch.type).toBe("widget");
    expect(batch.hit.layer).toBe("project");
    expect(batch.config.instanceDir).toContain("${nameKebab}");
    expect(Array.isArray(batch.config.files)).toBe(true);
  });

  it("未命中 → fail-fast", () => {
    const cwd = mkTmp();
    expect(() => discoverBatch("nope-xyz", { cwd })).toThrow(/未找到批次类型/);
  });

  it("缺 index.json → fail-fast（视为非法批次）", () => {
    const cwd = mkTmp();
    fs.mkdirSync(path.join(cwd, ".done-coding", "broken"), { recursive: true });
    expect(() => discoverBatch("broken", { cwd })).toThrow(/index\.json/);
  });

  it("index.json 缺 config 字段 → fail-fast", () => {
    const cwd = mkTmp();
    const dir = path.join(cwd, ".done-coding", "noconf");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.json"), `{}`);
    expect(() => discoverBatch("noconf", { cwd })).toThrow(/config 字段/);
  });

  it("config 缺 instanceDir → fail-fast", () => {
    const cwd = mkTmp();
    mkBatch(cwd, "bad", `{ files: [] }`);
    expect(() => discoverBatch("bad", { cwd })).toThrow(/instanceDir/);
  });
});

describe("[T4] readBatchConfig H3：config 路径越界 fail-fast", () => {
  it("index.json.config 用 ../ 逃出批次目录 → fail-fast", () => {
    const cwd = mkTmp();
    fs.mkdirSync(path.join(cwd, ".done-coding"), { recursive: true });
    // 在批次外放一个 config，批次 index.json.config 用 ../ 指向它（越界读任意文件）
    fs.writeFileSync(
      path.join(cwd, ".done-coding", "evil.json5"),
      `{ instanceDir: "x", files: [] }`,
    );
    const dir = path.join(cwd, ".done-coding", "escaper");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.json"),
      `{ "config": "../evil.json5" }`,
    );
    expect(() => discoverBatch("escaper", { cwd })).toThrow(/越界/);
  });

  it("index.json.config 用绝对路径逃出批次目录 → fail-fast", () => {
    const cwd = mkTmp();
    const outside = path.join(cwd, "outside.json5");
    fs.writeFileSync(outside, `{ instanceDir: "x", files: [] }`);
    const dir = path.join(cwd, ".done-coding", "absesc");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.json"),
      JSON.stringify({ config: outside }),
    );
    expect(() => discoverBatch("absesc", { cwd })).toThrow(/越界/);
  });
});

describe("[T4] discoverBatch L1：allowSymlinkTemplateDir", () => {
  it("allowSymlinkTemplateDir:false 且模板目录是软链 → fail-fast", () => {
    const cwd = mkTmp();
    // 真实批次目录放别处，.done-coding/<seg> 指向它的软链
    const realTarget = path.join(cwd, "real-batch");
    fs.mkdirSync(realTarget, { recursive: true });
    fs.writeFileSync(
      path.join(realTarget, "index.json"),
      `{ "config": "./config.json5" }`,
    );
    fs.writeFileSync(
      path.join(realTarget, "config.json5"),
      `{ instanceDir: "x", files: [], allowSymlinkTemplateDir: false }`,
    );
    const nsDir = path.join(cwd, ".done-coding");
    fs.mkdirSync(nsDir, { recursive: true });
    fs.symlinkSync(realTarget, path.join(nsDir, "linked"), "dir");

    expect(() => discoverBatch("linked", { cwd })).toThrow(/软链/);
  });

  it("默认（未设）软链模板目录放行", () => {
    const cwd = mkTmp();
    const realTarget = path.join(cwd, "real-batch2");
    fs.mkdirSync(realTarget, { recursive: true });
    fs.writeFileSync(
      path.join(realTarget, "index.json"),
      `{ "config": "./config.json5" }`,
    );
    fs.writeFileSync(
      path.join(realTarget, "config.json5"),
      `{ instanceDir: "\${execDir}/x", files: [] }`,
    );
    const nsDir = path.join(cwd, ".done-coding");
    fs.mkdirSync(nsDir, { recursive: true });
    fs.symlinkSync(realTarget, path.join(nsDir, "linked2"), "dir");

    const batch = discoverBatch("linked2", { cwd });
    expect(batch.type).toBe("linked2");
  });
});

describe("[T4] readBatchConfig", () => {
  it("config.json5 非法 → fail-fast 指明路径", () => {
    const cwd = mkTmp();
    const dir = path.join(cwd, ".done-coding", "x");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.json"),
      `{ "config": "./config.json5" }`,
    );
    fs.writeFileSync(path.join(dir, "config.json5"), `{ not valid json5 `);
    expect(() => readBatchConfig(dir)).toThrow(/解析失败/);
  });
});

describe("[T4] listDiscoveredBatches（发现 DTO，K5）", () => {
  it("并集 + layer + shadowed（就近层为有效命中）", () => {
    const parent = mkTmp();
    const cwd = path.join(parent, "child");
    fs.mkdirSync(cwd, { recursive: true });
    mkBatch(cwd, "widget");
    mkBatch(parent, "widget"); // 被 project 层遮蔽
    mkBatch(parent, "gadget");

    const items = listDiscoveredBatches("*", { cwd });
    // 仅断言 tmp 链上的 project/parent 两条命中（全局 ~/.done-coding 若存在同名不影响断言）
    const project = items.find(
      (i) => i.name === "widget" && i.layer === "project",
    );
    const parentHit = items.find(
      (i) => i.name === "widget" && i.layer === "parent",
    );
    expect(project).toBeDefined();
    expect(parentHit).toBeDefined();
    // 就近层有效、父层被遮蔽
    expect(project!.shadowed).toBe(false);
    expect(parentHit!.shadowed).toBe(true);
    expect(items.some((i) => i.name === "gadget")).toBe(true);
    // 发现 DTO 形状（合法批次 [MUST NOT] 含 serializer 字段 / invalid）
    expect(Object.keys(project!).sort()).toEqual([
      "layer",
      "name",
      "shadowed",
      "source",
    ]);
  });

  it("M1：无 index.json 的目录被标注 invalid + errors（不当正常批次、不静默吞）", () => {
    const cwd = mkTmp();
    mkBatch(cwd, "good"); // 合法批次
    // 非法：目录存在但无 index.json
    fs.mkdirSync(path.join(cwd, ".done-coding", "broken"), { recursive: true });

    const items = listDiscoveredBatches("*", { cwd });
    const good = items.find((i) => i.name === "good" && i.layer === "project");
    const broken = items.find(
      (i) => i.name === "broken" && i.layer === "project",
    );
    expect(good).toBeDefined();
    expect(good!.invalid).toBeUndefined(); // 合法不标 invalid
    expect(broken).toBeDefined();
    expect(broken!.invalid).toBe(true);
    expect(broken!.errors?.join("\n")).toMatch(/index\.json/);
  });

  it("M1：index.json.config 不可解析的目录被标注 invalid", () => {
    const cwd = mkTmp();
    const dir = path.join(cwd, ".done-coding", "badconf");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.json"),
      `{ "config": "./config.json5" }`,
    );
    fs.writeFileSync(path.join(dir, "config.json5"), `{ not valid json5 `);

    const items = listDiscoveredBatches("*", { cwd });
    const bad = items.find((i) => i.name === "badconf");
    expect(bad?.invalid).toBe(true);
    expect(bad?.errors?.join("\n")).toMatch(/解析失败/);
  });
});
