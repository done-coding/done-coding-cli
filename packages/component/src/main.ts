import type { CommandModule } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { SubcommandEnum, type Options } from "@/utils";
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

const addSubcommand = (cli: yargs.Argv<Options>) => {
  return (
    cli
      /** @ts-ignore */
      .command({
        command: `${SubcommandEnum.ADD} <name>`,
        describe: "新增一个组件",
        builder: (subCli) => {
          return subCli.positional("name", {
            describe: "组件名称",
            type: "string",
          });
        },
        async handler(options) {
          await _curry(subHandler)(SubcommandEnum.ADD)(options);
          return process.exit(0);
        },
      })
      /** @ts-ignore */
      .command({
        command: `${SubcommandEnum.REMOVE} [name]`,
        describe: "删除一个组件",
        builder: (subCli) => {
          return subCli.positional("name", {
            describe: "组件名称",
            type: "string",
          });
        },
        async handler(options) {
          await _curry(subHandler)(SubcommandEnum.REMOVE)(options);
          return process.exit(0);
        },
      })
      /** @ts-ignore */
      .command({
        command: SubcommandEnum.LIST,
        describe: "展示组件列表",
        async handler(options) {
          await _curry(subHandler)(SubcommandEnum.LIST)(options);
          return process.exit(0);
        },
      })
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
