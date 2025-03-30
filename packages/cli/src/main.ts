import type { CommandModule } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { command as injectCommand } from "@done-coding/cli-inject";
import { command as createCommand } from "create-done-coding/assets";
import injectInfo from "@/injectInfo.json";

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    console.log(chalk.red(msg));
  } else {
    console.log(chalk.red(err.message));
  }
  process.exit(1);
};

export const createCli = () => {
  const argv = hideBin(process.argv);
  const cli = yargs(argv);

  return cli
    .strict()
    .usage("Usage: $0 <command> [options]")
    .demandCommand(1)
    .help("help")
    .version(injectInfo.version)
    .alias("h", "help")
    .alias("v", "version")
    .command(createCommand as CommandModule)
    .command(injectCommand as CommandModule)
    .fail(failHandler).argv;
};
