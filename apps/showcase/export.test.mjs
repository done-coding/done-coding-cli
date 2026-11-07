import { afterEach, beforeEach, expect, test } from "vitest";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportContent } from "./export.mjs";

let root;
let outside;
const source = "done-coding-cli@0123456789abcdef";
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const write = async (file, body) => {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
};
const content = "test-results/showcase/content";

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "showcase-test-"));
  outside = await fs.mkdtemp(path.join(os.tmpdir(), "showcase-outside-"));
  await write("README.md", "# 开始\n\n[CLI](./packages/cli)\n");
  await write(
    "packages/cli/package.json",
    '{"name":"done-coding","version":"0.23.3"}',
  );
  await write(
    "packages/cli/README.md",
    "# done-coding\n\n[首页](../../README.md#开始)\n[官网](https://example.test/)\n",
  );
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

test("导出版本、来源、可达导航和相对文档链接，仅包含内容文件", async () => {
  await write("packages/cli/src/secret.ts", "源码不能被导出");
  await write("packages/cli/es/index.mjs.map", "source map 不能被导出");
  await exportContent({ repoRoot: root, source });
  expect(JSON.parse(await read(`${content}/current.json`))).toEqual({
    version: "0.23.3",
    source,
  });
  expect(JSON.parse(await read(`${content}/0.23.3/nav.json`))).toEqual([
    { text: "开始", link: "index.md" },
    { text: "done-coding", link: "packages/cli.md" },
  ]);
  expect(await read(`${content}/0.23.3/docs/index.md`)).toContain(
    "[CLI](./packages/cli.md)",
  );
  expect(await read(`${content}/0.23.3/docs/packages/cli.md`)).toContain(
    "[首页](../index.md#开始)",
  );
  expect(await read(`${content}/0.23.3/docs/packages/cli.md`)).toContain(
    "https://example.test/",
  );
  expect(await fs.readdir(path.join(root, content, "0.23.3"))).toEqual([
    "docs",
    "nav.json",
  ]);
  expect(
    await fs.readdir(path.join(root, content, "0.23.3/docs/packages")),
  ).toEqual(["cli.md"]);
});

test("错误链接失败时保留之前的 current 和文档", async () => {
  await exportContent({ repoRoot: root, source });
  await write("README.md", "# 开始\n[未知](./missing.md)\n");
  await expect(
    exportContent({ repoRoot: root, source: "new" }),
  ).rejects.toThrow(/未导出的本地链接/);
  expect(JSON.parse(await read(`${content}/current.json`)).source).toBe(source);
  expect(await read(`${content}/0.23.3/docs/index.md`)).toContain("[CLI]");
});

test("重导出清理失效文档，保留其他版本", async () => {
  await write("packages/extra/package.json", '{"name":"extra"}');
  await write("packages/extra/README.md", "# extra\n");
  await exportContent({ repoRoot: root, source });
  await write(`${content}/0.1.0/docs/keep.md`, "保留旧版本");
  await fs.rm(path.join(root, "packages/extra"), { recursive: true });
  await exportContent({ repoRoot: root, source });
  expect(
    await fs.readdir(path.join(root, content, "0.23.3/docs/packages")),
  ).toEqual(["cli.md"]);
  expect(await read(`${content}/0.1.0/docs/keep.md`)).toBe("保留旧版本");
});

test.each(["../outside", "/", "", "0.23.3/../../outside"])(
  "拒绝不安全版本 %j",
  async (version) => {
    await write("packages/cli/package.json", JSON.stringify({ version }));
    await expect(exportContent({ repoRoot: root, source })).rejects.toThrow(
      /版本/,
    );
    expect(await fs.readdir(outside)).toEqual([]);
  },
);

test.each(["test-results", `${content}/0.23.3`, `${content}/current.json`])(
  "拒绝输出软链 %s",
  async (target) => {
    await fs.mkdir(path.dirname(path.join(root, target)), { recursive: true });
    await fs.symlink(outside, path.join(root, target));
    await expect(exportContent({ repoRoot: root, source })).rejects.toThrow(
      /软链/,
    );
    expect(await fs.readdir(outside)).toEqual([]);
  },
);

test("拒绝读取包或 README 的软链", async () => {
  await fs.unlink(path.join(root, "README.md"));
  await fs.writeFile(path.join(outside, "private.md"), "不能读取");
  await fs.symlink(
    path.join(outside, "private.md"),
    path.join(root, "README.md"),
  );
  await expect(exportContent({ repoRoot: root, source })).rejects.toThrow(
    /软链/,
  );
});

test("每个工作区包必须有 README，不能悄悄漏页", async () => {
  await write("packages/new/package.json", '{"name":"new"}');
  await expect(exportContent({ repoRoot: root, source })).rejects.toThrow(
    /README/,
  );
});

test("支持引用式链接与目录链接，不改写代码示例", async () => {
  await write(
    "README.md",
    '# 开始\n[CLI][cli]\n\n[cli]: ./packages/cli/ "命令"\n\n```md\n[示例](./not-a-doc)\n```\n',
  );
  await exportContent({ repoRoot: root, source });
  const doc = await read(`${content}/0.23.3/docs/index.md`);
  expect(doc).toContain('[cli]: ./packages/cli.md "命令"');
  expect(doc).toContain("[示例](./not-a-doc)");
});

// 漏掉 package.json 过滤会把 packages/.done-coding 当成包，真实导出会失败。
test("忽略非包目录但仍覆盖全部包", async () => {
  await write("packages/.done-coding/config.json", "{}");
  await exportContent({ repoRoot: root, source });
  expect(JSON.parse(await read(`${content}/0.23.3/nav.json`))).toHaveLength(2);
});

test("更新 current 失败会还原该版本的旧文档", async () => {
  await exportContent({ repoRoot: root, source });
  await write("README.md", "# 修改后的首页\n");
  await fs.unlink(path.join(root, content, "current.json"));
  await fs.mkdir(path.join(root, content, "current.json"));
  await write(`${content}/current.json/keep`, "不能覆盖");
  await expect(exportContent({ repoRoot: root, source })).rejects.toThrow();
  expect(await read(`${content}/0.23.3/docs/index.md`)).toContain("[CLI]");
  expect(await read(`${content}/current.json/keep`)).toBe("不能覆盖");
  expect((await fs.readdir(path.join(root, content))).sort()).toEqual([
    "0.23.3",
    "current.json",
  ]);
});
