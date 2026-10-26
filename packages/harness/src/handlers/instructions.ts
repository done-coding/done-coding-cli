import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
} from "@done-coding/cli-utils";
import { readConfig } from "@/core/config";
import { runInstructions } from "@/core/instructions";
import { SubcommandEnum, type InstructionsOptions } from "@/types";

/** 指令闸：JSON 输出不混入人读日志，退出码与文本模式一致。 */
export const handler = async (argv: CliHandlerArgv<InstructionsOptions>) => {
  const cwd = safeCwd();
  const result = runInstructions(cwd, readConfig(cwd).instructions);
  if (argv.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.errors.length) {
    result.errors.forEach((error) => outputConsole.error(`❌ ${error}`));
  } else {
    outputConsole.success("✅ 指令预算 / 链路预算 / CLAUDE.md 兼容入口 全过");
  }
  return result.errors.length ? 1 : 0;
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INSTRUCTIONS,
  describe: "检查 AGENTS.md 字节预算、链路预算与 CLAUDE.md 兼容入口",
  options: { json: { type: "boolean", default: false, describe: "输出 JSON" } },
  handler: (async (argv: CliHandlerArgv<InstructionsOptions>) => {
    process.exitCode = await handler(argv);
  }) as SubCliInfo["handler"],
};
