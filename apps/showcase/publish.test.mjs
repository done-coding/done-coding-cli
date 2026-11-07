import { afterEach, beforeEach, expect, test } from "vitest";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { publishContent } from "./publish.mjs";
import { scanContent } from "./export.mjs";

const run = promisify(execFile);
let scratch;
let repoRoot;
let siteRoot;
const content = "apps/cli-site/content";
const write = async (root, file, body) => {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
};
// 自包含 Git 夹具，禁用 hooks、签名及全局配置；不会操作真实仓的 index。
const git = async (root, ...args) =>
  (
    await run(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        ...args,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
        },
      },
    )
  ).stdout.trim();
const commit = async (root) => {
  await git(root, "add", ".");
  await git(root, "commit", "-m", "fixture");
};
const tree = async (root) => {
  const result = {};
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else
        result[path.relative(root, file)] = entry.isSymbolicLink()
          ? `symlink:${await fs.readlink(file)}`
          : await fs.readFile(file, "utf8");
    }
  }
  await visit(root);
  return result;
};
const publish = (options = {}) =>
  publishContent({ repoRoot, siteRoot, ...options });
async function rejectedWithoutWrites(pattern, options) {
  const before = await tree(scratch);
  await expect(publish(options)).rejects.toThrow(pattern);
  expect(await tree(scratch)).toEqual(before);
}
beforeEach(async () => {
  scratch = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "showcase-publish-")),
  );
  repoRoot = path.join(scratch, "product");
  siteRoot = path.join(scratch, "site");
  await fs.mkdir(repoRoot);
  await fs.mkdir(siteRoot);
  await git(repoRoot, "init");
  await git(siteRoot, "init");
  await write(repoRoot, "README.md", "# 开始\n[CLI](./packages/cli)\n");
  await write(
    repoRoot,
    "packages/cli/package.json",
    '{"name":"done-coding","version":"0.23.3"}',
  );
  await write(repoRoot, "packages/cli/README.md", "# CLI\n");
  await write(siteRoot, "AGENTS.md", "# 内容产物契约\n");
  await write(siteRoot, `${content}/0.1.0/docs/index.md`, "保留旧版本");
  await write(siteRoot, "unrelated.txt", "站点其他文件");
  await commit(repoRoot);
  await commit(siteRoot);
});
afterEach(async () => {
  await fs.rm(scratch, { recursive: true, force: true });
});

