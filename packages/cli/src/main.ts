import { createAsSubcommand as createInjectCommand } from "@done-coding/cli-inject";
import { createAsSubcommand as createExtractCommand } from "@done-coding/cli-extract";
import { createAsSubcommand as createGitCommand } from "@done-coding/cli-git";
import { createAsSubcommand as createCreateCommand } from "create-done-coding";
import { createAsSubcommand as createPublishCommand } from "@done-coding/cli-publish";
import { createAsSubcommand as createTemplateCommand } from "@done-coding/cli-template";
import { createAsSubcommand as createComponentCommand } from "@done-coding/cli-component";
import { createAsSubcommand as createConfigCommand } from "@done-coding/cli-config";
import injectInfo from "@/injectInfo.json";
import type { CliInfo } from "@done-coding/cli-utils";
import { createMainCommand, getRootScriptName } from "@done-coding/cli-utils";

const { version, description: describe } = injectInfo;

const commandCliInfo: CliInfo = {
  usage: `$0 <command> [options]`,
  describe,
  version,
  subcommands: [
    createGitCommand(),
    createCreateCommand(),
    createInjectCommand(),
    createExtractCommand(),
    createPublishCommand(),
    createTemplateCommand(),
    createComponentCommand(),
    createConfigCommand(),
  ],
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand(commandCliInfo);
};
