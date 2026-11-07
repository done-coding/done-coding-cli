import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertSafe, collectContent, installContent } from "./export.mjs";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const contentPath = "apps/cli-site/content";
async function git(root, args) {
  const { stdout } = await run("git", [
    "--no-optional-locks",
    "-C",
    root,
    ...args,
  ]);
  return stdout.trim();
}
async function checkedRoot(input, label) {
  if (typeof input !== "string" || !input.trim())
    throw new Error(`${label}路径必填`);
  if (input.split(/[\\/]/).includes("..")) throw new Error("拒绝路径穿越");
  const root = path.resolve(projectRoot, input);
  if (
    root === path.parse(root).root ||
    root === (await fs.realpath(os.homedir()))
  )
    throw new Error("拒绝家目录或文件系统根");
  await assertSafe(path.parse(root).root, root);
  const realRoot = await fs.realpath(root);
  if ((await git(realRoot, ["rev-parse", "--show-toplevel"])) !== realRoot)
    throw new Error(`${label}必须是 Git 仓根目录`);
  return realRoot;
}
async function rejectSymlinks(root, target) {
  await assertSafe(root, target);
  const stat = await fs.lstat(target);
  if (stat.isDirectory()) {
    for (const name of await fs.readdir(target))
      await rejectSymlinks(root, path.join(target, name));
  }
}
async function assertClean(root, target) {
  const args = ["status", "--porcelain=v1", "--untracked-files=all"];
  if (target) args.push("--ignored", "--", contentPath);
  if (await git(root, args))
    throw new Error(
      `${target ? "目标 content" : "来源仓"}有未提交改动，拒绝发布`,
    );
}

/** 只接受显式站点根；默认来源固定为本仓，不读取配置或环境变量猜路径。 */
export async function publishContent({
  siteRoot,
  repoRoot = projectRoot,
} = {}) {
  const site = await checkedRoot(siteRoot, "站点");
  const root = await checkedRoot(repoRoot, "来源");
  const agents = path.join(site, "AGENTS.md");
  await assertSafe(site, agents);
  if (!(await fs.readFile(agents, "utf8")).includes("内容产物契约"))
    throw new Error("站点 AGENTS.md 缺少内容产物契约");
  const output = path.join(site, contentPath);
  await rejectSymlinks(site, output);
  if (!(await fs.stat(output)).isDirectory())
    throw new Error("content 必须是目录");
  await assertClean(site, true);
  await assertClean(root, false);
  const head = await git(root, ["rev-parse", "HEAD"]);
  const artifact = await collectContent({
    repoRoot: root,
    source: `done-coding-cli@${head}`,
  });
  // 收集后、写盘前重查，拒绝读文档期间出现的改动。
  await assertClean(root, false);
  if ((await git(root, ["rev-parse", "HEAD"])) !== head)
    throw new Error("来源 HEAD 已改变");
  await rejectSymlinks(site, output);
  await assertClean(site, true);
  return installContent({ root: site, output, artifact });
}

if (
  process.argv[1] &&
  path.resolve(projectRoot, process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error("用法：publish <站点仓根目录>（必填且仅一个参数）");
    const result = await publishContent({ siteRoot: process.argv[2] });
    process.stdout.write(
      `已写入内容：版本 ${result.version}，${result.files} 个文件，目标 ${result.output}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