test("缺少站点路径时不猜默认值且不写入", async () => {
  await rejectedWithoutWrites(/站点.*必填/, { siteRoot: undefined });
});
test("站点不是 Git 仓时拒绝", async () => {
  await fs.rm(path.join(siteRoot, ".git"), { recursive: true });
  await rejectedWithoutWrites(/git|Git/);
});
test("Git 仓子目录不能冒充站点根", async () => {
  await rejectedWithoutWrites(/根目录/, {
    siteRoot: path.join(siteRoot, "apps"),
  });
});
test("缺契约时拒绝", async () => {
  await write(siteRoot, "AGENTS.md", "# 其他规则");
  await rejectedWithoutWrites(/内容产物契约/);
});
test("缺 content 时拒绝且不创建", async () => {
  await fs.rm(path.join(siteRoot, content), { recursive: true });
  await rejectedWithoutWrites(/content/);
});
test.each(["tracked", "untracked", "staged", "ignored"])(
  "目标 content 有 %s 改动时拒绝",
  async (kind) => {
    if (kind === "ignored") {
      await write(siteRoot, ".gitignore", `${content}/ignored\n`);
      await commit(siteRoot);
    }
    await write(
      siteRoot,
      `${content}/${kind === "tracked" ? "0.1.0/docs/index.md" : kind}`,
      "有改动",
    );
    if (kind === "staged") await git(siteRoot, "add", content);
    await rejectedWithoutWrites(/目标.*未提交/);
  },
);
test.each(["tracked", "untracked", "staged"])(
  "来源仓有 %s 改动时拒绝",
  async (kind) => {
    await write(repoRoot, kind === "tracked" ? "README.md" : kind, "未提交");
    if (kind === "staged") await git(repoRoot, "add", kind);
    await rejectedWithoutWrites(/来源.*未提交/);
  },
);
test("正常发布遵守契约、仅改 content、保留其他版本；清理后重复发布一致", async () => {
  await write(siteRoot, "unrelated.txt", "允许 content 外的本地改动");
  const sourceBefore = await tree(repoRoot);
  const siteHead = await git(siteRoot, "rev-parse", "HEAD");
  const result = await publish();
  expect(await tree(repoRoot)).toEqual(sourceBefore);
  expect(await git(siteRoot, "rev-parse", "HEAD")).toBe(siteHead);
  expect(result).toMatchObject({
    version: "0.23.3",
    files: 4,
    output: path.join(siteRoot, content),
  });
  const first = await tree(siteRoot);
  expect(JSON.parse(first[`${content}/current.json`])).toEqual({
    version: "0.23.3",
    source: `done-coding-cli@${await git(repoRoot, "rev-parse", "HEAD")}`,
  });
  expect(JSON.parse(first[`${content}/0.23.3/nav.json`])).toEqual([
    { text: "开始", link: "index.md" },
    { text: "done-coding", link: "packages/cli.md" },
  ]);
  expect(first[`${content}/0.1.0/docs/index.md`]).toBe("保留旧版本");
  expect(first["unrelated.txt"]).toBe("允许 content 外的本地改动");
  expect(await git(siteRoot, "diff", "--cached", "--name-only")).toBe("");
  await commit(siteRoot);
  await publish();
  expect(await tree(siteRoot)).toEqual(first);
  expect(await git(siteRoot, "status", "--porcelain")).toBe("");
});
test("同版本整体替换会删除过期文件", async () => {
  await write(siteRoot, `${content}/0.23.3/docs/stale.md`, "过期");
  await commit(siteRoot);
  await publish();
  expect(await fs.readdir(path.join(siteRoot, content, "0.23.3/docs"))).toEqual(
    ["index.md", "packages"],
  );
});
test.each([
  "/Users/someone/private",
  "/home/someone/private",
  "C:\\Users\\someone\\private",
  "//# sourceMappingURL=secret.js.map",
  "`/Users/someone/private`",
  "/usr/local/private",
  "`C:\\Users\\someone\\private`",
])("扫描拒绝敏感产物 %s 且不写入", async (body) => {
  await write(repoRoot, "README.md", `# 示例\n${body}\n`);
  await commit(repoRoot);
  await rejectedWithoutWrites(/扫描/);
});
test.each(["docs/a.js.map", "docs/source.ts", "../escape.md"])(
  "共用扫描拒绝文件 %s",
  (name) => {
    expect(() => scanContent([{ name, body: "{}" }])).toThrow(/扫描/);
  },
);
test.each([
  "apps",
  content,
  `${content}/0.23.3`,
  `${content}/current.json`,
  `${content}/0.1.0/docs/index.md`,
  "AGENTS.md",
])("拒绝目标软链 %s", async (target) => {
  const original = path.join(siteRoot, target);
  const saved = path.join(scratch, "saved");
  try {
    await fs.rename(original, saved);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.mkdir(saved);
  }
  await fs.symlink(saved, original);
  await commit(siteRoot);
  await rejectedWithoutWrites(/软链/);
});
test("拒绝站点根路径中的软链及穿越", async () => {
  const alias = path.join(scratch, "alias");
  await fs.symlink(siteRoot, alias);
  await rejectedWithoutWrites(/软链/, { siteRoot: alias });
  await rejectedWithoutWrites(/穿越/, { siteRoot: `${siteRoot}/../site` });
});
test("current 替换失败还原旧版本，清理临时目录", async () => {
  await write(siteRoot, `${content}/0.23.3/docs/old.md`, "旧内容");
  await write(siteRoot, `${content}/current.json/keep`, "不能覆盖目录");
  await commit(siteRoot);
  await rejectedWithoutWrites(/EISDIR|ENOTDIR/);
});
test("CLI 缺参及多余参数退出非零且不写入", async () => {
  const script = fileURLToPath(new URL("./publish.mjs", import.meta.url));
  for (const args of [[], [siteRoot, "extra"]]) {
    const before = await tree(scratch);
    await expect(
      run(process.execPath, [script, ...args], { cwd: scratch }),
    ).rejects.toMatchObject({ code: 1 });
    expect(await tree(scratch)).toEqual(before);
  }
});

test("缺 AGENTS 文件时拒绝且不写入", async () => {
  await fs.unlink(path.join(siteRoot, "AGENTS.md"));
  await rejectedWithoutWrites(/AGENTS/);
});

test("CLI 从其他目录运行也使用自身产品仓，并打印版本、文件数与目标", async () => {
  for (const name of ["publish.mjs", "export.mjs"]) {
    await write(
      repoRoot,
      `apps/showcase/${name}`,
      await fs.readFile(new URL(name, import.meta.url), "utf8"),
    );
  }
  await commit(repoRoot);
  const head = await git(siteRoot, "rev-parse", "HEAD");
  const { stdout, stderr } = await run(
    process.execPath,
    [path.join(repoRoot, "apps/showcase/publish.mjs"), siteRoot],
    { cwd: scratch },
  );
  expect(stderr).toBe("");
  expect(stdout).toContain("版本 0.23.3");
  expect(stdout).toContain("4 个文件");
  expect(stdout).toContain(path.join(siteRoot, content));
  expect(await git(siteRoot, "rev-parse", "HEAD")).toBe(head);
  expect(await git(siteRoot, "diff", "--cached", "--name-only")).toBe("");
});
