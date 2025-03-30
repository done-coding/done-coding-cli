import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Options } from "@/utils";
import { handler } from "@/handler";
import chalk from "chalk";
import injectInfo from "@/injectInfo.json";

const getOptions = (): {
  [key in keyof Options]: YargsOptions;
} => {
  return {
    sourceJsonFilePath: {
      type: "string",
      alias: "s",
      describe: "信息源json文件相对路径",
      default: "./package.json",
    },
    injectKeyPath: {
      type: "array",
      alias: "k",
      describe: "需要注入的key路径",
      default: ["name", "version", "description"],
    },
    injectInfoFilePath: {
      type: "string",
      alias: "i",
      describe: "注入信息文件路径",
      default: "./src/injectInfo.json",
    },
  };
};

const commandName = "inject";

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
