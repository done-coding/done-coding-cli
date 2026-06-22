/**
 * [C0] recipe 加载/校验单测（D-L1）：JSON5 解析 / 必填校验 / op id 唯一 /
 * jsonMerge·deleteField .json 约束 / discoverRecipes 约定目录。
 * 沙盒：fixtures 落 os.tmpdir()，afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverRecipes,
  fragmentRoot,
  loadRecipe,
  recipeDir,
  validateRecipe,
} from "@/assemble/recipe";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-"));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const writeRecipe = (name: string, content: string): string => {
  const dir = recipeDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, "utf-8");
  return p;
};

describe("[C0] loadRecipe", () => {
  it("解析合法 JSON5 配方（含注释/无引号 key）", () => {
    const p = writeRecipe(
      "ok.json5",
      `{
        // 拼装配方
        id: "foo",
        base: { kind: "empty" },
        output: "out/foo",
        ops: [
          { type: "addFragment", id: "src", source: "foo/src", target: "src" },
        ],
      }`,
    );
    const r = loadRecipe(p);
    expect(r.id).toBe("foo");
    expect(r.base.kind).toBe("empty");
    expect(r.ops).toHaveLength(1);
  });

  it("文件不存在 → throw", () => {
    expect(() => loadRecipe(path.join(root, "nope.json5"))).toThrow(/不存在/);
  });

  it("JSON5 非法 → throw（带文件名）", () => {
    const p = writeRecipe("bad.json5", "{ id: ");
    expect(() => loadRecipe(p)).toThrow(/解析失败/);
  });

  it("缺 id / output / ops → fail-loud", () => {
    expect(() =>
      validateRecipe({ base: { kind: "empty" }, output: "o", ops: [] }, "t"),
    ).toThrow(/缺 id/);
    expect(() =>
      validateRecipe({ id: "x", base: { kind: "empty" }, ops: [] }, "t"),
    ).toThrow(/缺 output/);
    expect(() =>
      validateRecipe({ id: "x", base: { kind: "empty" }, output: "o" }, "t"),
    ).toThrow(/缺 ops/);
  });

  it("op id 配方内重复 → fail-loud", () => {
    expect(() =>
      validateRecipe(
        {
          id: "x",
          base: { kind: "empty" },
          output: "o",
          ops: [
            { type: "addFragment", id: "dup", source: "a", target: "a" },
            { type: "addFragment", id: "dup", source: "b", target: "b" },
          ],
        },
        "t",
      ),
    ).toThrow(/重复/);
  });

  it("op 缺 type/target → fail-loud", () => {
    expect(() =>
      validateRecipe(
        { id: "x", base: { kind: "empty" }, output: "o", ops: [{ id: "a" }] },
        "t",
      ),
    ).toThrow(/缺 type/);
  });

  it("jsonMerge source/target 非 .json → fail-loud（D-L1）", () => {
    expect(() =>
      validateRecipe(
        {
          id: "x",
          base: { kind: "empty" },
          output: "o",
          ops: [
            {
              type: "jsonMerge",
              id: "m",
              source: "p.json5",
              target: "package.json",
            },
          ],
        },
        "t",
      ),
    ).toThrow(/\.json/);
  });

  it("deleteField 缺合法 pointer → fail-loud", () => {
    expect(() =>
      validateRecipe(
        {
          id: "x",
          base: { kind: "dir", from: "src" },
          output: "o",
          ops: [{ type: "deleteField", id: "d", target: "package.json" }],
        },
        "t",
      ),
    ).toThrow(/pointer/);
  });

  it("base.kind=dir 缺 from → fail-loud", () => {
    expect(() =>
      validateRecipe(
        { id: "x", base: { kind: "dir" }, output: "o", ops: [] },
        "t",
      ),
    ).toThrow(/from/);
  });

  it("createTemplate 缺 configPath/name → fail-loud", () => {
    expect(() =>
      validateRecipe(
        {
          id: "x",
          base: { kind: "empty" },
          output: "o",
          ops: [],
          createTemplate: { name: "n" },
        },
        "t",
      ),
    ).toThrow(/configPath/);
  });
});

describe("[C0] validateRecipe 边缘校验分支补齐", () => {
  const minimal = (over: Record<string, unknown>): unknown => ({
    id: "x",
    base: { kind: "empty" },
    output: "o",
    ops: [],
    ...over,
  });

  it("配方根非对象 → fail-loud", () => {
    expect(() => validateRecipe("not-an-object", "t")).toThrow(/根/);
    expect(() => validateRecipe(["arr"], "t")).toThrow(/根/);
    expect(() => validateRecipe(null, "t")).toThrow(/根/);
  });

  it("base 非对象 → fail-loud", () => {
    expect(() =>
      validateRecipe({ id: "x", base: "empty", output: "o", ops: [] }, "t"),
    ).toThrow(/base \[MUST\] 为对象/);
  });

  it("base.kind 非 empty/dir → fail-loud", () => {
    expect(() =>
      validateRecipe(
        { id: "x", base: { kind: "weird" }, output: "o", ops: [] },
        "t",
      ),
    ).toThrow(/base\.kind/);
  });

  it("base.kind=dir 携带 exclude 数组 → 透传保留", () => {
    const r = validateRecipe(
      minimal({
        base: { kind: "dir", from: "src", exclude: ["node_modules"] },
      }),
      "t",
    );
    expect(r.base).toEqual({
      kind: "dir",
      from: "src",
      exclude: ["node_modules"],
    });
  });

  it("op 非对象 → fail-loud", () => {
    expect(() => validateRecipe(minimal({ ops: ["not-obj"] }), "t")).toThrow(
      /ops\[0\] \[MUST\] 为对象/,
    );
  });

  it("op 缺 id → fail-loud", () => {
    expect(() =>
      validateRecipe(
        minimal({ ops: [{ type: "addFragment", target: "a" }] }),
        "t",
      ),
    ).toThrow(/缺 id/);
  });

  it("op 缺 target → fail-loud", () => {
    expect(() =>
      validateRecipe(minimal({ ops: [{ type: "addFragment", id: "a" }] }), "t"),
    ).toThrow(/缺 target/);
  });

  it("addFragment 缺 source → fail-loud", () => {
    expect(() =>
      validateRecipe(
        minimal({ ops: [{ type: "addFragment", id: "a", target: "a.txt" }] }),
        "t",
      ),
    ).toThrow(/缺 source/);
  });

  it("textPatch 缺 source → fail-loud", () => {
    expect(() =>
      validateRecipe(
        minimal({ ops: [{ type: "textPatch", id: "a", target: "a.txt" }] }),
        "t",
      ),
    ).toThrow(/缺 source/);
  });

  it("createTemplate 非对象 → fail-loud", () => {
    expect(() =>
      validateRecipe(minimal({ createTemplate: "nope" }), "t"),
    ).toThrow(/createTemplate \[MUST\] 为对象/);
  });

  it("createTemplate 缺 name → fail-loud", () => {
    expect(() =>
      validateRecipe(
        minimal({ createTemplate: { configPath: "c.json" } }),
        "t",
      ),
    ).toThrow(/缺 name/);
  });

  it("createTemplate 含 description → 透传保留", () => {
    const r = validateRecipe(
      minimal({
        createTemplate: { configPath: "c.json", name: "n", description: "d" },
      }),
      "t",
    );
    expect(r.createTemplate).toEqual({
      configPath: "c.json",
      name: "n",
      description: "d",
    });
  });

  it("vars 对象 → 透传保留", () => {
    const r = validateRecipe(minimal({ vars: { k: "v" } }), "t");
    expect(r.vars).toEqual({ k: "v" });
  });
});

describe("[C0] discoverRecipes / 约定路径", () => {
  it("约定 assemble/recipes/*.json5（字典序）；非 json5 忽略", () => {
    writeRecipe(
      "b.json5",
      `{ id:"b", base:{kind:"empty"}, output:"ob", ops:[] }`,
    );
    writeRecipe(
      "a.json5",
      `{ id:"a", base:{kind:"empty"}, output:"oa", ops:[] }`,
    );
    writeRecipe("note.txt", "x");
    const found = discoverRecipes(root);
    expect(found.map((f) => path.basename(f))).toEqual(["a.json5", "b.json5"]);
  });

  it("目录不存在 → 空数组", () => {
    expect(discoverRecipes(path.join(root, "empty"))).toEqual([]);
  });

  it("fragmentRoot/recipeDir 约定", () => {
    expect(recipeDir(root)).toBe(path.resolve(root, "assemble", "recipes"));
    expect(fragmentRoot(root)).toBe(
      path.resolve(root, "assemble", "fragments"),
    );
  });
});
