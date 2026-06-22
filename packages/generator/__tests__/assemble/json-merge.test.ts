/**
 * [A2] json-merge 单测：对象递归 / 标量异值冲突 / 同包异版本冲突 / files union /
 * exports 不排序 / workspaces error / fieldPolicy 覆盖 / 确定性序列化 / 风格探测。
 */
import { describe, expect, it } from "vitest";
import {
  assertNoConflict,
  detectJsonStyle,
  jsonMerge,
  stringifyJsonDeterministic,
} from "@/assemble/json-merge";

const OPTS = {
  recipeId: "r1",
  baseSource: "base.json",
  patchSource: "patch.json",
};

describe("[A2] jsonMerge 对象递归 + 标量", () => {
  it("对象深合并，新增 key", () => {
    const { result, conflicts } = jsonMerge(
      { a: { x: 1 }, name: "n" },
      { a: { y: 2 }, version: "1.0.0" },
      OPTS,
    );
    expect(conflicts).toHaveLength(0);
    expect(result).toEqual({ a: { x: 1, y: 2 }, name: "n", version: "1.0.0" });
  });

  it("标量同 key 相等保留、异值冲突", () => {
    expect(
      jsonMerge({ name: "n" }, { name: "n" }, OPTS).conflicts,
    ).toHaveLength(0);
    const { conflicts } = jsonMerge({ name: "a" }, { name: "b" }, OPTS);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].locator).toBe("/name");
    expect(conflicts[0].recipeId).toBe("r1");
    expect(conflicts[0].sides).toHaveLength(2);
  });

  it("类型不符冲突（object vs 标量）", () => {
    const { conflicts } = jsonMerge({ a: { x: 1 } }, { a: "str" }, OPTS);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].locator).toBe("/a");
  });
});

describe("[A2] deps 同包异版本冲突（D-H8）", () => {
  it("同包同版本 OK，异版本冲突", () => {
    const ok = jsonMerge(
      { dependencies: { lodash: "^4.0.0" } },
      { dependencies: { lodash: "^4.0.0", vue: "^3.0.0" } },
      OPTS,
    );
    expect(ok.conflicts).toHaveLength(0);
    expect(ok.result).toEqual({
      dependencies: { lodash: "^4.0.0", vue: "^3.0.0" },
    });

    const bad = jsonMerge(
      { devDependencies: { typescript: "^5.0.0" } },
      { devDependencies: { typescript: "^4.0.0" } },
      OPTS,
    );
    expect(bad.conflicts).toHaveLength(1);
    expect(bad.conflicts[0].locator).toBe("/devDependencies/typescript");
  });
});

describe("[A2] 数组策略（D-H8）", () => {
  it("files/keywords/man 去重并集保序", () => {
    const { result, conflicts } = jsonMerge(
      { files: ["es", "lib"], keywords: ["a"] },
      { files: ["lib", "types"], keywords: ["a", "b"] },
      OPTS,
    );
    expect(conflicts).toHaveLength(0);
    expect(result).toEqual({
      files: ["es", "lib", "types"],
      keywords: ["a", "b"],
    });
  });

  it("白名单外数组异值冲突（不静默拼接）", () => {
    const { conflicts } = jsonMerge(
      { custom: [1, 2] },
      { custom: [3, 4] },
      OPTS,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].locator).toBe("/custom");
  });

  it("白名单外数组相等保留", () => {
    expect(
      jsonMerge({ custom: [1] }, { custom: [1] }, OPTS).conflicts,
    ).toHaveLength(0);
  });
});

describe("[A2] scripts/bin 对象同名异值冲突（D-H8）", () => {
  it("scripts 新增 OK，同名异值冲突", () => {
    const ok = jsonMerge(
      { scripts: { build: "vite build" } },
      { scripts: { test: "vitest" } },
      OPTS,
    );
    expect(ok.conflicts).toHaveLength(0);
    expect(ok.result).toEqual({
      scripts: { build: "vite build", test: "vitest" },
    });
    const bad = jsonMerge(
      { scripts: { build: "a" } },
      { scripts: { build: "b" } },
      OPTS,
    );
    expect(bad.conflicts).toHaveLength(1);
    expect(bad.conflicts[0].locator).toBe("/scripts/build");
  });
});

