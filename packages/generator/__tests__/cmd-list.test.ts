/**
 * [T5] list 命令面用例（design §4.1/§6.4，K5 两套 DTO 不串）。
 *
 * 隔离策略：mock batch-discovery（发现 list / discoverBatch）与 instance-dir，
 * 专测「发现 DTO vs 实例 serializer」两套 DTO 不互相复用、-o 落地形状。
 * env-context 用真实实现（createEnvContext，纯函数，不依赖 T4 落地）——若 T4 未实现则该 case 依赖 T4。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BatchConfig,
  DiscoveredBatchListItem,
  GeneratorHandler,
  ResolvedBatch,
} from "@/types";

let tmpRoot: string;

const discoverSpy = vi.fn();
const listDiscoveredSpy = vi.fn<[], DiscoveredBatchListItem[]>(() => []);
const resolveInstanceDirSpy = vi.fn();

vi.mock("@/core/batch-discovery", () => ({
  discoverBatch: (...a: unknown[]) => discoverSpy(...(a as [])),
  listDiscoveredBatches: () => listDiscoveredSpy(),
  readBatchConfig: vi.fn(),
}));
vi.mock("@/core/instance-dir", () => ({
  resolveInstanceDir: (...a: unknown[]) => resolveInstanceDirSpy(...(a as [])),
  removeEmptyInstanceDir: vi.fn(),
}));
vi.mock("@/core/env-context", () => ({
  createEnvContext: (rawName: string, opts: Record<string, unknown>) => ({
    name: rawName.charAt(0).toUpperCase() + rawName.slice(1),
    nameKebab: rawName,
    rawName,
    $: "$",
    _: {},
    ...opts,
  }),
  createEnvHelpers: vi.fn(() => ({})),
}));

let listHandler: GeneratorHandler;
let tableSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dc-generator-list-"));
  discoverSpy.mockReset();
  listDiscoveredSpy.mockReset();
  resolveInstanceDirSpy.mockReset();
  ({ handler: listHandler } = await import("@/handlers/list"));
  const utils = await import("@done-coding/cli-utils");
  tableSpy = vi
    .spyOn(utils.outputConsole, "table")
    .mockImplementation((() => {}) as never);
});

afterEach(() => {
  tableSpy?.mockRestore();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("[T5] dc-generator list（两套 DTO 不串，K5）", () => {
  it("无 type → 发现 DTO {name,source,layer,shadowed}，不写 component-name-list.json", async () => {
    listDiscoveredSpy.mockReturnValue([
      { name: "widget", source: "widget", layer: "project", shadowed: false },
      { name: "page", source: "page", layer: "parent", shadowed: true },
    ]);
    await listHandler({}, { mode: "test", cwd: tmpRoot });

    expect(listDiscoveredSpy).toHaveBeenCalled();
    expect(discoverSpy).not.toHaveBeenCalled();
    // 无 type 不应落地任何 json（不复用实例 serializer）
    const files = fs.readdirSync(tmpRoot);
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(0);
  });

  it("带 type + -o → 按 listSerializer 落地（字段序 + 不排序 + 2 空格 + 无尾换行）", async () => {
    // tmp 造实例：scanRoot/<nameKebab>/
    const scanRoot = path.join(tmpRoot, "src", "widget");
    fs.mkdirSync(path.join(scanRoot, "beta"), { recursive: true });
    fs.mkdirSync(path.join(scanRoot, "alpha"), { recursive: true });
    fs.mkdirSync(path.join(scanRoot, "index"), { recursive: true }); // 被 nameExcludes 过滤

    const config: BatchConfig = {
      instanceDir: `${scanRoot}/\${nameKebab}`,
      list: { mode: "subdir", nameExcludes: ["index"] },
      files: [],
      listSerializer: {
        fields: ["name", "nameKebab"],
        sort: false,
        indent: 2,
        pathResolveBase: "cwd",
      },
    };
    const batch: ResolvedBatch = {
      type: "widget",
      hit: {
        segment: "widget",
        dir: "/x",
        namespaceDir: "/x",
        realDir: "/x",
        layer: "project",
        shadowed: false,
      },
      config,
    };
    discoverSpy.mockReturnValue(batch);
    // resolveInstanceDir：返回 scanRoot/<nameKebab>，使 dirname=scanRoot
    resolveInstanceDirSpy.mockImplementation(
      (_cfg: BatchConfig, env: { nameKebab: string }) =>
        path.join(scanRoot, env.nameKebab),
    );

    const outPath = path.join(tmpRoot, "out", "name-list.json");
    await listHandler(
      { type: "widget", output: outPath },
      { mode: "test", cwd: tmpRoot },
    );

    const raw = fs.readFileSync(outPath, "utf-8");
    // 无尾换行
    expect(raw.endsWith("\n")).toBe(false);
    const parsed = JSON.parse(raw) as Array<Record<string, string>>;
    // 字段序严格 + readdir 原序（不排序），过滤 index
    const names = parsed.map((p) => p.nameKebab);
    expect(names).not.toContain("index");
    expect(names.sort()).toEqual(["alpha", "beta"]);
    // 字段集 = serializer.fields（content-free，不含 source/layer）
    expect(Object.keys(parsed[0])).toEqual(["name", "nameKebab"]);
  });
});
