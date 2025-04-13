import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { PublishModeEnum, type Options } from "@/utils";
import { handler } from "@/handler";
import chalk from "chalk";
import injectInfo from "@/injectInfo.json";

const getOptions = (): {
  [key in keyof Options]: YargsOptions;
} => {
  return {
    mode: {
      alias: "m",
      describe: "发布模式",
      choices: [PublishModeEnum.NPM, PublishModeEnum.WEB],
      default: PublishModeEnum.NPM,
    },
    type: {
      alias: "t",
      describe: "发布类型",
      choices: ["major", "minor", "patch"],
      default: "patch",
    },
    push: {
      alias: "p",
      describe: "是否推送至远程仓库",
      type: "boolean",
      default: true,
    },
  };
};

const commandName = injectInfo.cliConfig.moduleName;

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
