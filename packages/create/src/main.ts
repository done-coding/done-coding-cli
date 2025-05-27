import type { CommandModule } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Options } from "@/utils";
import { handler } from "@/handler";
import chalk from "chalk";
import injectInfo from "@/injectInfo.json";

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

const childCommand = `$0 ${commandName} [projectName]`;

const mainCommand = `$0 [projectName]`;

const getCli = async (
  cli: yargs.Argv<Options>,
  usage: typeof mainCommand | typeof childCommand,
) => {
  return cli
    .strict()
    .usage(`Usage: ${usage}`)
    .help("help")
    .version(injectInfo.version)
    .alias("v", "version")
    .alias("h", "help")
    .command({
      command: usage,
      describe: commandDescription,
      handler: handler,
    } as unknown as CommandModule)
    .fail(failHandler).argv;
};

export const command = {
  command: commandName,
  describe: commandDescription,
  builder: (cli: yargs.Argv<Options>) => {
    return getCli(cli, childCommand);
  },
  handler,
} as unknown as CommandModule<Options, Options>;

export const createCli = async () => {
  const cli = yargs(hideBin(process.argv));
  const args = await getCli(cli as any, mainCommand);

  // return handler(args as any);
  return args;
};
