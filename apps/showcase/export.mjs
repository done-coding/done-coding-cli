import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function isInside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

// 所有读写路径逐段拒绝软链；存在的目标还需 realpath 双解。
export async function assertSafe(root, target) {
  if (!isInside(root, target)) throw new Error("路径越出受控根或等于受控根");
  let cursor = root;
  for (const part of path.relative(root, target).split(path.sep)) {
    cursor = path.join(cursor, part);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink())
        throw new Error(`拒绝软链：${path.relative(root, cursor)}`);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
  try {
    const [realRoot, realTarget] = await Promise.all([
      fs.realpath(root),
      fs.realpath(target),
    ]);
    if (!isInside(realRoot, realTarget)) throw new Error("真实路径越出受控根");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readSafe(root, file) {
  await assertSafe(root, file);
  return fs.readFile(file, "utf8");
}

const DOCS_SITE_LINK_START = "<!-- docs-site-link -->";
const DOCS_SITE_LINK_END = "<!-- /docs-site-link -->";

// README 中指向站点自身的引导段只服务 npm / GitHub 读者，导出时按标记整段剔除；标记不成对即失败。
export function stripDocsSiteLink(markdown, label) {
  const lines = markdown.split("\n");
  const kept = [];
  let fence;
  let start = -1;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!fence && trimmed === DOCS_SITE_LINK_START) {
      if (start >= 0)
        throw new Error(`文档站引导标记嵌套（${label} 第 ${index + 1} 行）`);
      start = index;
      continue;
    }
    if (!fence && trimmed === DOCS_SITE_LINK_END) {
      if (start < 0)
        throw new Error(
          `文档站引导结束标记缺少开始（${label} 第 ${index + 1} 行）`,
        );
      start = -1;
      // 段前后各有空行时连带去掉段后空行，不留连续空行。
      if (kept.at(-1) === "" && lines[index + 1] === "") index++;
      continue;
    }
    if (start >= 0) continue;
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length)
        fence = undefined;
    }
    kept.push(line);
  }
  if (start >= 0)
    throw new Error(`文档站引导标记未闭合（${label} 第 ${start + 1} 行）`);
  return kept.join("\n");
}

function rewriteMarkdown(markdown, entry, documents) {
  function rewrite(url) {
    if (/^(?:https?:|mailto:|#)/i.test(url)) return url;
    if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url))
      throw new Error(`不支持的文档链接：${url}`);
    const [, pathname, suffix] = url.match(/^([^?#]*)(.*)$/);
    const resolved = path.resolve(
      path.dirname(entry.input),
      decodeURIComponent(pathname),
    );
    const doc = documents.find(
      (item) =>
        item.input === resolved || path.dirname(item.input) === resolved,
    );
    if (!doc) throw new Error(`未导出的本地链接：${url}（${entry.label}）`);
    const relative = path.posix.relative(
      path.posix.dirname(entry.output),
      doc.output,
    );
    return `${relative.startsWith(".") ? "" : "./"}${relative}${suffix}`;
  }

  let fence;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length)
          fence = undefined;
        return line;
      }
      if (fence) return line;
      return line
        .replace(
          /(\]\()([^\s)]+)([^)]*\))/g,
          (...match) => `${match[1]}${rewrite(match[2])}${match[3]}`,
        )
        .replace(
          /^(\s*\[[^\]]+\]:\s*)(\S+)(.*)$/,
          (...match) => `${match[1]}${rewrite(match[2])}${match[3]}`,
        );
    })
    .join("\n");
}

