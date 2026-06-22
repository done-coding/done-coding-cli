import { describe, expect, it } from "vitest";
import { isTemplateCopyIgnored } from "@/utils/templateSource";

describe("isTemplateCopyIgnored", () => {
  it("只剥离 .git（clone 目录 / worktree 文件，basename 均为 .git）", () => {
    expect(isTemplateCopyIgnored("/tmp/repo/.git")).toBe(true);
    expect(isTemplateCopyIgnored("/tmp/repo/packages/x/.git")).toBe(true);
  });

  it("不再误删任意深度的 types/es/lib 等同名源码目录", () => {
    // 回归：旧实现把 basename 命中黑名单的全删，导致 src/types 丢失、生成项目编译失败
    expect(isTemplateCopyIgnored("/tmp/repo/src/types")).toBe(false);
    expect(isTemplateCopyIgnored("/tmp/repo/src/types/index.ts")).toBe(false);
    expect(isTemplateCopyIgnored("/tmp/repo/src/es")).toBe(false);
    expect(isTemplateCopyIgnored("/tmp/repo/src/lib")).toBe(false);
  });

  it("构建产物/依赖不再按名过滤（干净 git 检出中本就不存在，无需过滤）", () => {
    expect(isTemplateCopyIgnored("/tmp/repo/node_modules")).toBe(false);
    expect(isTemplateCopyIgnored("/tmp/repo/dist")).toBe(false);
    expect(isTemplateCopyIgnored("/tmp/repo/coverage")).toBe(false);
  });
});
