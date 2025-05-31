import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { log } from "./log";

/** 子命令 cli 信息 */
export type SubcommandCliInfo = Pick<
  CommandModule,
  "command" | "describe" | "handler" | "builder"
>;

/** cli 信息 */
export interface CliInfo {
  /**
   * 命令用法
   * --
   * 不用带 Usage:
   */
  command?: string;
  /** 描述信息  */
  describe?: string;
  /** 版本号 */
  version?: string;
  /** 必传命令数 */
  demandCommandCount?: number;
  /** 选项 */
  options?: {
    [key in string]: YargsOptions;
  };
  handler?: CommandModule["handler"];
  /** 子命令 */
  subcommands?: SubcommandCliInfo[];
}

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    log.error(msg);
  } else {
    log.error(err.message);
  }
  if (err?.stack) {
    log.error(err.stack);
  }
  process.exit(1);
};

/** 创建 yargs */
export const createYargs = () => {
  const argv = hideBin(process.argv);
  return yargs(argv);
};

/** 附加配置 */
const attachConfig = (
  argv: yargs.Argv,
  {
    command,
    version,
    demandCommandCount,
    options,
  }: Omit<CliInfo, "handler" | "subcommands">,
) => {
  let argvFinal = argv.strict();
  if (command) {
    argvFinal = argvFinal.usage(`Usage: ${command}`);
  }
  if (demandCommandCount) {
    argvFinal = argvFinal.demandCommand(demandCommandCount);
  }

  const HELP_FLAG = "help";
  argvFinal = argvFinal.help(HELP_FLAG);

  if (version) {
    argvFinal = argvFinal
      .version(version)
      .alias("h", HELP_FLAG)
      .alias("v", "version");
  } else {
    argvFinal = argvFinal.alias("h", HELP_FLAG);
  }
  if (options) {
    argvFinal = argvFinal.options(options);
  }
  return argvFinal;
};

/** 附加子命令 */
const attachSubcommands = (
  argv: yargs.Argv,
  subcommands?: CliInfo["subcommands"],
) => {
  if (Array.isArray(subcommands) && subcommands.length) {
    return subcommands.reduce((preArgv, subcommand) => {
      return preArgv.command(subcommand);
    }, argv);
  } else {
    return argv;
  }
};

/** 解析 argv */
export const parseArgv = async ({
  argv = createYargs(),
  info: { handler, subcommands, ...config },
}: {
  argv?: yargs.Argv;
  info: CliInfo;
}) => {
  const attachConfigFinal = attachConfig(argv, config);
  const attachSubcommandsFinal = attachSubcommands(
    attachConfigFinal,
    subcommands,
  );

  const argvFinal = await attachSubcommandsFinal.fail(failHandler).argv;

  return handler ? handler(argvFinal) : argvFinal;
};
