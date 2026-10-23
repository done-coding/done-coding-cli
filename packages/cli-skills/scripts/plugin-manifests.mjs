/**
 * 生成插件清单：`.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`。
 * ---
 * 本包即插件 `done-coding` 的内容（市场目录仓 done-coding-agent-plugins 以 npm 本包为来源）。
 * 版本只认 package.json：构建时生成，lerna publish 的 prepack 在改版本之后执行，
 * 发出去的清单版本必与包一致；生成物不入库（同 src/injectInfo.json）。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 插件名（宿主里的命名空间：Claude `/done-coding:<skill>`、Codex `$done-coding:<skill>`） */
export const PLUGIN_NAME = "done-coding";

const DESCRIPTION =
  "done-coding CLI 的 Agent Skills：用模板建项目、代码生成、模块模板生成、治理清单与跨仓 issue。";
const HOMEPAGE =
  "https://github.com/done-coding/done-coding-cli/tree/master/packages/cli-skills";
const REPOSITORY = "https://github.com/done-coding/done-coding-cli";
const KEYWORDS = ["done-coding", "scaffold", "codegen", "harness"];

/**
 * 按 package.json 构建两份清单
 * @param {{ version: string, author: string, license: string }} pkg
 * @returns {Record<string, object>} 相对包根的路径 → 清单内容
 */
export const buildPluginManifests = (pkg) => {
  const common = {
    name: PLUGIN_NAME,
    version: pkg.version,
    description: DESCRIPTION,
    author: { name: pkg.author },
    homepage: HOMEPAGE,
    repository: REPOSITORY,
    license: pkg.license,
    keywords: KEYWORDS,
  };
  return {
    ".claude-plugin/plugin.json": common,
    ".codex-plugin/plugin.json": {
      ...common,
      skills: "./skills/",
      interface: {
        displayName: "done-coding",
        shortDescription: "用 done-coding CLI 建项目、生成代码、维护治理目录",
        longDescription: DESCRIPTION,
        developerName: pkg.author,
        category: "Developer Tools",
        capabilities: ["Interactive", "Read", "Write"],
        defaultPrompt: [
          "用 done-coding 模板新建一个项目",
          "重生成治理清单并跑治理闸",
        ],
        websiteURL: HOMEPAGE,
      },
    },
  };
};

/** 写入包根 */
export const writePluginManifests = (pkgRoot) => {
  const pkg = JSON.parse(
    readFileSync(path.join(pkgRoot, "package.json"), "utf-8"),
  );
  const manifests = buildPluginManifests(pkg);
  for (const [rel, content] of Object.entries(manifests)) {
    const file = path.join(pkgRoot, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
  }
  return Object.keys(manifests);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkgRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  writePluginManifests(pkgRoot);
}
