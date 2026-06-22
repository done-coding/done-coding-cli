/**
 * [A3] render 单测：渲染 + helper 命名空间 + readFragment 越界 throw（不 exit）+ fence 剥离。
 * 沙盒：fixtures 落 os.tmpdir()，afterEach 清理（项目 CLAUDE.md 铁律）。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRender, readFragment } from "@/assemble/render";

describe("[A3] createRender", () => {
  it("基础变量插值（lodash.template）", () => {
    const render = createRender({ name: "Foo" });
    expect(render("hello <%= name %>")).toBe("hello Foo");
  });

  it("注入 _ helper 命名空间（camelCase/kebabCase/pascalCase）", () => {
    const render = createRender({ raw: "my-widget" });
    expect(render("<%= _.pascalCase(raw) %>")).toBe("MyWidget");
    expect(render("<%= _.camelCase(raw) %>")).toBe("myWidget");
    expect(render("<%= _.kebabCase('MyWidget') %>")).toBe("my-widget");
  });
});

describe("[A3] readFragment throw-only + 越界 + fence", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "assemble-render-"));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("读取碎片文件原文", () => {
    fs.writeFileSync(path.join(root, "a.txt"), "content-A");
    expect(readFragment(root, "a.txt")).toBe("content-A");
  });

  it("dealMarkdown 剥单层 code fence（.md）", () => {
    const md = "```ts\nconst a = 1;\n```";
    fs.writeFileSync(path.join(root, "snip.md"), md);
    expect(readFragment(root, "snip.md", { dealMarkdown: true })).toBe(
      "const a = 1;\n",
    );
  });

  it("非 .md 不剥 fence", () => {
    const txt = "```ts\nx\n```";
    fs.writeFileSync(path.join(root, "snip.txt"), txt);
    expect(readFragment(root, "snip.txt", { dealMarkdown: true })).toBe(txt);
  });

  it("越界 fragmentRoot → throw（不 process.exit）", () => {
    expect(() => readFragment(root, "../escape.txt")).toThrow(/越界/);
    expect(() => readFragment(root, "/etc/passwd")).toThrow(/越界/);
  });

  it("文件不存在 → fs throw（非 exit）", () => {
    expect(() => readFragment(root, "missing.txt")).toThrow();
  });
});
