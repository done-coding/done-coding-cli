import { describe, it, expect } from "vitest";
import { compileTemplate } from "@/utils/compile-common";
import { handler as batchCompileHandler } from "@/handlers/batch-compile";
import { OutputModeEnum } from "@/types";
import { DEFAULT_MARKER_NS } from "@/utils/marker";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

describe("INSERT 路径 markerNs 必填", () => {
  it("缺 markerNs → fail-loud", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-mns-"));
    const target = path.join(dir, "f.ts");
    fs.writeFileSync(target, "// anchor\n");
    await expect(
      compileTemplate(
        {
          inputData: "x",
          output: target,
          mode: OutputModeEnum.INSERT,
          anchor: { pattern: "anchor", position: "after" },
          markerKey: "k",
          envData: {},
        },
        { rootDir: dir },
      ),
    ).rejects.toThrow(/markerNs/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("standalone batch insert 不回归", () => {
  it("markerNs=dc-template 注入 → 不抛错 + 产出含 === dc-template:start:", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-batch-ns-"));
    try {
      // 模板文件
      const tplFile = path.join(dir, "tpl.ts");
      fs.writeFileSync(tplFile, "const x = 1;\n");

      // 目标文件（带锚点）
      const targetFile = path.join(dir, "target.ts");
      fs.writeFileSync(targetFile, "// anchor\n");

      const paramsConfig = {
        list: [
          {
            input: "tpl.ts",
            output: "target.ts",
            mode: OutputModeEnum.INSERT,
            anchor: { pattern: "anchor", position: "after" as const },
            markerKey: "mykey",
            envData: "{}",
          },
        ],
      };

      // 模拟 standalone 入口注入 DEFAULT_MARKER_NS
      await batchCompileHandler(
        { rootDir: dir, markerNs: DEFAULT_MARKER_NS } as any,
        paramsConfig,
      );

      const result = fs.readFileSync(targetFile, "utf-8");
      expect(result).toContain("=== dc-template:start:");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
