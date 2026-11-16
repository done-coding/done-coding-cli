/**
 * `tree templates`：列模块模板基座（含 base.json）与模板 whenToUse，就近优先；夹具全在临时目录，fake HOME 隔离全局层。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listTreeTemplates,
  type TreeTemplatesBase,
} from "@/handlers/tree-templates";

let dirs: string[] = [];
afterEach(() => {
  dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
  dirs = [];
});

const write = (root: string, rel: string, content: string) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
};

const schema = (whenToUse: string) =>
  JSON.stringify({ whenToUse, params: { type: "object", properties: {} } });

/** 基座摘要：名称、版本、获胜层、各模板 [名称, whenToUse] */
const summarize = (b: TreeTemplatesBase) => [
  b.base,
  b.version,
  b.layer,
  b.templates.map((t) => [t.name, t.whenToUse]),
];

describe("listTreeTemplates", () => {
  it("只列含 base.json 的基座；同名基座 / 模板就近优先；基座不存在报出已有清单", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "tree-tpl-proj-"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "tree-tpl-home-"));
    dirs.push(project, home);
    const T = ".done-coding/templates";
    write(
      project,
      `${T}/forge/base.json`,
      '{ "package": "@x/forge", "version": "1.2.0" }',
    );
    write(
      project,
      `${T}/forge/list-page/schema.json`,
      schema("列表页（项目层）"),
    );
    write(
      project,
      `${T}/rules/shared/runtime.md`,
      "# 共用规则，不是模块模板\n",
    );
    write(
      home,
      `${T}/forge/base.json`,
      '{ "package": "@x/forge", "version": "0.9.0" }',
    );
    write(home, `${T}/forge/form-page/schema.json`, schema("表单页（全局层）"));
    write(
      home,
      `${T}/py/base.json`,
      '{ "package": "fastapi", "version": "0.1.0" }',
    );
    write(home, `${T}/py/resource/schema.json`, schema("资源 CRUD"));

    const all = listTreeTemplates(project, undefined, { home });
    expect(all.map(summarize)).toEqual([
      [
        "forge",
        "1.2.0",
        "project",
        [
          ["form-page", "表单页（全局层）"],
          ["list-page", "列表页（项目层）"],
        ],
      ],
      ["py", "0.1.0", "global", [["resource", "资源 CRUD"]]],
    ]);
    expect(
      listTreeTemplates(project, "py", { home }).map((b) => b.base),
    ).toEqual(["py"]);
    expect(() => listTreeTemplates(project, "admin-core", { home })).toThrow(
      "没有找到模块模板基座 admin-core（已有：forge、py）",
    );
  });
});
