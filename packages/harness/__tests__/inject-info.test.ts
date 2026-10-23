import { describe, expect, it } from "vitest";
import injectInfo from "@/injectInfo.json";

// 骨架冒烟：dc-inject 按 .done-coding/inject.json 注入的包身份正确（模板占位符已替换为实值）
describe("cli-harness 包身份", () => {
  it("injectInfo 与包名 / 模块名 / 命名空间一致", () => {
    expect(injectInfo.name).toBe("@done-coding/cli-harness");
    expect(injectInfo.bin).toEqual({ "dc-harness": "es/cli.mjs" });
    expect(injectInfo.cliConfig.moduleName).toBe("harness");
    expect(injectInfo.cliConfig.namespaceDir).toBe(".done-coding");
  });
});
