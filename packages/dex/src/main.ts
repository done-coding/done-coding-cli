import { main as runCodingAgent } from "@earendil-works/pi-coding-agent";
import injectInfo from "@/injectInfo.json";
import type { SubCliInfo } from "@done-coding/cli-utils";
import { createSubcommand, outputConsole } from "@done-coding/cli-utils";
import { initSymlink } from "@/init/symlink";
import { importFromCcSwitch } from "@/import/cc-switch";
import generatorExtension from "@/extensions/generator";

/**
 * 剥离 cc-switch 残留的 ANTHROPIC_* 环境变量。
 * cc-switch 的 profile env（ANTHROPIC_BASE_URL/AUTH_TOKEN/MODEL 等）会污染
 * coding-agent 的模型选择——让 anthropic 被判"有凭据"并默认选中、请求残留端点。
 * dex 的认证以 auth.json（导入的 provider key）为准，剥离后 anthropic 无凭据、
 * 默认模型由 settings.json 的 defaultProvider/defaultModel 决定。
 */
const stripAnthropicEnv = (): void => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("ANTHROPIC_")) {
      delete process.env[key];
    }
  }
};

/**
 * Dex 入口编排：
 * ① 软链初始化（~/.pi → ~/.done-coding/dex，幂等）
 * ② 剥离 ANTHROPIC_* env（防 cc-switch 残留污染模型选择）
 * ③ cc-switch 配置导入（未配置时检测 + 授权 + 转 anthropic 协议）
 * ④ 转交 coding-agent main()（裸参数 = 交互 REPL；工具 = 内置 + done-coding 扩展）
 */
export const run = async (
  args: string[] = process.argv.slice(2),
): Promise<void> => {
  initSymlink();
  stripAnthropicEnv();

  try {
    await importFromCcSwitch();
  } catch (error: any) {
    // 非交互模式/用户取消/读取失败等不阻塞启动
    outputConsole.warn(`cc-switch 配置导入跳过: ${error?.message || error}`);
  }

  await runCodingAgent(args, {
    extensionFactories: [generatorExtension],
  });
};

const {
  cliConfig: { moduleName },
} = injectInfo;

/** 作为子命令创建（主 CLI `DC dex`，无子命令面——直接进入对话） */
export const createAsSubcommand = () => {
  return createSubcommand({
    command: moduleName,
    describe: "Dex 智能体（直接对话）",
    handler: async () => {
      await run([]);
    },
  } as unknown as SubCliInfo);
};
