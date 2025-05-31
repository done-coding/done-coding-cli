import type { CommandModule, Options as YargsOptions } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Options } from "@/utils";
import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import { log } from "@done-coding/cli-utils";

const getOptions = (): {
  [key in keyof Options]: YargsOptions;
} => {
  return {
    xx: {
      alias: "x",
      describe: "模版测试",
      type: "string",
      demandOption: true,
    },
  };
};

const commandName = injectInfo.cliConfig.moduleName;

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    log.error(msg);
  } else {
    log.error(err.message);
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
