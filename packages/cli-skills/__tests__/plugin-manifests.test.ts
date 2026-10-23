import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PLUGIN_NAME,
  buildPluginManifests,
  writePluginManifests,
} from "../scripts/plugin-manifests.mjs";
import pkg from "../package.json";

/**
 * 插件清单生成单测（沙盒）：版本只认 package.json，两份清单随包发布。
 */
describe("插件清单", () => {
  let pkgRoot: string;

  beforeEach(() => {
    pkgRoot = mkdtempSync(path.join(tmpdir(), "dc-skills-plugin-"));
  });

  afterEach(() => {
    rmSync(pkgRoot, { recursive: true, force: true });
  });

  it("两份清单的名称 / 版本 / 许可取自 package.json", () => {
    const manifests = buildPluginManifests({
      version: "9.8.7",
      author: "someone",
      license: "MIT",
    }) as Record<string, Record<string, unknown>>;
    expect(Object.keys(manifests).sort()).toEqual([
      ".claude-plugin/plugin.json",
      ".codex-plugin/plugin.json",
    ]);
    for (const manifest of Object.values(manifests)) {
      expect(manifest).toMatchObject({
        name: PLUGIN_NAME,
        version: "9.8.7",
        license: "MIT",
        author: { name: "someone" },
      });
    }
  });

  it("Codex 清单指明 skills 目录并带展示信息", () => {
    const codex = buildPluginManifests(pkg)[".codex-plugin/plugin.json"] as {
      skills: string;
      interface: Record<string, unknown>;
    };
    expect(codex.skills).toBe("./skills/");
    expect(codex.interface).toMatchObject({
      displayName: PLUGIN_NAME,
      category: "Developer Tools",
    });
  });

  it("写入包根：按 package.json 当前版本落两份文件", () => {
    writeFileSync(
      path.join(pkgRoot, "package.json"),
      JSON.stringify({ version: "1.2.3", author: "a", license: "MIT" }),
    );
    expect(writePluginManifests(pkgRoot)).toHaveLength(2);
    for (const rel of [
      ".claude-plugin/plugin.json",
      ".codex-plugin/plugin.json",
    ]) {
      const content = JSON.parse(
        readFileSync(path.join(pkgRoot, rel), "utf-8"),
      );
      expect(content.version).toBe("1.2.3");
    }
  });

  it("package.json 把两份清单纳入发布内容", () => {
    expect(pkg.files).toEqual(
      expect.arrayContaining([".claude-plugin", ".codex-plugin"]),
    );
  });
});
