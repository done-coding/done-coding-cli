/**
 * [T5] dc-generator list [type] handler（K5 两套 DTO，[MUST NOT] 互相复用）。
 *
 * 职责（design §4.1/§6.4）：
 *  - `dc-generator list`（无 type）= **dc-generator 发现 list**：listDiscoveredBatches("*") → 发现 DTO
 *    `{name,source,layer,shadowed}`。[MUST NOT] 写 component-name-list.json。
 *  - `dc-generator list <type>`（带批次）= **批次实例 list**：按该批次 config 枚举实例，
 *    -o（--output）时按 config.listSerializer（component 兼容形状）落地：
 *    字段序 + 不排序 + 指定缩进 + 无尾换行 + path.resolve(基准)。
 *  - 签名 (argv, ctxInit?)；三模式。
 */
import fs from "node:fs";
import path from "node:path";
import { discoverBatch, listDiscoveredBatches } from "@/core/batch-discovery";
import { createEnvContext } from "@/core/env-context";
import { resolveInstanceDir } from "@/core/instance-dir";
import type {
  BatchConfig,
  BatchInstanceListItem,
  EnvContext,
  GeneratorHandler,
  ListSerializerConfig,
  ResolvedBatch,
} from "@/types";
import {
  chalk,
  outputConsole,
  resolveHandlerContext,
  type HandlerContext,
} from "@done-coding/cli-utils";
import _template from "lodash.template";

/** 渲染单个 `${}` 表达式（content-free，沿用 lodash.template + 同一 env） */
const renderExpr = (expr: unknown, env: EnvContext): unknown => {
  if (typeof expr !== "string") {
    return expr;
  }
  return _template(expr)(env);
};

/**
 * 渲染整套 globalEnvData（声明式派生：series/fullName/cls…）。
 * 顺序求值并累积进 env，使后项可引用前项（与 batch 级联同向）。
 */
const renderGlobalEnvData = (
  config: BatchConfig,
  env: EnvContext,
): EnvContext => {
  const merged: EnvContext = { ...env };
  for (const [key, raw] of Object.entries(config.globalEnvData ?? {})) {
    merged[key] = renderExpr(raw, merged);
  }
  return merged;
};

/** 实例枚举：扫 instanceDir 的父目录一层子目录（复刻 component list.ts 扫子目录） */
const enumerateInstances = (config: BatchConfig, execDir: string): string[] => {
  if (config.list?.mode !== "subdir") {
    return [];
  }
  // 用空名渲染 instanceDir，取父目录作为扫描根（content-free：不写死 components 路径）
  // execDir = ctx.cwd（H2：实例枚举须与 add/discover 同基准）
  const probeEnv = createEnvContext("instance", {
    execDir,
    templateDir: "",
  });
  const probeInstanceDir = resolveInstanceDir(
    config,
    renderGlobalEnvData(config, probeEnv),
  );
  const scanRoot = path.dirname(probeInstanceDir);
  if (!fs.existsSync(scanRoot)) {
    return [];
  }
  const nameExcludes = config.list?.nameExcludes ?? [];
  return fs
    .readdirSync(scanRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !nameExcludes.includes(d.name))
    .map((d) => d.name);
};

/** 为单实例（subdir 名 = nameKebab）构造序列化字段映射 */
const buildInstanceItem = (
  nameKebab: string,
  opts: { config: BatchConfig; fields: string[]; execDir: string },
): BatchInstanceListItem => {
  const { config, fields, execDir } = opts;
  const env = renderGlobalEnvData(
    config,
    createEnvContext(nameKebab, { execDir, templateDir: "" }),
  );
  const item: BatchInstanceListItem = {};
  for (const field of fields) {
    item[field] = env[field];
  }
  return item;
};

/** 批次实例 list（dc-generator list <type>），可选 -o 落地（component 兼容 serializer） */
const listBatchInstances = (
  batch: ResolvedBatch,
  argv: { output?: string },
  ctx: HandlerContext,
) => {
  const { config } = batch;
  const serializer: ListSerializerConfig = config.listSerializer ?? {
    fields: ["name", "nameKebab"],
  };
  const names = enumerateInstances(config, ctx.cwd);
  const ordered = serializer.sort ? [...names].sort() : names;
  const items = ordered.map((nameKebab) =>
    buildInstanceItem(nameKebab, {
      config,
      fields: serializer.fields,
      execDir: ctx.cwd,
    }),
  );

  outputConsole.table(
    items.map((item) =>
      Object.fromEntries(
        serializer.fields.map((f) => [chalk.greenBright(f), item[f]]),
      ),
    ),
  );

  const outputPath = argv.output ?? config.nameListJsonOutputPath;
  if (outputPath) {
    // H2：cwd / execDir 两种基准均落 ctx.cwd（命令工作目录），三模式一致
    const base = ctx.cwd;
    const outputAbsolutePath = path.resolve(base, outputPath);
    const outputDir = path.dirname(outputAbsolutePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    outputConsole.stage(`输出实例名列表到 ${outputAbsolutePath}`);
    // 无尾换行（复刻 list.ts:113 JSON.stringify(.,null,indent)）
    fs.writeFileSync(
      outputAbsolutePath,
      JSON.stringify(items, null, serializer.indent ?? 2),
    );
  }
  return items;
};

/** dc-generator 发现 list（无 type）：跨层并集 + layer + shadowed（独立 DTO，K5） */
const listDiscovery = (ctx: HandlerContext) => {
  const items = listDiscoveredBatches("*", { cwd: ctx.cwd });
  outputConsole.table(
    items.map((item) => ({
      [chalk.greenBright("名称")]: item.name,
      [chalk.greenBright("来源")]: item.source,
      [chalk.greenBright("层级")]: item.layer,
      [chalk.greenBright("被遮蔽")]: item.shadowed ? "是" : "",
      // M1：非法批次标注，不静默吞
      [chalk.greenBright("非法")]: item.invalid ? "是" : "",
    })),
  );
  // M1：输出每个非法批次的 errors（不静默吞）
  for (const item of items) {
    if (item.invalid && item.errors?.length) {
      outputConsole.warn(
        `批次「${item.name}」(${item.layer}) 非法：\n  - ${item.errors.join("\n  - ")}`,
      );
    }
  }
  return items;
};

export const handler: GeneratorHandler = async (argv, ctxInit) => {
  const ctx = resolveHandlerContext(ctxInit);

  // 无 type → dc-generator 发现 list（独立 DTO，[MUST NOT] 写 component-name-list.json）
  if (!argv.type) {
    listDiscovery(ctx);
    return;
  }

  // 带 type → 批次实例 list（component 兼容 serializer）
  const batch = discoverBatch(argv.type, { cwd: ctx.cwd });
  listBatchInstances(batch, { output: argv.output }, ctx);
};
