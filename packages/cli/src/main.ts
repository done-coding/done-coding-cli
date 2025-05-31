import type { CommandModule } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { command as initCommand } from "@done-coding/cli-init";
import { command as injectCommand } from "@done-coding/cli-inject";
import { command as extractCommand } from "@done-coding/cli-extract";
import { command as gitCommand } from "@done-coding/cli-git";
import { command as createCommand } from "create-done-coding";
import { command as publishCommand } from "@done-coding/cli-publish";
import { command as templateCommand } from "@done-coding/cli-template";
import { command as componentCommand } from "@done-coding/cli-component";
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
    .command(gitCommand as CommandModule)
    .command(createCommand as CommandModule)
    .command(initCommand as CommandModule)
    .command(injectCommand as CommandModule)
    .command(extractCommand as CommandModule)
    .command(publishCommand as CommandModule)
    .command(templateCommand as CommandModule)
    .command(componentCommand as CommandModule)
    .fail(failHandler).argv;
};
