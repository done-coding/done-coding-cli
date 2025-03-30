import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Options } from "@/utils";
import { handler } from "@/handler";
import chalk from "chalk";
import {
  getVersion,
  projectNameForm,
  saveGitHistoryForm,
  templateChoices,
  templateForm,
} from "@/utils";

const getOptions = (): {
  [key in keyof Options]: YargsOptions;
} => {
  return {
    projectName: {
      type: "string",
      alias: "p",
      describe: projectNameForm.message as string,
    },
    template: {
      type: "string",
      alias: "t",
      choices: templateChoices.map((item) => item.name),
      describe: templateForm.message as string,
    },
    saveGitHistory: {
      type: "boolean",
      alias: "s",
      describe: saveGitHistoryForm.message,
    },
  };
};

const commandName = "create";

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    console.log(chalk.red(msg));
  } else {
    console.log(chalk.red(err.message));
  }
  process.exit(1);
};

const commandDescription = "项目创建命令行工具";

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
    .version(getVersion())
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
