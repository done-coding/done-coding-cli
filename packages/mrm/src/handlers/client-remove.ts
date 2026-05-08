import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ClientRemoveOptions } from "@/types";
import { removeClient } from "@/services/registry";
import { promptConfirm } from "@/utils/prompts";

export const handler = async (argv: CliHandlerArgv<ClientRemoveOptions>) => {
  const { name } = argv;

  const confirmed = await promptConfirm(`确认删除 client "${name}"？`);
  if (!confirmed) {
    outputConsole.info("已取消");
    return;
  }

  try {
    removeClient(name);
    outputConsole.info(`client "${name}" 已删除`);
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.CLIENT_REMOVE} <name>`,
  describe: "删除自定义 client",
  handler: handler as SubCliInfo["handler"],
};
