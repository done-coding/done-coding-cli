/**
 * [T5] dc-gen <type> remove <name> handler（反配方）。
 *
 * 职责（design §4.4，R4③ + R8，M1/M2）：
 *  - 签名 (argv, ctxInit?)；三模式 + 非交互 fail-fast（缺必填 positional）。
 *  - ensureNameLegal → discoverBatch → createEnvContext → operate(action:"remove")。
 *  - operate 内走 M1 dry-run 事务边界（append 命中检测 + replace 不可回滚预检，全过才删）+
 *    removeEmptyDir（实例子目录空则 rmdir）。本层只负责命令面契约，删除事务在 T4 operate。
 */
import { discoverBatch } from "@/core/batch-discovery";
import { createEnvContext } from "@/core/env-context";
import { operate } from "@/core/operate";
import type { EnvContext, GeneratorHandler } from "@/types";
import { ensureNameLegal } from "@/utils/ensure-name";
import { resolveEnvSupply } from "@/utils/env-supply";
import { collectInteractiveAnswers } from "./shared";
import { outputConsole, resolveHandlerContext } from "@done-coding/cli-utils";

/** 校验 remove 必备 positional（type/name）形态合法（fail-fast，server-agnostic） */
const ensureRemoveArgs = (argv: {
  type?: string;
  name?: string;
}): { type: string; name: string } => {
  const missing: string[] = [];
  if (!argv.type) {
    missing.push("type（批次类型，dc-gen remove <type> <name>）");
  }
  if (!argv.name) {
    missing.push("name（实例名，dc-gen remove <type> <name>）");
  }
  if (missing.length) {
    throw new Error(`remove 缺少必填参数：\n  - ${missing.join("\n  - ")}`);
  }
  return { type: argv.type as string, name: argv.name as string };
};

export const handler: GeneratorHandler = async (argv, ctxInit) => {
  const ctx = resolveHandlerContext(ctxInit);
  const { type, name } = ensureRemoveArgs(argv);

  const batch = discoverBatch(type, { cwd: ctx.cwd });
  ensureNameLegal(name, {
    nameExcludes: batch.config.nameExcludes,
    typeLabel: type,
  });

  // execDir = ctx.cwd（H2：与 add/discover 同基准，MCP/test 注入工作目录时一致）
  const baseEnv = createEnvContext(name, {
    execDir: ctx.cwd,
    templateDir: batch.hit.realDir,
  });

  // remove 反配方需与 add 同序、同变量上下文复算落地块（含 globalEnvData 派生）。
  // 供答用于复算（如带 series/prefix 的块）；非交互模式仅取 supplied。
  const supplied =
    resolveEnvSupply({ env: argv.env, envFile: argv.envFile, cwd: ctx.cwd }) ??
    {};
  // H4b：交互 prompt 默认值用 initial（按累积 env 渲染），baseEnv 作级联底座
  const answers = await collectInteractiveAnswers({
    config: batch.config,
    supplied,
    baseEnv,
    ctx,
  });

  const env: EnvContext = { ...baseEnv, ...supplied, ...answers };

  outputConsole.stage(`移除 ${type} 实例：${name}`);
  await operate({
    action: "remove",
    batch,
    env,
    // 修订-3：透传可疑根逃逸旗标至 removeEmptyInstanceDir。
    // codex 终审 M：合并 argv 与 ctxInit（ctx.allowDangerous），programmatic/server
    // 调用传 ctxInit.allowDangerous 同样生效。
    ...(argv.allowDangerous || ctx.allowDangerous
      ? { allowDangerous: true }
      : {}),
  });
};
