import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import injectInfo from "@/injectInfo.json";
import {
  buildCatalog,
  catalogScopes,
  checkCatalog,
  DEFAULT_NPM_REGISTRY,
  inspectInstalled,
  type Catalog,
  type CatalogPackage,
} from "@/core/catalog";
import { SubcommandEnum, type CatalogOptions } from "@/types";

const getOptions = (): YargsOptionsRecord<CatalogOptions> => ({
  json: { type: "boolean", describe: "输出 JSON", default: false },
  installed: {
    type: "boolean",
    describe: "只看当前项目装了目录里的哪些包、同系列版本是否一致",
    default: false,
  },
  check: {
    type: "boolean",
    describe:
      "目录过期 / 缺数据即退出码 1：本机仓落后 npm、缺描述、系列缺概述、npm 未比对",
    default: false,
  },
  offline: {
    type: "boolean",
    describe: "不访问 npm，只读注册表里的本机仓",
    default: false,
  },
  registry: {
    type: "string",
    describe: `npm 源，缺省 ${DEFAULT_NPM_REGISTRY}（镜像可能滞后）`,
  },
});

/** 超过这么多天未发布的包加「久未更新」提示（事实标注，不下结论） */
const STALE_DAYS = 180;

/** 一个包在目录里的一行 */
const describePackage = (pkg: CatalogPackage): string => {
  const version =
    pkg.version ?? (pkg.localVersion ? `本机 ${pkg.localVersion}` : "?");
  const membership =
    pkg.bundles.length >= 2
      ? `聚合入口：含 ${pkg.bundles.join("、")}`
      : pkg.includedIn.length
        ? `已含在 ${pkg.includedIn.join("、")} 里`
        : pkg.dependents.length
          ? `被 ${pkg.dependents.join("、")} 依赖`
          : "不在任何聚合入口里，需单独安装";
  const tags = [
    pkg.ecosystem === "npm" ? membership : "Python",
    pkg.peers.length ? `须搭配 ${pkg.peers.join("、")}` : "",
    pkg.registry ? `发布到 ${pkg.registry}` : "",
    !pkg.version && pkg.ecosystem === "npm" ? "未上 npm" : "",
    pkg.deprecated ? `已弃用：${pkg.deprecated}` : "",
    pkg.published &&
    Date.now() - Date.parse(pkg.published) > STALE_DAYS * 86400000
      ? `最后发布 ${pkg.published.slice(0, 10)}，${STALE_DAYS} 天以上未更新`
      : "",
  ].filter(Boolean);
  return `  ${pkg.name} ${version} — ${pkg.description || "（无描述）"}${
    tags.length ? `\n      [${tags.join("；")}]` : ""
  }\n      文档：${pkg.docs}`;
};

const printCatalog = (catalog: Catalog): void => {
  for (const series of catalog.series) {
    const source =
      series.overviewSource === "registry"
        ? "注册表定位"
        : series.overviewSource === "aggregate"
          ? "聚合包描述"
          : "";
    process.stdout.write(
      `\n## ${series.name}${series.overview ? `：${series.overview}` : "（无概述）"}${
        source ? `（${source}）` : ""
      }\n`,
    );
    series.packages.forEach((pkg) =>
      process.stdout.write(`${describePackage(pkg)}\n`),
    );
  }
};

/** 能力目录。返回退出码 */
export const handler = async (argv: CliHandlerArgv<CatalogOptions>) => {
  const catalog = await buildCatalog({
    selfName: injectInfo.name,
    registry: argv.registry,
    offline: argv.offline,
  });
  if (catalog.npm.state !== "ok") {
    outputConsole.warn(
      `⚠️ 未比对 npm（${catalog.npm.state === "offline" ? catalog.npm.error : "--offline"}）：只列注册表里本机仓的包，已发布版本未知`,
    );
  }
  if (argv.installed) {
    const { rows, warnings } = inspectInstalled(
      safeCwd(),
      catalog,
      catalogScopes(catalog, injectInfo.name),
    );
    if (argv.json) {
      process.stdout.write(`${JSON.stringify({ rows, warnings }, null, 2)}\n`);
    } else {
      if (!rows.length) outputConsole.info("当前项目没有装目录里的包");
      rows.forEach((r) =>
        process.stdout.write(
          `${r.name}\t声明 ${r.declared ?? "—"}\t已装 ${r.installed ?? "—"}\tnpm ${r.latest ?? "—"}\t（${r.series}）\n`,
        ),
      );
      warnings.forEach((w) => outputConsole.warn(`⚠️ ${w}`));
    }
    return 0;
  }
  if (argv.check) {
    const problems = checkCatalog(catalog);
    if (problems.length) {
      problems.forEach((p) => outputConsole.error(`❌ ${p}`));
      return 1;
    }
    outputConsole.success(
      `✅ 目录与事实源一致：${catalog.series.length} 个系列、${catalog.series.reduce((n, s) => n + s.packages.length, 0)} 个包`,
    );
    return 0;
  }
  if (argv.json) process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
  else printCatalog(catalog);
  return 0;
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.CATALOG,
  describe:
    "能力目录：done-coding 已发布包 + 注册表里本机仓的包，按仓分系列（现取 npm 与本机仓，不存清单）",
  options: getOptions(),
  handler: (async (argv: CliHandlerArgv<CatalogOptions>) => {
    process.exitCode = await handler(argv);
  }) as SubCliInfo["handler"],
};
