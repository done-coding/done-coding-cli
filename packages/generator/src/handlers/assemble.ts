/**
 * assemble handler 族（Wave C3，design §2 / §14 D-M1 / D-M8 / D-H1）。
 *
 * 真子命令 `dc-gen assemble plan|build|diff|check`（cli-utils addSubcommands 嵌套，见 index.ts）。
 * server-agnostic：`assembleHandler(argv, ctxInit?)`，内部 resolveHandlerContext 走 cwd。
 *  - plan/diff `--json` → stdout 洁净 JSON（对齐 P3 B5）；非 json 走 outputConsole。
 *  - 库函数（engine/recipe/create-sync）throw / 返回结果，[MUST NOT] process.exit。
 *  - diff/check drift → 返回 result.exitCode=1；进程退出码由 cli 边界（index.ts 包装）落地。
 *
 * [MUST NOT] 接 MCP server（A-NFR-2 本期不做三面）；退出码红线见 design §2。
 */
import path from "node:path";
import {
  outputConsole,
  resolveHandlerContext,
  type HandlerContextInit,
} from "@done-coding/cli-utils";
import type {
  AssembleAction,
  AssembleHandlerArgv,
  Recipe,
} from "@/assemble/types";
import {
  discoverRecipes,
  loadRecipe,
  recipeDir as recipeDirOf,
} from "@/assemble/recipe";
import {
  assertOutputsCompatible,
  runBuild,
  runDiff,
  runPlan,
  type DriftResult,
  type EngineCtx,
} from "@/assemble/engine";
import { syncCreateTemplate } from "@/assemble/create-sync";

/** handler 返回结果（exitCode 供 cli 边界落地，[MUST NOT] 库内 process.exit）。 */
export interface AssembleHandlerResult {
  action: AssembleAction;
  /** 0=正常；1=漂移（diff/check） */
  exitCode: number;
  /** 机器可读载荷（--json 时序列化到 stdout 已由 handler 负责） */
  payload?: unknown;
}

/** 解析待处理的配方绝对路径列表（--recipe / --all / 约定首个）。 */
const resolveRecipePaths = (
  argv: AssembleHandlerArgv,
  cwd: string,
): string[] => {
  if (argv.all) {
    const all = discoverRecipes(cwd);
    if (all.length === 0) {
      throw new Error(`--all 未在 ${recipeDirOf(cwd)} 找到任何 *.json5 配方`);
    }
    return all;
  }
  if (argv.recipe) {
    return [path.resolve(cwd, argv.recipe)];
  }
  const all = discoverRecipes(cwd);
  if (all.length === 0) {
    throw new Error(
      `未指定 --recipe，且约定目录 ${recipeDirOf(cwd)} 无 *.json5 配方`,
    );
  }
  return [all[0]];
};

/** stdout 洁净 JSON（--json，对齐 P3 B5）。 */
const emitJson = (data: unknown): void => {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};

const handlePlan = (
  recipes: Recipe[],
  ctx: EngineCtx,
  argv: AssembleHandlerArgv,
): AssembleHandlerResult => {
  const plans = recipes.map((r) => runPlan(r, ctx));
  if (argv.json) {
    emitJson(plans);
  } else {
    for (const p of plans) {
      outputConsole.stage(`plan: ${p.recipeId}（${p.items.length} ops）`);
      for (const item of p.items) {
        const flag = item.discardsPrior ? " [discard-prior]" : "";
        outputConsole.info(
          `  ${item.type} #${item.id} → ${item.target}${flag}`,
        );
      }
    }
  }
  return { action: "plan", exitCode: 0, payload: plans };
};

const handleBuild = (
  recipes: Recipe[],
  ctx: EngineCtx,
  argv: AssembleHandlerArgv,
): AssembleHandlerResult => {
  const results = recipes.map((r) => {
    const built = runBuild(r, ctx, {
      ...(argv.forceClean ? { forceClean: true } : {}),
      ...(argv.allowUntrackedDelete ? { allowUntrackedDelete: true } : {}),
    });
    const sync = syncCreateTemplate(ctx.cwd, r);
    return { ...built, createSync: sync };
  });
  if (argv.json) {
    emitJson(results);
  } else {
    for (const r of results) {
      outputConsole.success(
        `build: ${r.recipeId} → ${r.output}（${r.files.length} files）`,
      );
      if (r.createSync.synced) {
        outputConsole.info(
          `  create templateList ${r.createSync.inserted ? "新增" : "更新"}：${r.createSync.name}`,
        );
      }
    }
  }
  return { action: "build", exitCode: 0, payload: results };
};

const reportDrift = (results: DriftResult[]): void => {
  for (const r of results) {
    if (!r.drifted) {
      outputConsole.success(
        `diff: ${r.recipeId} 无漂移（against=${r.against}）`,
      );
      continue;
    }
    outputConsole.error(
      `diff: ${r.recipeId} 检测到 ${r.entries.length} 处漂移（against=${r.against}）`,
    );
    for (const e of r.entries) {
      outputConsole.error(`  [${e.kind}] ${e.file} — ${e.message}`);
    }
  }
};

const handleDiff = (
  recipes: Recipe[],
  ctx: EngineCtx,
  arg: { argv: AssembleHandlerArgv; action: "diff" | "check" },
): AssembleHandlerResult => {
  const { argv, action } = arg;
  const results = recipes.map((r) =>
    runDiff(r, ctx, {
      ...(argv.against ? { against: argv.against } : {}),
      ...(argv.outDir ? { outDir: argv.outDir } : {}),
    }),
  );
  if (argv.json) {
    emitJson(results);
  } else {
    reportDrift(results);
  }
  const drifted = results.some((r) => r.drifted);
  return { action, exitCode: drifted ? 1 : 0, payload: results };
};

/**
 * assemble handler（server-agnostic）。
 * action 缺省 = plan。库 throw fail-loud；diff/check drift → exitCode=1（cli 落地）。
 */
export const assembleHandler = async (
  argv: AssembleHandlerArgv,
  ctxInit?: HandlerContextInit,
): Promise<AssembleHandlerResult> => {
  const hctx = resolveHandlerContext(ctxInit);
  const ctx: EngineCtx = {
    cwd: hctx.cwd,
    // 修订-1：透传可疑根逃逸旗标（仅 runBuild 生效）。
    // codex 终审 M：合并 argv 与 ctxInit（hctx.allowDangerous），使 programmatic/server
    // 调用传 ctxInit.allowDangerous 同样生效，不止 CLI --allow-dangerous。
    ...(argv.allowDangerous || hctx.allowDangerous
      ? { allowDangerous: true }
      : {}),
  };
  const action: AssembleAction = argv.action ?? "plan";

  const paths = resolveRecipePaths(argv, hctx.cwd);
  const recipes = paths.map(loadRecipe);
  if (argv.all || recipes.length > 1) {
    assertOutputsCompatible(ctx, recipes);
  }

  switch (action) {
    case "plan":
      return handlePlan(recipes, ctx, argv);
    case "build":
      return handleBuild(recipes, ctx, argv);
    case "diff":
      return handleDiff(recipes, ctx, { argv, action: "diff" });
    case "check":
      return handleDiff(recipes, ctx, { argv, action: "check" });
    default:
      throw new Error(`未知 assemble action：${String(action)}`);
  }
};
