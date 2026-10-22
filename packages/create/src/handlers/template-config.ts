import { outputConsole, safeCwd } from "@done-coding/cli-utils";
import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import {
  readTemplateConfigPointer,
  setTemplateConfigPointer,
  unsetTemplateConfigPointer,
} from "@/utils";

/**
 * `create template-config [path]` 子命令：本机模板清单指针的查看 / 设置 / 清除。
 * ---
 * 指针文件 `~/.done-coding/create/index.json` 是 create 的内部约定，外部（如模板仓根脚本）
 * [MUST] 经本命令登记，[MUST NOT] 直接写该文件。
 *   - 无参：显示当前指向及其有效性；
 *   - 带路径：按 cwd 解析为绝对路径，校验通过后写入；
 *   - `--unset`：清除指向。
 */

interface TemplateConfigArgv {
  /** 模板清单文件路径（相对 cwd 或绝对） */
  path?: string;
  /** 清除指针 */
  unset?: boolean;
}

const showPointer = async () => {
  const info = await readTemplateConfigPointer();
  if (!info.configPath) {
    outputConsole.info(`未配置模板清单（指针文件: ${info.pointerPath}）`);
  } else if (info.valid) {
    outputConsole.info(
      `模板清单: ${info.configPath}（${info.templateCount} 个模板）`,
    );
  } else {
    outputConsole.warn(`模板清单已失效: ${info.configPath}（${info.reason}）`);
    process.exitCode = 1;
  }
  return info;
};

/** template-config 命令分发 */
export const templateConfigHandler = async (
  argv: CliHandlerArgv<TemplateConfigArgv>,
) => {
  try {
    if (argv.unset) {
      const { removed, pointerPath } = await unsetTemplateConfigPointer();
      outputConsole.info(
        removed
          ? `已清除模板清单指向（${pointerPath}）`
          : "未配置模板清单，无需清除",
      );
      return;
    }
    if (!argv.path) {
      await showPointer();
      return;
    }
    const { configPath, templateCount } = await setTemplateConfigPointer(
      argv.path,
      { cwd: safeCwd() },
    );
    outputConsole.success(
      `已登记模板清单: ${configPath}（${templateCount} 个模板）`,
    );
  } catch (error) {
    outputConsole.error((error as Error).message);
    process.exitCode = 1;
  }
};

/** template-config 子命令配置 */
export const templateConfigCommandCliInfo: SubCliInfo = {
  command: "template-config [path]",
  describe: "本机模板清单指针：无参查看 / 带路径登记 / --unset 清除",
  options: {
    unset: {
      type: "boolean",
      describe: "清除模板清单指向",
      default: false,
    },
  },
  handler: templateConfigHandler as SubCliInfo["handler"],
};