/** 收集 README 白名单，不写盘；本地导出与显式发布共用。 */
export async function collectContent({ repoRoot = projectRoot, source }) {
  const root = await fs.realpath(repoRoot);
  if (
    root === path.parse(root).root ||
    root === (await fs.realpath(os.homedir()))
  ) {
    throw new Error("拒绝使用家目录或文件系统根作为项目根");
  }
  const pkg = JSON.parse(
    await readSafe(root, path.join(root, "packages/cli/package.json")),
  );
  const version = pkg.version;
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[a-z\d.-]+)?(?:\+[a-z\d.-]+)?$/i.test(version)
  ) {
    throw new Error("主 CLI 版本不是安全的版本目录名");
  }
  if (typeof source !== "string" || !source.trim())
    throw new Error("缺少产物来源 source");
  const packagesDir = path.join(root, "packages");
  await assertSafe(root, packagesDir);
  const entries = [
    {
      input: path.join(root, "README.md"),
      output: "docs/index.md",
      label: "开始",
    },
  ];
  for (const name of (await fs.readdir(packagesDir)).sort()) {
    const dir = path.join(packagesDir, name);
    await assertSafe(root, dir);
    if (!(await fs.stat(dir)).isDirectory()) continue;
    let info;
    try {
      info = JSON.parse(await readSafe(root, path.join(dir, "package.json")));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    entries.push({
      input: path.join(dir, "README.md"),
      output: `docs/packages/${name}.md`,
      label: info.name,
    });
  }
  // 完整读取和校验后再写盘，缺页、坏链接均不改变现有产物。
  const docs = [];
  for (const entry of entries) {
    const markdown = await readSafe(root, entry.input);
    docs.push({
      ...entry,
      markdown: rewriteMarkdown(
        stripDocsSiteLink(markdown, entry.label),
        entry,
        entries,
      ),
    });
  }
  const files = docs.map((doc) => ({ name: doc.output, body: doc.markdown }));
  files.push({
    name: "nav.json",
    body: `${JSON.stringify(
      entries.map((entry) => ({
        text: entry.label,
        link: path.posix.relative("docs", entry.output),
      })),
      null,
      2,
    )}\n`,
  });
  const metadata = `${JSON.stringify({ version, source }, null, 2)}\n`;
  scanContent([...files, { name: "current.json", body: metadata }]);
  return { version, documents: docs.length, files, metadata };
}

/** 白名单内容扫描：拒绝路径穿越、源码文件、map 和本机绝对路径。 */
export function scanContent(files) {
  for (const { name, body } of files) {
    if (
      !/^(?:docs\/(?:[a-z\d_.-]+\/)*[a-z\d_.-]+\.md|nav\.json|current\.json)$/i.test(
        name,
      ) ||
      name.split("/").some((part) => part === "." || part === "..")
    ) {
      throw new Error(`扫描失败：不允许的内容文件 ${name}`);
    }
    if (
      /sourceMappingURL\s*=|[a-z\d_.-]+\.(?:[cm]?js|css)\.map\b/i.test(body) ||
      /(?:^|[\s(["'`=])(?:file:\/\/|\/(?:Users|home|private|var|tmp|Volumes|mnt|opt|etc|usr|root)\/|[a-z]:[\\/]|\\\\[^\s\\]+\\)/im.test(
        body,
      )
    ) {
      throw new Error(`扫描失败：${name} 含 source map 或本机绝对路径`);
    }
  }
}

/** 先扫描，再临时写盘与 rename；current 最后安装，失败还原版本。 */
export async function installContent({ root, output, artifact }) {
  const { version, files, metadata } = artifact;
  if (!/^\d+\.\d+\.\d+(?:-[a-z\d.-]+)?(?:\+[a-z\d.-]+)?$/i.test(version))
    throw new Error("主 CLI 版本不是安全的版本目录名");
  scanContent([...files, { name: "current.json", body: metadata }]);
  const destination = path.join(output, version);
  const current = path.join(output, "current.json");
  await assertSafe(root, destination);
  await assertSafe(root, current);
  await fs.mkdir(output, { recursive: true });
  const scratch = await fs.mkdtemp(path.join(output, ".export-"));
  const next = path.join(scratch, "next");
  const previous = path.join(scratch, "previous");
  let moved = false;
  let installed = false;
  try {
    for (const file of files) {
      const target = path.join(next, file.name);
      await assertSafe(scratch, target);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.body);
    }
    await fs.writeFile(path.join(scratch, "current.json"), metadata);
    await assertSafe(root, destination);
    try {
      await fs.rename(destination, previous);
      moved = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await fs.rename(next, destination);
      installed = true;
      await assertSafe(root, current);
      await fs.rename(path.join(scratch, "current.json"), current);
    } catch (error) {
      if (installed) {
        await assertSafe(output, destination);
        await fs.rm(destination, { recursive: true, force: true });
      }
      if (moved) await fs.rename(previous, destination);
      throw error;
    }
    return {
      output,
      version,
      documents: artifact.documents,
      files: files.length + 1,
    };
  } finally {
    await assertSafe(output, scratch);
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

/** 本地导出入口固定写本仓验收目录，不接受跨仓路径。 */
export async function exportContent({ repoRoot = projectRoot, source }) {
  const root = await fs.realpath(repoRoot);
  const artifact = await collectContent({ repoRoot: root, source });
  return installContent({
    root,
    output: path.join(root, "test-results/showcase/content"),
    artifact,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 2)
      throw new Error(
        "内容导出不接受参数，输出固定在 test-results/showcase/content",
      );
    const { stdout } = await run("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
    });
    const result = await exportContent({
      source: `done-coding-cli@${stdout.trim()}`,
    });
    process.stdout.write(
      `已导出 ${result.documents} 篇文档：test-results/showcase/content/${result.version}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
