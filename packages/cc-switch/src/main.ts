import { runRouter } from "@/handlers";
import injectInfo from "@/injectInfo.json";
import type { CommandModule } from "@done-coding/cli-utils";

const {
  cliConfig: { moduleName },
} = injectInfo;

/**
 * 命令工厂入口（保留模板 createCommand 工厂导出形态与文件位置）。
 * 内部装配为 dc-cc-switch 透传主流程 runRouter。
 * 顶层异常 → stderr 一行 + 非 0 退出。
 *
 * REQ-6 脱敏说明：dc-cc-switch 内部抛出的错误均为受控文案（配置路径 / 可用
 * profile 名 / settings 路径），[MUST NOT] dump 含 token 的 env 对象——
 * 故顶层无需对 message 二次遮蔽（token 类值不会进入 error message）。
 */
export const createCommand = async (): Promise<void> => {
  try {
    await runRouter();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }
};

/**
 * 作为子命令注册进 done-coding 主 CLI（`DC cc-switch`）。
 * 门面路由：builder 宽松（strict(false) + 声明 meta 家族选项，不拦截
 * claude 透传参数）；handler 内从 process.argv 在子命令名边界后取**原始切片**
 * 喂给 runRouter —— 不消费 yargs 解析产物，守 REQ-1 逐字保真语义
 * （独立入口 dc-cc-switch / cc-router 行为与未注册前完全一致）。
 * meta 自身命令面（REQ-1）：--meta-profile=<name> / --meta-pick / --meta-silent /
 * --meta-help / --meta-version 由 runRouter 消费，[MUST NOT] 透传给 claude。
 */
export const createAsSubcommand = (): CommandModule => {
  return {
    command: moduleName,
    describe: "claude-code 模型路由透传（dc-cc-switch / cc-router）",
    builder(argv) {
      return argv
        .strict(false)
        .option("meta-profile", {
          type: "string",
          describe:
            "选择 profile（~/.done-coding/cc-switch/profile.json 中的 profile 名）",
        })
        .option("meta-pick", {
          type: "boolean",
          describe: "终端交互选择 profile 启动",
        })
        .option("meta-silent", {
          type: "boolean",
          describe: "压制 output.* 输出（MCP/AI 调用避免污染上下文）",
        })
        .option("meta-generate", {
          type: "boolean",
          describe: "从 provider.json + model.json 重建 profile.json",
        })
        .option("meta-apiKey", {
          type: "string",
          describe: "更新指定提供商 apiKey（自动重建）",
        })
        .option("meta-model-name", {
          type: "string",
          describe: "添加模型到指定提供商（自动重建）",
        })
        .option("meta-provider", {
          type: "string",
          describe: "显式指定 provider id（供 apiKey/model-name 跳过选择）",
        })
        .option("meta-provider-list", {
          type: "boolean",
          describe: "输出提供商列表（id + name）",
        })
        .option("meta-model-list", {
          type: "boolean",
          describe: "输出模型列表（name + 所属 provider）",
        })
        .option("meta-help", {
          type: "boolean",
          describe: "显示 cc-switch 自身帮助",
        })
        .option("meta-version", {
          type: "boolean",
          describe: "显示 cc-switch 自身版本",
        });
    },
    handler() {
      const boundary = process.argv.findIndex((arg) => arg === moduleName);
      const rest =
        boundary >= 0
          ? process.argv.slice(boundary + 1)
          : process.argv.slice(2);
      return runRouter(rest);
    },
  };
};
