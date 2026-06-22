/**
 * [C2] create-sync 单测（D-H4）：recipe 无 createTemplate→不触达；upsert 幂等；
 * 保留既有其它项 + 既有项其它字段。沙盒：tmpdir + afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Recipe } from "@/assemble/types";
import { syncCreateTemplate } from "@/assemble/create-sync";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "create-sync-"));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const baseRecipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "foo",
  base: { kind: "empty" },
  output: "templates/foo",
  ops: [],
  ...over,
});

const readConfig = (
  rel: string,
): { templateList: { name: string; [k: string]: unknown }[] } =>
  JSON.parse(fs.readFileSync(path.join(root, rel), "utf-8"));

describe("[C2] syncCreateTemplate", () => {
  it("recipe 无 createTemplate → 不触达任何文件", () => {
    const res = syncCreateTemplate(root, baseRecipe());
    expect(res.synced).toBe(false);
    expect(fs.existsSync(path.join(root, "create.config.json"))).toBe(false);
  });

  it("config 不存在 → 新建并写入 templateList 项", () => {
    const res = syncCreateTemplate(
      root,
      baseRecipe({
        createTemplate: {
          configPath: "create.config.json",
          name: "foo-tpl",
          description: "Foo 模板",
        },
      }),
    );
    expect(res.synced).toBe(true);
    expect(res.inserted).toBe(true);
    const cfg = readConfig("create.config.json");
    expect(cfg.templateList).toHaveLength(1);
    expect(cfg.templateList[0]).toMatchObject({
      name: "foo-tpl",
      directory: "templates/foo",
      description: "Foo 模板",
    });
    expect(typeof cfg.templateList[0].url).toBe("string");
  });

  it("upsert 幂等：同 name 重跑不重复追加、更新 directory", () => {
    const recipe1 = baseRecipe({
      createTemplate: { configPath: "c.json", name: "foo-tpl" },
    });
    syncCreateTemplate(root, recipe1);
    const recipe2 = baseRecipe({
      output: "templates/foo-v2",
      createTemplate: { configPath: "c.json", name: "foo-tpl" },
    });
    const res = syncCreateTemplate(root, recipe2);
    expect(res.inserted).toBe(false);
    const cfg = readConfig("c.json");
    expect(cfg.templateList).toHaveLength(1);
    expect(cfg.templateList[0].directory).toBe("templates/foo-v2");
  });

  it("保留既有其它项 + 既有项的额外字段（branch/instances）", () => {
    fs.writeFileSync(
      path.join(root, "c.json"),
      JSON.stringify({
        templateList: [
          { name: "other", url: "x", directory: "d" },
          { name: "foo-tpl", branch: "main", instances: ["a"] },
        ],
      }),
      "utf-8",
    );
    syncCreateTemplate(
      root,
      baseRecipe({
        output: "templates/foo",
        createTemplate: { configPath: "c.json", name: "foo-tpl" },
      }),
    );
    const cfg = readConfig("c.json");
    expect(cfg.templateList).toHaveLength(2);
    const foo = cfg.templateList.find((i) => i.name === "foo-tpl")!;
    expect(foo.branch).toBe("main");
    expect(foo.instances).toEqual(["a"]);
    expect(foo.directory).toBe("templates/foo");
  });

  it("config 非法 JSON → fail-loud", () => {
    fs.writeFileSync(path.join(root, "bad.json"), "{ not json", "utf-8");
    expect(() =>
      syncCreateTemplate(
        root,
        baseRecipe({
          createTemplate: { configPath: "bad.json", name: "x" },
        }),
      ),
    ).toThrow(/解析失败/);
  });
});
