/**
 * [B2] registry 单测：注册/分发/未知 fail/列已注册/扩展口加一条 + registerBuiltinOps（D-H3）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpHandler } from "@/assemble/types";
import {
  hasOp,
  listOps,
  registerBuiltinOps,
  registerOp,
  resolveOp,
  unregisterAll,
} from "@/assemble/registry";

const fakeHandler: OpHandler = {
  effects: (op) => [{ target: op.target, kind: "write-whole" }],
  apply: () => ({ changed: true, conflicts: [] }),
};

describe("[B2] registry 注册 / 分发 / 未知 fail", () => {
  beforeEach(() => unregisterAll());
  afterEach(() => unregisterAll());

  it("registerOp + resolveOp 命中", () => {
    registerOp("custom", fakeHandler);
    expect(resolveOp("custom")).toBe(fakeHandler);
    expect(hasOp("custom")).toBe(true);
  });

  it("未知 type → throw 并列已注册（C3）", () => {
    registerOp("a", fakeHandler);
    registerOp("b", fakeHandler);
    expect(() => resolveOp("zzz")).toThrow(/未知 op type.*zzz/);
    expect(() => resolveOp("zzz")).toThrow(/a, b/);
  });

  it("listOps 字典序", () => {
    registerOp("zeta", fakeHandler);
    registerOp("alpha", fakeHandler);
    expect(listOps()).toEqual(["alpha", "zeta"]);
  });

  it("扩展口：新增一条 op 不需改 registry 核心", () => {
    registerBuiltinOps();
    const before = listOps().length;
    registerOp("yamlMerge", fakeHandler);
    expect(listOps().length).toBe(before + 1);
    expect(resolveOp("yamlMerge")).toBe(fakeHandler);
  });
});

describe("[B2] registerBuiltinOps 装配 5 内建", () => {
  beforeEach(() => unregisterAll());
  afterEach(() => unregisterAll());

  it("装配后 5 内建均可 resolve（幂等）", () => {
    registerBuiltinOps();
    registerBuiltinOps(); // 幂等
    for (const t of [
      "addFragment",
      "textPatch",
      "jsonMerge",
      "deleteFile",
      "deleteField",
    ]) {
      expect(hasOp(t)).toBe(true);
      expect(typeof resolveOp(t).effects).toBe("function");
    }
  });
});