describe("[A2] exports/imports 不排序、仅相等或新增（D-H8）", () => {
  it("新增条件 key 直接接受、保留插入顺序", () => {
    const { result, conflicts } = jsonMerge(
      { exports: { ".": { import: "./es/index.mjs" } } },
      { exports: { "./sub": { import: "./es/sub.mjs" } } },
      OPTS,
    );
    expect(conflicts).toHaveLength(0);
    // 插入顺序：base 在前，新增追加（不排序）
    expect(Object.keys((result as { exports: object }).exports)).toEqual([
      ".",
      "./sub",
    ]);
  });

  it("同 key 异值冲突", () => {
    const { conflicts } = jsonMerge(
      { exports: { ".": "./a.mjs" } },
      { exports: { ".": "./b.mjs" } },
      OPTS,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].locator).toBe("/exports/.");
  });
});

describe("[A2] error 字段（workspaces/overrides...）默认 error（D-H8）", () => {
  it("workspaces 异值冲突，不自动合并", () => {
    const { conflicts } = jsonMerge(
      { workspaces: ["packages/*"] },
      { workspaces: ["apps/*"] },
      OPTS,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].locator).toBe("/workspaces");
  });

  it("overrides 相等保留无冲突", () => {
    expect(
      jsonMerge({ overrides: { foo: "1" } }, { overrides: { foo: "1" } }, OPTS)
        .conflicts,
    ).toHaveLength(0);
  });
});

describe("[A2] fieldPolicy 按 pointer 覆盖（A-NFR-4）", () => {
  it("replace 覆盖：用 patch 值", () => {
    const { result, conflicts } = jsonMerge(
      { workspaces: ["packages/*"] },
      { workspaces: ["apps/*"] },
      { ...OPTS, fieldPolicy: { "/workspaces": "replace" } },
    );
    expect(conflicts).toHaveLength(0);
    expect(result).toEqual({ workspaces: ["apps/*"] });
  });

  it("union 覆盖：数组并集", () => {
    const { result, conflicts } = jsonMerge(
      { custom: [1, 2] },
      { custom: [2, 3] },
      { ...OPTS, fieldPolicy: { "/custom": "union" } },
    );
    expect(conflicts).toHaveLength(0);
    expect(result).toEqual({ custom: [1, 2, 3] });
  });

  it("error 覆盖：异值冲突", () => {
    const { conflicts } = jsonMerge(
      { name: "a" },
      { name: "b" },
      { ...OPTS, fieldPolicy: { "/name": "error" } },
    );
    expect(conflicts).toHaveLength(1);
  });
});

describe("[A2] assertNoConflict", () => {
  it("空不抛，非空抛聚合", () => {
    expect(() => assertNoConflict([])).not.toThrow();
    const { conflicts } = jsonMerge({ name: "a" }, { name: "b" }, OPTS);
    expect(() => assertNoConflict(conflicts)).toThrow(/冲突/);
  });
});

describe("[A2] 确定性序列化 + 风格探测", () => {
  it("默认 2 空格 LF 末换行，保留 key 插入顺序（不排序）", () => {
    const out = stringifyJsonDeterministic({ b: 1, a: 2 });
    expect(out).toBe('{\n  "b": 1,\n  "a": 2\n}\n');
  });

  it("可配缩进/EOL", () => {
    const out = stringifyJsonDeterministic(
      { a: 1 },
      { indent: 4, eol: "\r\n" },
    );
    expect(out).toBe('{\r\n    "a": 1\r\n}\r\n');
  });

  it("detectJsonStyle 探测缩进 + EOL", () => {
    expect(detectJsonStyle('{\n  "a": 1\n}\n')).toEqual({
      indent: 2,
      eol: "\n",
    });
    expect(detectJsonStyle('{\r\n    "a": 1\r\n}\r\n')).toEqual({
      indent: 4,
      eol: "\r\n",
    });
  });
});
