import { createAsSubcommand as createInjectCommand } from "@done-coding/cli-inject";
import { createAsSubcommand as createExtractCommand } from "@done-coding/cli-extract";
import { createAsSubcommand as createGitCommand } from "@done-coding/cli-git";
import { createAsSubcommand as createCreateCommand } from "create-done-coding";
import { createAsSubcommand as createPublishCommand } from "@done-coding/cli-publish";
import { createAsSubcommand as createTemplateCommand } from "@done-coding/cli-template";
import { createAsSubcommand as createComponentCommand } from "@done-coding/cli-component";
import { createAsSubcommand as createGeneratorCommand } from "@done-coding/cli-generator";
import { createAsSubcommand as createConfigCommand } from "@done-coding/cli-config";
import {
  createAsSubcommand as createAiCommand,
  handler as aiHandler,
  SubcommandEnum as AiSubcommandEnum,
} from "@done-coding/cli-ai";
import { createAsSubcommand as createMrmCommand } from "@done-coding/cli-mrm";
import { createAsSubcommand as createCcSwitchCommand } from "@done-coding/cli-cc-switch";
import { createAsSubcommand as createDexCommand } from "@done-coding/cli-dex";
import injectInfo from "@/injectInfo.json";
import type { CliInfo } from "@done-coding/cli-utils";
import {
  createMainCommand,
  getRootScriptName,
  execSyncHijack,
  xPrompts,
} from "@done-coding/cli-utils";

/**
 * 抑制 node DeprecationWarning 类告警（--no-deprecation 的运行时等价开关）。
 * 背景：主命令 import 链深层的懒加载依赖（tr46/whatwg-url 等老链）在
 * 交互渲染期首次 require punycode，DEP0040 警告插入 stderr 会打断 prompts
 * 的 stdout 渲染帧（终端帧错乱）。DeprecationWarning 面向库开发者，
 * CLI 用户可见即为噪音；实验性等其它 warning 类型不受影响。
 */
process.noDeprecation = true;

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
    createGeneratorCommand(),
    createConfigCommand(),
    createAiCommand(),
    createMrmCommand(),
    createCcSwitchCommand(),
    createDexCommand(),
  ],
  demandCommandCount: 0,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
  async handler() {
    const { shouldChat } = await xPrompts({
      type: "confirm",
      name: "shouldChat",
      message: "是否唤起 AI 对话？",
      initial: true,
    });

    if (shouldChat) {
      await aiHandler(AiSubcommandEnum.CHAT);
    } else {
      execSyncHijack(`node ${process.argv[1]} --help`, {
        stdio: "inherit",
      });
    }
  },
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand(commandCliInfo);
};
