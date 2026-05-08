import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, Protocol, type ClientAddOptions } from "@/types";
import { addClient } from "@/services/registry";

export const handler = async (argv: CliHandlerArgv<ClientAddOptions>) => {
  const { name, protocol, configPath } = argv;

  if (protocol !== Protocol.ANTHROPIC && protocol !== Protocol.OPENAI) {
    outputConsole.error(
      `不支持的协议: ${protocol}，合法值: anthropic | openai`,
    );
    process.exit(1);
  }

  try {
    addClient({ name, protocol, configPath, builtin: false });
    outputConsole.info(`client "${name}" 添加成功`);
    outputConsole.info(`  配置文件: ${configPath}`);
    outputConsole.info(`  绑定协议: ${protocol}`);
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.CLIENT_ADD} <name> <protocol> <configPath>`,
  describe: "添加自定义 client",
  handler: handler as SubCliInfo["handler"],
};
