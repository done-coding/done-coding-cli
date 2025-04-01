import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Options } from "@/utils";
import { OutputModeEnum } from "@/utils";
import { handler } from "@/handler";
import chalk from "chalk";
import injectInfo from "@/injectInfo.json";

const getOptions = (): {
  [key in keyof Options]: YargsOptions;
} => {
  return {
    envJson: {
      alias: "j",
      describe: "环境数据文件JSON文件相对路径(优先级高于envData)",
      type: "string",
    },
    envData: {
      alias: "e",
      describe: "环境变量数据(JSON字符串)",
      type: "string",
    },
    input: {
      alias: "i",
      describe: "模板文件相对路径(优先级高于inputTemplate)",
      type: "string",
    },
    inputTemplate: {
      alias: "t",
      describe: "模板文件内容",
      type: "string",
    },
    mode: {
      alias: "m",
      describe: "输出模式",
      type: "string",
      choices: [
        OutputModeEnum.OVERWRITE,
        OutputModeEnum.APPEND,
        OutputModeEnum.REPLACE,
        OutputModeEnum.RETURN,
      ],
      default: OutputModeEnum.OVERWRITE,
    },
    output: {
      alias: "o",
      describe: "输出文件路径",
      type: "string",
    },
    rollback: {
      alias: "r",
      describe: "是否回滚",
      type: "boolean",
      default: false,
    },
  };
};

const commandName = "template";

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    console.log(chalk.red(msg));
  } else {
    console.log(chalk.red(err.message));
  }
  process.exit(1);
};

const commandDescription = injectInfo.description;

const childCommandUsage = `Usage: $0 ${commandName} [options]`;

const mainCommandUsage = `Usage: $0 [options]`;

const getCli = (
  cli: yargs.Argv<Options>,
  usage: typeof mainCommandUsage | typeof childCommandUsage,
) => {
  const options = getOptions();
  return cli
    .strict()
    .usage(usage)
    .help("help")
    .version(injectInfo.version)
    .alias("v", "version")
    .alias("h", "help")
    .options(options)
    .fail(failHandler).argv;
};

const builder = (cli: yargs.Argv<Options>) => {
  return getCli(cli, childCommandUsage);
};

export const command = {
  command: commandName,
  describe: commandDescription,
  builder,
  handler,
} as unknown as CommandModule<Options, Options>;

export const createCli = async () => {
  const cli = yargs(hideBin(process.argv));
  const args = await getCli(cli as any, mainCommandUsage);

  return handler(args as any);
};
