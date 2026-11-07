/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * dyynp0：tree build / check 生成前校验。
 * ⓐ recipe.vars 按模板 schema.json 的 params（JSON Schema）校验，列出全部违规且零落盘；
 * ⓑ schema 声明 base: { package, range } 时，项目已装版本须落在 range 内（node_modules 就近解析）；
 * ⓒ tree check 同口径：版本不符明确报出，而非报成漂移。
 * 沙盒：tmpdir git 仓 + afterEach 清理 + non-interactive。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isCliUserError } from "@done-coding/cli-utils";
import { treeHandler } from "@/handlers/tree";
import { unregisterAll } from "@/assemble/registry";

let repo: string;

beforeEach(() => {
  unregisterAll();
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "tree-guard-"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
});

afterEach(() => {
  unregisterAll();
  fs.rmSync(repo, { recursive: true, force: true });
});

const write = (rel: string, content: string): void => {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

const PARAMS = {
  type: "object",
  required: ["name", "title"],
  properties: {
    name: { type: "string" },
    title: { type: "string" },
    columns: {
      type: "array",
      items: {
        type: "object",
        required: ["key"],
        properties: { key: { type: "string" } },
      },
    },
  },
};

/** 项目层模板 `.done-coding/templates/kit/list-page/`（schema + 1 个碎片） */
const template = (schema: Record<string, unknown>): void => {
  const dir = ".done-coding/templates/kit/list-page";
  write(`${dir}/schema.json`, JSON.stringify(schema));
  write(`${dir}/fragments/Index.vue.vm`, "<h1>${title}</h1>\n");
};

/** 模块配方，vars 由用例给出 */
const recipe = (vars: Record<string, unknown>, output = "src/modules/demo") =>
  write(
    ".done-coding/generator/assemble/recipes/demo.json5",
    JSON.stringify({
      id: "demo",
      base: { kind: "empty" },
      output,
      render: true,
      vars,
      ops: [
        {
          type: "addFragment",
          id: "page",
          source: "kit/list-page/fragments/Index.vue.vm",
          target: "Index.vue",
        },
      ],
    }),
  );

/** 在 <dir>/node_modules/<pkg> 装一个指定版本的假包 */
const installPkg = (dir: string, pkg: string, version: string): void =>
  write(
    path.join(dir, "node_modules", pkg, "package.json"),
    JSON.stringify({ name: pkg, version }),
  );

const ctx = () => ({ cwd: repo, interactive: false });

const catchError = async (run: () => Promise<unknown>): Promise<Error> => {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("预期抛错但未抛");
};

const outputExists = (output = "src/modules/demo") =>
  fs.existsSync(path.join(repo, output));

const manifestExists = () =>
  fs.existsSync(
    path.join(repo, ".done-coding/generator/assemble/manifests/demo.json"),
  );

describe("tree 参数校验（模板 schema.params）", () => {
  it("违规 → 列出全部字段（路径 + 期望 + 实际），零落盘", async () => {
    template({ params: PARAMS });
    recipe({ name: 123, columns: [{ key: 1 }] });
    const error = await catchError(() =>
      treeHandler({ action: "build" }, ctx()),
    );
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("kit/list-page");
    expect(error.message).toContain("/title");
    expect(error.message).toContain("必填");
    expect(error.message).toContain("/name");
    expect(error.message).toContain("string");
    expect(error.message).toContain("123");
    expect(error.message).toContain("/columns/0/key");
    expect(outputExists()).toBe(false);
    expect(manifestExists()).toBe(false);
  });

  it("合规 → 正常生成", async () => {
    template({ params: PARAMS });
    recipe({ name: "Demo", title: "演示" });
    const res = await treeHandler({ action: "build" }, ctx());
    expect(res.exitCode).toBe(0);
    expect(
      fs.readFileSync(path.join(repo, "src/modules/demo/Index.vue"), "utf-8"),
    ).toBe("<h1>演示</h1>\n");
  });

  it("params 声明 draft 2020-12 也能校验", async () => {
    template({
      params: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        ...PARAMS,
      },
    });
    recipe({ name: "Demo" });
    const error = await catchError(() =>
      treeHandler({ action: "build" }, ctx()),
    );
    expect(error.message).toContain("/title");
  });
});

describe("tree 基座版本闸（schema.base）", () => {
  const BASE = { package: "@scope/core", range: "^1.2.0" };

  it("已装版本在 range 内 → 正常生成", async () => {
    template({ params: PARAMS, base: BASE });
    installPkg(".", "@scope/core", "1.4.0");
    recipe({ name: "Demo", title: "演示" });
    const res = await treeHandler({ action: "build" }, ctx());
    expect(res.exitCode).toBe(0);
  });

  it("已装版本不在 range 内 → 拒绝并提示升级或换模板，零落盘", async () => {
    template({ params: PARAMS, base: BASE });
    installPkg(".", "@scope/core", "1.1.9");
    recipe({ name: "Demo", title: "演示" });
    const error = await catchError(() =>
      treeHandler({ action: "build" }, ctx()),
    );
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("@scope/core");
    expect(error.message).toContain("^1.2.0");
    expect(error.message).toContain("1.1.9");
    expect(error.message).toContain("升级");
    expect(error.message).toContain("模板");
    expect(outputExists()).toBe(false);
    expect(manifestExists()).toBe(false);
  });

  it("就近解析：output 所在子包的 node_modules 优先于仓根", async () => {
    template({ params: PARAMS, base: BASE });
    installPkg(".", "@scope/core", "1.0.0");
    installPkg("apps/web", "@scope/core", "1.3.0");
    recipe({ name: "Demo", title: "演示" }, "apps/web/src/modules/demo");
    const res = await treeHandler({ action: "build" }, ctx());
    expect(res.exitCode).toBe(0);
  });

  it("项目未装该包（如非 npm 基座）→ 告警但不阻断", async () => {
    template({
      params: PARAMS,
      base: { package: "fastapi", range: ">=0.115.0" },
    });
    recipe({ name: "Demo", title: "演示" });
    const res = await treeHandler({ action: "build" }, ctx());
    expect(res.exitCode).toBe(0);
    expect(outputExists()).toBe(true);
  });

  it("range 非法 → 指出 schema 问题", async () => {
    template({
      params: PARAMS,
      base: { package: "@scope/core", range: "not a range!" },
    });
    installPkg(".", "@scope/core", "1.4.0");
    recipe({ name: "Demo", title: "演示" });
    const error = await catchError(() =>
      treeHandler({ action: "build" }, ctx()),
    );
    expect(error.message).toContain("range");
    expect(error.message).toContain("schema.json");
  });

  it("tree check 同口径：版本不符报版本问题而非漂移", async () => {
    template({ params: PARAMS, base: BASE });
    installPkg(".", "@scope/core", "1.4.0");
    recipe({ name: "Demo", title: "演示" });
    await treeHandler({ action: "build" }, ctx());
    installPkg(".", "@scope/core", "2.0.0");
    const error = await catchError(() =>
      treeHandler({ action: "check" }, ctx()),
    );
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("2.0.0");
    expect(error.message).not.toContain("漂移");
  });
});
