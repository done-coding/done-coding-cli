import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Options } from "@/utils";
import { handler } from "@/handler";
import chalk from "chalk";
import {
  projectNameForm,
  saveGitHistoryForm,
  shallowCloneForm,
  getTemplateChoices,
  getTemplateForm,
} from "@/utils";
import injectInfo from "@/injectInfo.json";

const getOptions = async (): Promise<{
  [key in keyof Options]: YargsOptions;
}> => {
  return {
    projectName: {
      type: "string",
      alias: "p",
      describe: projectNameForm.message as string,
    },
    template: {
      type: "string",
      alias: "t",
      choices: (await getTemplateChoices()).map((item) => item.name),
      describe: (await getTemplateForm()).message as string,
    },
    saveGitHistory: {
      type: "boolean",
      alias: "s",
      describe: saveGitHistoryForm.message,
    },
    shallowClone: {
      type: "boolean",
      alias: "c",
      describe: shallowCloneForm.message,
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

const getCli = async (
  cli: yargs.Argv<Options>,
  usage: typeof mainCommandUsage | typeof childCommandUsage,
) => {
  const options = await getOptions();
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
