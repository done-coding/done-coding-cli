/**
 * [T5] 模板资产层单测：discoverTemplates 就近向上 + 全局 / 同名遮蔽 near-wins /
 * 异名并集 / schema 缺失 fail-loud 指名 / <base> 缺失 → [] / schema 读取正确性。
 * 沙盒：tmpdir 构造 fake HOME（隔离全局层，不污染真实 ~/.done-coding）+ afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverTemplates, readTemplateSchema } from "@/templates";

let home: string; // fake 全局层 HOME
let cwd: string; // 项目层 cwd（含 <cwd>/.done-coding/...）
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "tpl-home-"));
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "tpl-cwd-"));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(cwd, { recursive: true, force: true });
});

/** 默认 schema（多数用例共用） */
const DEFAULT_SCHEMA: Record<string, unknown> = {
  whenToUse: "测试模板",
  params: { type: "object", properties: { title: { type: "string" } } },
};

/** 在给定层建一个模板（含默认 schema.json）。返回模板绝对路径（realpath 后）。 */
const writeTemplate = (root: string, base: string, name: string): string => {
  const dir = path.join(root, ".done-coding", "templates", base, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "schema.json"),
    JSON.stringify(DEFAULT_SCHEMA, null, 2),
    "utf-8",
  );
  return fs.realpathSync(dir);
};

/** 覆写单模板 schema.json（自定义 schema 用例）。返回模板绝对路径。 */
const writeSchema = (
  templateDir: string,
  schema: Record<string, unknown>,
): string => {
  fs.writeFileSync(
    path.join(templateDir, "schema.json"),
    JSON.stringify(schema, null, 2),
    "utf-8",
  );
  return templateDir;
};

