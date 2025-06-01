import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { log } from "./log";

/** cli 信息 */
export interface CliInfo {
  /** 命令 */
  command?: string;
  /** 用法 */
  usage?: string;
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
  /** 子命令 */
  subcommands?: CommandModule[];
  /** 位置信息 */
  positionals?: {
    [key in string]: Parameters<typeof yargs.positional>[1];
  };
  /** 处理函数 */
  handler?: CommandModule["handler"];
}

/** 子cli信息 */
export interface SubCliInfo extends CliInfo {
  /** 命令 */
  command: string;
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
const createYargs = <O>() => {
  const argv = hideBin(process.argv);
  return yargs(argv) as yargs.Argv<O>;
};

/** 添加 yargs 配置 */
const addYargsConfig = (
  argv: yargs.Argv,
  {
    usage,
    version,
    demandCommandCount,
    options,
    positionals,
    subcommands,
  }: Omit<CliInfo, "handler">,
) => {
  let argvFinal = argv.strict();
  if (usage) {
    argvFinal = argvFinal.usage(`Usage: ${usage}`);
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
  if (positionals) {
    argvFinal = Object.entries(positionals).reduce((acc, [name, options]) => {
      return acc.positional(name, options);
    }, argvFinal);
  }
  if (subcommands) {
    argvFinal = argvFinal.command(subcommands);
  }
  return argvFinal.fail(failHandler).argv;
};

/** 创建主命令 */
export const createMainCommand = async ({ handler, ...config }: CliInfo) => {
  const argv = await addYargsConfig(createYargs(), config);
  return handler ? handler(argv) : argv;
};

/** 创建子命令模块 */
export const createSubcommand = (cliInfo: SubCliInfo): yargs.CommandModule => {
  const { command, describe, handler = () => {}, ...config } = cliInfo;
  return {
    command,
    describe,
    builder(argv) {
      return addYargsConfig(argv, config) as unknown as yargs.Argv;
    },
    handler,
  };
};
