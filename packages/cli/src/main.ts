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
import {
  createMainCommand,
  getRootScriptName,
  outputConsole,
  xPrompts,
  chalk,
} from "@done-coding/cli-utils";

const { version, description: describe } = injectInfo;

const createChat = async ({
  currentCount = 1,
  maxCount,
}: {
  currentCount?: number;
  maxCount: number;
}) => {
  const v = (
    await xPrompts(
      {
        type: "text",
        name: "value",
        message: "",
        validate: (value) => value?.trim().length > 0 || " ",
      },
      {
        onCancel() {
          return process.exit(0);
        },
      },
    )
  ).value;

  outputConsole.stage(`[${currentCount}]大脑接入中`, chalk.gray(`你问了:${v}`));
  outputConsole.skip(`---------------`);

  if (currentCount >= maxCount) {
    outputConsole.stage(`${maxCount}轮对话结束`);
    return;
  }

  createChat({
    currentCount: currentCount + 1,
    maxCount,
  });
};

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
  demandCommandCount: 0,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
  async handler() {
    // execSyncHijack(`node ${process.argv[1]} -h`, {
    //   stdio: 'inherit'
    // })

    createChat({
      maxCount: 3,
    });
  },
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand(commandCliInfo);
};
