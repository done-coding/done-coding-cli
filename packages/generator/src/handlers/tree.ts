/**
 * tree handler 族（codegen-unified T4，模块生成编排 + 注入）。
 *
 * 真子命令 `dc-generator tree build|check`（cli-utils addSubcommands 嵌套，见 index.ts）。
 * 设计 = gitRoot 锚定，模块 spec = 标准 assemble Recipe（json5，`loadRecipe`/`discoverRecipes`
 * 原样复用），target 基准 = gitRoot 项目内（design §四-补 ⓓ）：
 *  - `tree build` = 拆 ops → 页面（addFragment/writeFile）runBuild + 注入（textPatch）
 *    applyInjections，原子顺序 = ① 全内存 compute 注入 → ② 页面 build → ③ commit 注入
 *    （design §四-补 ⓒ-5；注入失败 = 页面零落盘，页面失败 = 注入未 commit）。
 *  - `tree check` = 页面漂移闸（runDiff(pageRecipe)——注入 ops 非 manifest 产物，排除）。
 *  - gitRoot 解析：`git rev-parse --show-toplevel`，非 git 仓 **fail-loud**（[MUST] 在 git 项目内调用）。
 *
 * server-agnostic：`treeHandler(argv, ctxInit?)`，内部 resolveHandlerContext 走 cwd → 锚定 gitRoot。
 * 直接用 runBuild/runDiff/EngineCtx（@/assemble/engine）——拆分需 recipe 级控制，runBuild 即
 * assemble 引擎本体（"复用 assemble 引擎"成立，不重实现引擎逻辑）。
 */
import { execFileSync } from "node:child_process";
import {
  outputConsole,
  resolveDoneCodingDir,
  resolveHandlerContext,
  type HandlerContextInit,
} from "@done-coding/cli-utils";
import type {
  AssembleHandlerArgv,
  AssembleOp,
  Recipe,
  TextPatchOp,
} from "@/assemble/types";
import {
  emitJson,
  reportDrift,
  resolveRecipePaths,
  type AssembleHandlerResult,
} from "@/handlers/assemble";
import { fragmentRoot as fragmentRootOf, loadRecipe } from "@/assemble/recipe";
import {
  assertOutputsCompatible,
  runBuild,
  runDiff,
  type EngineCtx,
} from "@/assemble/engine";
import {
  computeInjections,
  commitInjections,
  type InjectionPlan,
} from "@/assemble/inject/inject";

/** 解析 git 仓根（tree 命令 target 基准）；非 git 仓 fail-loud，无 cwd 回退。 */
export const resolveGitRoot = (cwd: string): string => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    throw new Error(
      `不在 git 仓内，无法执行 tree 命令（[MUST] 在 git 项目内调用）：${cwd}`,
    );
  }
};

/** 模块 spec 允许的 op type（design §四-补 ⓐ）：页面 addFragment/writeFile + 注入 textPatch。 */
const PAGE_OP_TYPES = new Set(["addFragment", "writeFile"]);
const INJECT_OP_TYPE = "textPatch";

/** 拆 ops → 页面 ops / 注入 ops；出现允许集外 type → fail-loud（不静默丢弃）。 */
const splitOps = (
  recipe: Recipe,
): { pageOps: AssembleOp[]; injectOps: TextPatchOp[] } => {
  const pageOps: AssembleOp[] = [];
  const injectOps: TextPatchOp[] = [];
  for (const op of recipe.ops) {
    if (PAGE_OP_TYPES.has(op.type)) {
      pageOps.push(op);
      continue;
    }
    if (op.type === INJECT_OP_TYPE) {
      injectOps.push(op as TextPatchOp);
      continue;
    }
    throw new Error(
      `模块 spec「${recipe.id}」op type「${op.type}」不在允许集（addFragment/writeFile/textPatch），注入声明仅 textPatch（design §四-补 ⓐ）`,
    );
  }
  return { pageOps, injectOps };
};

/** 页面 recipe（注入 ops 从 module spec 剔除——注入非 manifest 产物，ⓓ/ⓔ）。 */
const pageRecipeOf = (recipe: Recipe): Recipe => {
  const { pageOps } = splitOps(recipe);
  return { ...recipe, ops: pageOps };
};

/**
 * 单 recipe build：① compute 注入（内存，失败=页面零落盘）→ ② runBuild 页面 →
 * ③ commit 注入（design §四-补 ⓒ-5 原子顺序）。
 */
