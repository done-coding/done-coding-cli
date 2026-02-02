import type {
  ArgumentsCamelCase,
  CommandModule,
  Options as YargsOptions,
  Argv as YargsArgv,
} from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { outputConsole } from "@/env-config";
import type { PackageJson } from "./package-json";

export { ArgumentsCamelCase, CommandModule, YargsOptions, YargsArgv };

/** yargs options 记录 */
export type YargsOptionsRecord<T extends Record<string, any>> = {
  [key in keyof T]: YargsOptions;
};

/** yargs 位置参数 */
export type YargsPositionalsRecord<T extends Record<string, any>> = {
  [key in keyof T]: Parameters<typeof yargs.positional>[1];
};

/** cli 信息 */
export interface CliInfo<
  O extends Record<string, any> = Record<string, any>,
  P extends Record<string, any> = Record<string, any>,
> {
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
  options?: YargsOptionsRecord<O>;
  /** 子命令 */
  subcommands?: CommandModule[];
  /** 位置信息 */
  positionals?: YargsPositionalsRecord<P>;
  /** 处理函数 */
  handler?: CommandModule["handler"];
  /** 根命令 */
  rootScriptName?: string;
}

/** 子cli信息 */
export interface SubCliInfo extends CliInfo {
  /** 命令 */
  command: string;
}

/** 处理函数参数类型 */
export type CliHandlerArgv<O> = ArgumentsCamelCase<O> | O;

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    outputConsole.error(msg);
  } else {
    outputConsole.error(err.message);
  }
  if (err?.stack) {
    outputConsole.error(err.stack);
  }
  process.exit(1);
};

/** 创建 yargs */
const createYargs = <O>() => {
  const argv = hideBin(process.argv);
  return yargs(argv) as YargsArgv<O>;
};

/** 获取根命令名称 */
export const getRootScriptName = ({
  rootScriptName,
  packageJson,
}: {
  rootScriptName?: string;
  packageJson?: Pick<PackageJson, "name" | "bin">;
}): string | undefined => {
  if (rootScriptName) {
    return rootScriptName;
  }

  if (!packageJson) {
    // console.log('packageJson is undefined')
    return;
  }
  const { bin, name } = packageJson;
  if (!bin) {
    // console.log('bin is undefined', bin)
    return;
  }
  if (typeof bin === "string") {
    if (name.includes("/")) {
      // console.log('带/', name)
      return;
    }
    return name;
  }
  if (typeof bin === "object") {
    const binList = Object.entries(bin);
    const execFile = process.argv[1];
    // console.log(100, process.argv[1], execFile, bin)
    const resList = binList.filter(([, value]) => execFile?.endsWith(value));
    // 未找到匹配执行文件 或者 匹配到多个执行文件 无法区分调用命令
    if (resList.length !== 1) {
      // console.log('匹配不到执行文件', resList)
      return;
    }
    const [binNme] = resList[0];
    // windows下不存在大写命令 所以需要转小写
    return process.platform === "win32" ? binNme.toLowerCase() : binNme;
  }
};

/** 添加 yargs 配置 */
const addYargsConfig = (
  argv: YargsArgv,
  {
    usage,
    version,
    demandCommandCount,
    options,
    positionals,
    subcommands,
    rootScriptName,
  }: Omit<CliInfo, "handler">,
  isRootCommand: boolean,
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
  // 有子命令
  if (subcommands) {
    argvFinal = argvFinal.command(subcommands);
  }

  // console.log(154, isRootCommand, rootScriptName)

  if (isRootCommand) {
    if (rootScriptName) {
      argvFinal = argvFinal.scriptName(rootScriptName);
    }
  }
  return argvFinal;
};

/** 创建主命令 */
export const createMainCommand = async ({ handler, ...config }: CliInfo) => {
  const argv = await addYargsConfig(createYargs(), config, true).fail(
    failHandler,
  ).argv;
  return handler ? handler(argv) : argv;
};

/** 创建子命令模块 */
export const createSubcommand = (cliInfo: SubCliInfo): CommandModule => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { command, describe, handler = () => {}, ...config } = cliInfo;
  return {
    command,
    describe,
    builder(argv) {
      return addYargsConfig(argv, config, false) as unknown as YargsArgv;
    },
    handler,
  };
};
