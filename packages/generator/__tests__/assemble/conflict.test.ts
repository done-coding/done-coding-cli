/**
 * [A4] conflict 单测：格式化指名 provenance + assertNoConflicts throw 聚合。
 */
import { describe, expect, it } from "vitest";
import { assertNoConflicts, formatConflict } from "@/assemble/conflict";
import type { Conflict } from "@/assemble/types";

const C: Conflict = {
  recipeId: "subpackage-foo",
  file: "package.json",
  locator: "/dependencies/lodash",
  sides: [
    { opId: "pkg-base", source: "fragments/foo/package.json" },
    { opId: "pkg-ws", source: "fragments/_workspace/package.partial.json" },
  ],
  message: "同包异版本冲突：lodash",
};

describe("[A4] formatConflict", () => {
  it("指名 recipeId/file/locator/两侧 source", () => {
    const s = formatConflict(C);
    expect(s).toContain("subpackage-foo");
    expect(s).toContain("package.json");
    expect(s).toContain("/dependencies/lodash");
    expect(s).toContain("pkg-base");
    expect(s).toContain("pkg-ws");
    expect(s).toContain("fragments/foo/package.json");
    expect(s).toContain("同包异版本冲突");
  });

  it("file 未填时占位、无 locator/sides 时降级可读", () => {
    const c: Conflict = {
      recipeId: "r",
      file: "",
      sides: [],
      message: "m",
    };
    const s = formatConflict(c);
    expect(s).toContain("(待填)");
    expect(s).toContain("m");
  });
});

describe("[A4] assertNoConflicts", () => {
  it("空不抛", () => {
    expect(() => assertNoConflicts([])).not.toThrow();
  });

  it("非空 throw 聚合文案，含数量 + 各条细节", () => {
    expect(() => assertNoConflicts([C, C])).toThrow(/2 处冲突/);
    try {
      assertNoConflicts([C]);
    } catch (e) {
      expect((e as Error).message).toContain("/dependencies/lodash");
      expect((e as Error).message).toContain("subpackage-foo");
    }
  });
});
