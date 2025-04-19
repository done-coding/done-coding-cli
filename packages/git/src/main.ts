import type { CommandModule } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { GitPlatformEnum, SubcommandEnum, type Options } from "@/utils";
import { handler, subHandler } from "@/handler";
import chalk from "chalk";
import injectInfo from "@/injectInfo.json";
import _curry from "lodash.curry";

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

const childCommandUsage = `Usage: $0 ${commandName} <command> [options]`;

const mainCommandUsage = `Usage: $0 <command> [options]`;

export const gitCloneCommand: CommandModule = {
  command: `${SubcommandEnum.CLONE} <platform> <username>`,
  describe: "从选择的git平台克隆代码",
  builder: (subCli) => {
    return subCli
      .positional("platform", {
        describe: "选择git平台",
        type: "string",
        choices: [GitPlatformEnum.GITHUB, GitPlatformEnum.GITEE],
      })
      .positional("username", {
        describe: "git平台用户名",
        type: "string",
      });
  },
  /** @ts-ignore */
  handler: _curry(subHandler)(SubcommandEnum.CLONE),
};

const addSubcommand = (cli: yargs.Argv<Options>) => {
  return (
    cli
      /** @ts-ignore */
      .command(gitCloneCommand)
      .demandCommand(1)
  );
};

const getCli = (cli: yargs.Argv<Options>, asSubcommand = false) => {
  if (asSubcommand) {
    return addSubcommand(cli.strict().usage(childCommandUsage));
  } else {
    return addSubcommand(
      cli
        .strict()
        .usage(mainCommandUsage)
        .help("help")
        .version(injectInfo.version)
        .alias("v", "version")
        .alias("h", "help"),
    ).fail(failHandler).argv;
  }
};

const builder = (cli: yargs.Argv<Options>) => {
  return getCli(cli, true);
};

export const command = {
  command: commandName,
  describe: commandDescription,
  builder,
  handler,
} as unknown as CommandModule<Options, Options>;

export const createCli = async () => {
  const cli = yargs(hideBin(process.argv));
  const args = await getCli(cli as any);

  return handler(args as any);
};
