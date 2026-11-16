import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { templatesHandler } from "../src/handlers/templates";

/**
 * `create templates`：与交互选单同源列模板，带 description（沙盒，只用显式 --templateConfig，不碰家目录）。
 */
describe("create templates", () => {
  let workDir = "";
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(workDir, { recursive: true, force: true });
  });

  it("--json 输出来源与完整清单；文本模式每项带描述、目录与分支", async () => {
    workDir = mkdtempSync(path.join(tmpdir(), "dc-create-templates-"));
    const manifest = path.join(workDir, "templates.manifest.json");
    writeFileSync(
      manifest,
      JSON.stringify({
        templateList: [
          {
            name: "app",
            url: "/repo/hub",
            directory: "templates/apps/app",
            description: "应用模板（admin 后台 / blank 空白壳）",
          },
          {
            name: "lib",
            url: "https://example.com/lib.git",
            branch: [{ name: "node", description: "Node 库" }],
          },
        ],
      }),
    );
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    await templatesHandler({ templateConfig: manifest, json: true } as any);
    const json = JSON.parse(out.join(""));
    expect(json.source).toBe(manifest);
    expect(json.templateList.map((t: any) => t.name)).toEqual(["app", "lib"]);

    out.length = 0;
    await templatesHandler({ templateConfig: manifest } as any);
    expect(out.join("")).toBe(
      "app — 应用模板（admin 后台 / blank 空白壳）\n    /repo/hub；目录 templates/apps/app；默认分支\n" +
        "lib — （无描述）\n    https://example.com/lib.git；分支：node（Node 库）\n",
    );
  });
});
