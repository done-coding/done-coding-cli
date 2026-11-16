import { describe, expect, it } from "vitest";
import { createMatcher, expandBraces, invalidPattern } from "@/core/glob";

const matches = (pattern: string, file: string): boolean =>
  createMatcher([pattern])(file);

describe("glob：仓根相对路径模式", () => {
  it("无通配：精确文件，或目录覆盖其下全部文件（末尾 / 同义）", () => {
    expect(matches("src/a.ts", "src/a.ts")).toBe(true);
    expect(matches("src/a.ts", "src/a.tsx")).toBe(false);
    expect(matches("src/domains/a", "src/domains/a/x/y.ts")).toBe(true);
    expect(matches("src/domains/a/", "src/domains/a/x.ts")).toBe(true);
    expect(matches("src/domains/a/", "src/domains/ab/x.ts")).toBe(false);
  });

  it("** 跨目录、* 不跨 /、? 单字符、[...] 字符类", () => {
    expect(matches("svc/**", "svc/a/b/c.py")).toBe(true);
    expect(matches("svc/**/test_*.py", "svc/test_a.py")).toBe(true);
    expect(matches("svc/**/test_*.py", "svc/x/y/test_a.py")).toBe(true);
    expect(matches("tests/test_note_*.py", "tests/test_note_a.py")).toBe(true);
    expect(matches("tests/*.py", "tests/sub/a.py")).toBe(false);
    expect(matches("a?.ts", "ab.ts")).toBe(true);
    expect(matches("[ab].ts", "c.ts")).toBe(false);
  });

  it("命中目录的通配覆盖其下文件", () => {
    expect(
      matches("src/pages/readings-*", "src/pages/readings-x/index.vue"),
    ).toBe(true);
    expect(
      matches("src/pages/*/page.route.ts", "src/pages/a/page.route.ts"),
    ).toBe(true);
  });

  it("{a,b} 展开（可嵌套）", () => {
    expect(expandBraces("sdk/src/{schemas,methods}/x.ts")).toEqual([
      "sdk/src/schemas/x.ts",
      "sdk/src/methods/x.ts",
    ]);
    expect(expandBraces("a/{b,c{1,2}}/d")).toEqual([
      "a/b/d",
      "a/c1/d",
      "a/c2/d",
    ]);
    expect(
      matches("app/{__init__,main}.py", "app/main.py") &&
        !matches("app/{__init__,main}.py", "app/db.py"),
    ).toBe(true);
  });

  it("拒绝绝对路径、.. 与不配对花括号", () => {
    expect(invalidPattern("/abs/x")).toBe("须为仓根相对路径");
    expect(invalidPattern("a/../b")).toBe("不得含 ..");
    expect(invalidPattern("a/{b,c")).toBe("花括号不配对");
    expect(invalidPattern("a/b/**")).toBeUndefined();
  });
});
