import type { CommandModule } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { fileURLToPath } from "node:url";
import { command as createCommand } from "create-done-coding/assets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const failHandler = (msg: string, err: Error) => {
  if (msg) {
    console.log(chalk.red(msg));
  } else {
    console.log(chalk.red(err.message));
  }
  process.exit(1);
};

export const createCli = () => {
  const pkgStr = fs.readFileSync(
    path.join(__dirname, "../package.json"),
    "utf-8",
  );

  const { version } = JSON.parse(pkgStr) as { version: string };

  const argv = hideBin(process.argv);
  const cli = yargs(argv);

  return cli
    .strict()
    .usage("Usage: $0 <command> [options]")
    .demandCommand(1)
    .help("help")
    .version(version)
    .alias("h", "help")
    .alias("v", "version")
    .command(createCommand as CommandModule)
    .fail(failHandler).argv;
};
