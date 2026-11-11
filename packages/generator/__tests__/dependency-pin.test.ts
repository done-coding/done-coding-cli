/**
 * 发布依赖钉版回归（issue 7ssnjg）：lodash.template 4.18.0 在 npm 上损坏
 * （`assignWith is not defined`），范围版本会让全新安装解析到它，tree build/check 全挂。
 * 本仓锁文件钉在 4.5.0，单测无法暴露该问题，故直接断言发布声明为精确版本。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), "utf8"),
) as { dependencies: Record<string, string> };

describe("发布依赖钉版", () => {
  it("lodash.template 钉精确版本 4.5.0（避开损坏的 4.18.0）", () => {
    expect(pkg.dependencies["lodash.template"]).toBe("4.5.0");
  });
});