describe("[T5] discoverTemplates", () => {
  it("项目层模板遮蔽全局层同名模板（near-wins，获胜层=project）", () => {
    const projectDir = writeTemplate(cwd, "admin-core", "list-page");
    writeSchema(projectDir, {
      whenToUse: "项目版列表页",
      params: { type: "object" },
    });
    writeSchema(writeTemplate(home, "admin-core", "list-page"), {
      whenToUse: "全局版列表页",
      params: { type: "object" },
    });

    const tpls = discoverTemplates("admin-core", cwd, { home });
    expect(tpls).toHaveLength(1);
    expect(tpls[0]).toMatchObject({
      name: "list-page",
      base: "admin-core",
      layer: "project",
    });
    expect(tpls[0].dir).toBe(projectDir);
    expect(tpls[0].schema.whenToUse).toBe("项目版列表页");
  });

  it("异名并集：项目/全局各自独有模板均列出（获胜层各自标注）", () => {
    writeTemplate(cwd, "admin-core", "project-only");
    const globalDir = writeTemplate(home, "admin-core", "global-only");

    const tpls = discoverTemplates("admin-core", cwd, { home });
    const byName = Object.fromEntries(tpls.map((t) => [t.name, t]));
    expect(Object.keys(byName).sort()).toEqual(["global-only", "project-only"]);
    expect(byName["project-only"].layer).toBe("project");
    expect(byName["global-only"]).toMatchObject({
      layer: "global",
      dir: globalDir,
    });
  });

  it("父层发现：cwd 祖先目录的 .done-coding/templates/<base>/ 命中，layer=parent", () => {
    // cwd = <tmp>/p/a/b/c，父层 p/a/.done-coding/templates/... 命中
    const nested = path.join(cwd, "p", "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    const parentRoot = path.join(cwd, "p", "a");
    const parentDir = writeTemplate(parentRoot, "admin-core", "parent-tpl");

    const tpls = discoverTemplates("admin-core", nested, { home });
    expect(tpls).toHaveLength(1);
    expect(tpls[0]).toMatchObject({ name: "parent-tpl", layer: "parent" });
    expect(tpls[0].dir).toBe(parentDir);
  });

  it("父层同名被更近项目层遮蔽；更远全局同名也被遮蔽", () => {
    // 三层同名：项目层 <nested>/ + 父层 <cwd>/（nested 的祖先）+ 全局层
    const nested = path.join(cwd, "deep", "sub");
    fs.mkdirSync(nested, { recursive: true });
    const projectDir = writeTemplate(nested, "admin-core", "shared");
    writeTemplate(cwd, "admin-core", "shared");
    writeTemplate(home, "admin-core", "shared");

    const tpls = discoverTemplates("admin-core", nested, { home });
    expect(tpls).toHaveLength(1);
    expect(tpls[0]).toMatchObject({ name: "shared", layer: "project" });
    expect(tpls[0].dir).toBe(projectDir);
  });

  it("schema.json 缺失 → fail-loud 指名模板目录（不静默丢弃）", () => {
    const badDir = path.join(
      cwd,
      ".done-coding",
      "templates",
      "admin-core",
      "no-schema",
    );
    fs.mkdirSync(badDir, { recursive: true }); // 无 schema.json

    expect(() => discoverTemplates("admin-core", cwd, { home })).toThrow(
      /模板缺少 schema\.json：.*no-schema/,
    );
  });

  it("schema.json 非法 JSON5 / 缺 params → fail-loud 指名", () => {
    const badParams = path.join(
      cwd,
      ".done-coding",
      "templates",
      "admin-core",
      "bad-params",
    );
    fs.mkdirSync(badParams, { recursive: true });
    fs.writeFileSync(
      path.join(badParams, "schema.json"),
      `{ whenToUse: "缺 params" }`,
      "utf-8",
    );
    expect(() => discoverTemplates("admin-core", cwd, { home })).toThrow(
      /缺少 params/,
    );

    const badJson = path.join(
      cwd,
      ".done-coding",
      "templates",
      "admin-core",
      "bad-json",
    );
    fs.mkdirSync(badJson, { recursive: true });
    fs.writeFileSync(
      path.join(badJson, "schema.json"),
      "{ 非法 json5 ]",
      "utf-8",
    );
    expect(() => discoverTemplates("admin-core", cwd, { home })).toThrow(
      /schema\.json 解析失败/,
    );
  });

  it("<base>/ 不存在 → 返回 []（非 fail）；无 templates 根 → []", () => {
    // 有 templates 根但无该 base
    fs.mkdirSync(path.join(cwd, ".done-coding", "templates"), {
      recursive: true,
    });
    expect(discoverTemplates("missing-base", cwd, { home })).toEqual([]);

    // 全无 templates 根（连项目层都没有）
    const emptyCwd = path.join(os.tmpdir(), `tpl-empty-${Date.now()}`);
    fs.mkdirSync(emptyCwd, { recursive: true });
    try {
      expect(discoverTemplates("admin-core", emptyCwd, { home })).toEqual([]);
    } finally {
      fs.rmSync(emptyCwd, { recursive: true, force: true });
    }
  });

  it("schema 读取正确性：whenToUse/params/defaults 透传（params 必填契约）", () => {
    const dir = writeTemplate(cwd, "admin-core", "list-page");
    writeSchema(dir, {
      whenToUse: "标准表格+搜索+分页+新增弹窗的列表页",
      params: {
        type: "object",
        properties: {
          title: { type: "string", description: "页面标题" },
          columns: { type: "array" },
        },
        required: ["title"],
      },
      defaults: { title: "用户列表", pageSize: 20 },
    });

    const tpls = discoverTemplates("admin-core", cwd, { home });
    expect(tpls).toHaveLength(1);
    expect(tpls[0].schema).toEqual({
      whenToUse: "标准表格+搜索+分页+新增弹窗的列表页",
      params: {
        type: "object",
        properties: {
          title: { type: "string", description: "页面标题" },
          columns: { type: "array" },
        },
        required: ["title"],
      },
      defaults: { title: "用户列表", pageSize: 20 },
    });

    // readTemplateSchema 独立读取同值
    expect(readTemplateSchema(dir).whenToUse).toBe(
      "标准表格+搜索+分页+新增弹窗的列表页",
    );
  });

  it("whenToUse 缺省（仅 params）→ whenToUse 为 undefined；defaults 缺省 → 不带键", () => {
    writeSchema(writeTemplate(cwd, "admin-core", "minimal"), {
      params: { type: "object" },
    });
    const tpls = discoverTemplates("admin-core", cwd, { home });
    expect(tpls[0].schema.whenToUse).toBeUndefined();
    expect("defaults" in tpls[0].schema).toBe(false);
  });

  it("软链模板目录经 realpath 读 schema（M7 读边界）", () => {
    const realDir = writeTemplate(home, "admin-core", "linked");
    const linkDir = path.join(
      cwd,
      ".done-coding",
      "templates",
      "admin-core",
      "linked",
    );
    fs.mkdirSync(path.dirname(linkDir), { recursive: true });
    fs.symlinkSync(realDir, linkDir, "dir");

    const tpls = discoverTemplates("admin-core", cwd, { home });
    expect(tpls).toHaveLength(1);
    expect(tpls[0]).toMatchObject({ name: "linked", layer: "project" });
    expect(tpls[0].dir).toBe(fs.realpathSync(linkDir));
    expect(tpls[0].schema.whenToUse).toBe("测试模板");
  });
});
