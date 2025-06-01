import { crateAsSubcommand as createInitCommand } from "@done-coding/cli-init";
import { crateAsSubcommand as createInjectCommand } from "@done-coding/cli-inject";
import { crateAsSubcommand as createExtractCommand } from "@done-coding/cli-extract";
import { crateAsSubcommand as createGitCommand } from "@done-coding/cli-git";
import { crateAsSubcommand as createCreateCommand } from "create-done-coding";
import { crateAsSubcommand as createPublishCommand } from "@done-coding/cli-publish";
import { crateAsSubcommand as createTemplateCommand } from "@done-coding/cli-template";
import { crateAsSubcommand as createComponentCommand } from "@done-coding/cli-component";

import injectInfo from "@/injectInfo.json";
import type { CliInfo } from "@done-coding/cli-utils";
import { createMainCommand } from "@done-coding/cli-utils";

const { version, description: describe } = injectInfo;

const commandCliInfo: CliInfo = {
  usage: `$0 <command> [options]`,
  describe,
  version,
  subcommands: [
    createGitCommand(),
    createCreateCommand(),
    createInitCommand(),
    createInjectCommand(),
    createExtractCommand(),
    createPublishCommand(),
    createTemplateCommand(),
    createComponentCommand(),
  ],
  demandCommandCount: 1,
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand(commandCliInfo);
};