const buildOne = (
  recipe: Recipe,
  ctx: EngineCtx,
  argv: AssembleHandlerArgv,
): { recipeId: string; output: string; files: string[] } => {
  // 控制器裁决：模块配方不同步 create templateList（createTemplate 仅项目级模板配方适用）——
  // 携带则 fail-loud，不静默丢弃（评审 Minor-1）。
  if (recipe.createTemplate) {
    throw new Error(
      `tree 模块配方「${recipe.id}」不支持 createTemplate（createTemplate 仅项目级模板配方适用，模块配方不同步 create templateList）`,
    );
  }
  const { pageOps, injectOps } = splitOps(recipe);
  const pageRecipe = { ...recipe, ops: pageOps };
  let plan: InjectionPlan | undefined;
  if (injectOps.length > 0) {
    // ① 注入全内存计算（任何 throw = 页面/注入均零落盘）
    plan = computeInjections(injectOps, {
      gitRoot: ctx.cwd,
      vars: recipe.vars ?? {},
      fragmentRoot: ctx.fragmentRoot ?? fragmentRootOf(ctx.cwd),
    });
  }
  // ② 页面 build（engine 原子 flush；失败则注入未 commit → 无半态）
  const built = runBuild(pageRecipe, ctx, {
    ...(argv.forceClean ? { forceClean: true } : {}),
    ...(argv.allowUntrackedDelete ? { allowUntrackedDelete: true } : {}),
  });
  // ③ commit 注入（逐文件原子，marker 幂等可重跑）
  if (plan) {
    commitInjections(plan, { gitRoot: ctx.cwd });
  }
  return built;
};

const handleBuild = (
  recipes: Recipe[],
  ctx: EngineCtx,
  argv: AssembleHandlerArgv,
): AssembleHandlerResult => {
  const results = recipes.map((r) => buildOne(r, ctx, argv));
  if (argv.json) {
    emitJson(results);
  } else {
    for (const r of results) {
      outputConsole.success(
        `tree build: ${r.recipeId} → ${r.output}（${r.files.length} files）`,
      );
    }
  }
  return { action: "build", exitCode: 0, payload: results };
};

const handleCheck = (
  recipes: Recipe[],
  ctx: EngineCtx,
  argv: AssembleHandlerArgv,
): AssembleHandlerResult => {
  const results = recipes.map((r) =>
    runDiff(pageRecipeOf(r), ctx, {
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
  return { action: "check", exitCode: drifted ? 1 : 0, payload: results };
};

/**
 * tree handler（server-agnostic）。
 * gitRoot 锚定 → 拆 ops（页面 + 注入）→ build/check 编排；exitCode 语义同 assemble。
 */
export const treeHandler = async (
  argv: AssembleHandlerArgv,
  ctxInit?: HandlerContextInit,
): Promise<AssembleHandlerResult> => {
  const hctx = resolveHandlerContext(ctxInit);
  const gitRoot = resolveGitRoot(hctx.cwd);
  // ⓔ：碎片根 = 就近 `.done-coding/templates/` 根（resolveDoneCodingDir 就近向上+全局，命中
  // 用 realDir）；未命中 → 不设 fragmentRoot，引擎回落 assemble 默认 fragments 根
  // （engine resolveFragmentRoot 的 `ctx.fragmentRoot ?? defaultFragmentRoot(ctx.cwd)`）。
  // addFragment source 约定 = `<base>/<template>/fragments/<file>`（design §三-补 ⓔ）。
  const templatesHit = resolveDoneCodingDir("templates", { cwd: gitRoot });
  const ctx: EngineCtx = {
    cwd: gitRoot,
    ...(templatesHit ? { fragmentRoot: templatesHit.realDir } : {}),
    // 修订-1：透传可疑根逃逸旗标（仅 runBuild 生效），对齐 assembleHandler 语义。
    ...(argv.allowDangerous || hctx.allowDangerous
      ? { allowDangerous: true }
      : {}),
  };
  const action = argv.action ?? "build";
  const paths = resolveRecipePaths(argv, gitRoot);
  const recipes = paths.map(loadRecipe);
  if (argv.all || recipes.length > 1) {
    assertOutputsCompatible(ctx, recipes);
  }
  switch (action) {
    case "build":
      return handleBuild(recipes, ctx, argv);
    case "check":
      return handleCheck(recipes, ctx, argv);
    default:
      throw new Error(`未知 tree action：${String(action)}`);
  }
};
