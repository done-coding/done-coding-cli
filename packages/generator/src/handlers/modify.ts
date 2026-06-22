/**
 * [T5] dc-gen modify <type> <name> handler。
 *
 * 职责（design §4.1/§4.2/§7/§12-Ⓔ，NFR-1 P1 契约）：
 *  - 签名 (argv, ctxInit?)；内部 resolveHandlerContext 走三模式（cli/mcp/test）。
 *  - 单发 + `--list-questions` 探针 + 非交互供答（--env/--envFile）+ --skip-missing 块级跳过。
 *  - **无 draftId 草稿机**（Ⓔ）。
 *  - ensureNameLegal → discoverBatch → createEnvContext → operate(action:"modify")。
 *  - 非交互缺必填 positional → fail-fast（缺答交由级联 / operate 渲染期兜底）。
 */
import { discoverBatch } from "@/core/batch-discovery";
import { createEnvContext } from "@/core/env-context";
import { operate } from "@/core/operate";
import type { EnvContext, GeneratorHandler } from "@/types";
import { ensureNameLegal } from "@/utils/ensure-name";
import { resolveEnvSupply } from "@/utils/env-supply";
import { collectInteractiveAnswers, listBatchQuestions } from "./shared";
import { outputConsole, resolveHandlerContext } from "@done-coding/cli-utils";

/** 校验 modify 必备 positional（type/name）形态合法（fail-fast，server-agnostic） */
const ensureModifyArgs = (argv: {
  type?: string;
  name?: string;
}): { type: string; name: string } => {
  const missing: string[] = [];
  if (!argv.type) {
    missing.push("type（批次类型，dc-gen modify <type> <name>）");
  }
  if (!argv.name) {
    missing.push("name（实例名，dc-gen modify <type> <name>）");
  }
  if (missing.length) {
    throw new Error(`modify 缺少必填参数：\n  - ${missing.join("\n  - ")}`);
  }
  return { type: argv.type as string, name: argv.name as string };
};

export const handler: GeneratorHandler = async (argv, ctxInit) => {
  const ctx = resolveHandlerContext(ctxInit);

  // --list-questions 探针：仅回该批次问题清单（JSON / stdout），不落地（Ⓔ）
  if (argv.listQuestions) {
    if (!argv.type) {
      throw new Error(
        "--list-questions 需指定批次类型：dc-gen modify <type> --list-questions",
      );
    }
    const probed = discoverBatch(argv.type, { cwd: ctx.cwd });
    listBatchQuestions(probed.config);
    return;
  }

  const { type, name } = ensureModifyArgs(argv);

  const batch = discoverBatch(type, { cwd: ctx.cwd });
  ensureNameLegal(name, {
    nameExcludes: batch.config.nameExcludes,
    typeLabel: type,
  });

  // 内建 canonical + helper（execDir = ctx.cwd——三模式下 MCP/test 可注入异于
  // process.cwd 的工作目录，H2：产物落 ctx.cwd 而非 process.cwd，与发现 discover 同基准）
  const baseEnv = createEnvContext(name, {
    execDir: ctx.cwd,
    templateDir: batch.hit.realDir,
  });

  // 供答优先级：非交互供答（--env/--envFile）→ 交互补齐（仅 interactive 模式）
  const supplied =
    resolveEnvSupply({ env: argv.env, envFile: argv.envFile, cwd: ctx.cwd }) ??
    {};
  const answers = await collectInteractiveAnswers({
    config: batch.config,
    supplied,
    baseEnv,
    ctx,
  });

  // 采集答案合并进开放 env（供 operate 内 batch 级联 / 渲染消费，content-free）
  const env: EnvContext = { ...baseEnv, ...supplied, ...answers };

  outputConsole.stage(`修改 ${type} 实例：${name}`);
  await operate({
    action: "modify",
    batch,
    env,
    skipMissing: argv.skipMissing as boolean | undefined,
  });
};
