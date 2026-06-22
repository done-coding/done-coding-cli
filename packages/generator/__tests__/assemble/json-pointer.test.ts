/**
 * [A1] json-pointer 单测：get/has/delete + 不存在 throw + RFC 6901 转义 + 数组/根。
 */
import { describe, expect, it } from "vitest";
import {
  deleteByPointer,
  getByPointer,
  hasPointer,
  parsePointer,
} from "@/assemble/json-pointer";

describe("[A1] parsePointer 转义与根", () => {
  it('根 "" → []', () => {
    expect(parsePointer("")).toEqual([]);
  });

  it("~1 → / ，~0 → ~（顺序敏感）", () => {
    expect(parsePointer("/a~1b/c~0d")).toEqual(["a/b", "c~d"]);
    // "~01" 应先 ~1→? 否：~0→~ 后再 ... RFC：先 ~1 后 ~0；"~01" → ~1 不匹配，~0→~ 得 "~1"
    expect(parsePointer("/~01")).toEqual(["~1"]);
  });

  it("非空非 / 起头 → throw", () => {
    expect(() => parsePointer("a/b")).toThrow();
  });
});

describe("[A1] getByPointer", () => {
  const obj = {
    name: "x",
    scripts: { push: "p", "a/b": "slash", "c~d": "tilde" },
    arr: [10, 20, { deep: true }],
  };

  it("根返回自身", () => {
    expect(getByPointer(obj, "")).toBe(obj);
  });

  it("对象 / 嵌套 / 转义 key", () => {
    expect(getByPointer(obj, "/name")).toBe("x");
    expect(getByPointer(obj, "/scripts/push")).toBe("p");
    expect(getByPointer(obj, "/scripts/a~1b")).toBe("slash");
    expect(getByPointer(obj, "/scripts/c~0d")).toBe("tilde");
  });

  it("数组索引 + 嵌套", () => {
    expect(getByPointer(obj, "/arr/0")).toBe(10);
    expect(getByPointer(obj, "/arr/2/deep")).toBe(true);
  });

  it("不存在返回 undefined（不 throw）", () => {
    expect(getByPointer(obj, "/nope")).toBeUndefined();
    expect(getByPointer(obj, "/arr/9")).toBeUndefined();
    expect(getByPointer(obj, "/name/sub")).toBeUndefined();
  });
});

describe("[A1] hasPointer", () => {
  const obj = { a: { b: 1 }, arr: [1] };
  it("存在/不存在", () => {
    expect(hasPointer(obj, "")).toBe(true);
    expect(hasPointer(obj, "/a/b")).toBe(true);
    expect(hasPointer(obj, "/a/c")).toBe(false);
    expect(hasPointer(obj, "/arr/0")).toBe(true);
    expect(hasPointer(obj, "/arr/1")).toBe(false);
  });
  it("key 存在但值 undefined 视为存在", () => {
    expect(hasPointer({ a: undefined }, "/a")).toBe(true);
  });
});

describe("[A1] deleteByPointer", () => {
  it("删除对象 key（原地）", () => {
    const obj: Record<string, unknown> = { scripts: { push: "p", build: "b" } };
    deleteByPointer(obj, "/scripts/push");
    expect(obj).toEqual({ scripts: { build: "b" } });
  });

  it("删除数组元素（splice 保序）", () => {
    const obj = { arr: [1, 2, 3] };
    deleteByPointer(obj, "/arr/1");
    expect(obj.arr).toEqual([1, 3]);
  });

  it("转义 key 删除", () => {
    const obj: Record<string, unknown> = { "a/b": 1, "c~d": 2 };
    deleteByPointer(obj, "/a~1b");
    deleteByPointer(obj, "/c~0d");
    expect(obj).toEqual({});
  });

  it("pointer 不存在 → throw（D-H5/C5）", () => {
    expect(() => deleteByPointer({ a: 1 }, "/nope")).toThrow();
    expect(() => deleteByPointer({ a: { b: 1 } }, "/a/c")).toThrow();
    expect(() => deleteByPointer({ arr: [1] }, "/arr/9")).toThrow();
  });

  it("中途遇非容器 → throw", () => {
    expect(() => deleteByPointer({ a: 1 }, "/a/b")).toThrow();
  });

  it("删数组深处元素（中途穿过数组索引 parent）", () => {
    const obj = { arr: [{ inner: { k: 1 } }] };
    deleteByPointer(obj, "/arr/0/inner/k");
    expect(obj.arr[0].inner).toEqual({});
  });

  it("中途数组索引越界 → throw（mid-path array 分支）", () => {
    expect(() => deleteByPointer({ arr: [1] }, "/arr/9/x")).toThrow(/越界/);
  });

  it("中途遇非容器（深层）→ throw（mid-path isContainer 分支）", () => {
    expect(() => deleteByPointer({ a: { b: 1 } }, "/a/b/c")).toThrow(/非容器/);
  });

  it("中途对象缺 key → throw（mid-path missing key 分支）", () => {
    expect(() => deleteByPointer({ a: { b: 1 } }, "/a/x/y")).toThrow(
      /路径不存在/,
    );
  });

  it('删根 "" → throw', () => {
    expect(() => deleteByPointer({ a: 1 }, "")).toThrow();
  });
});
