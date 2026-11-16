import { outputConsole } from "@done-coding/cli-utils";
import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { getTemplateList, resolveTemplateConfigPath } from "@/utils";
import type { CreateTemplateChoiceItem } from "@/types";

/**
 * `create templates` 子命令：列出可选项目模板（名称、描述、来源、目录、分支）。
 * ---
 * 与交互式选单同一来源（`--templateConfig` > 本机指针 > 内置远端），给 AI / 脚本
 * 非交互挑模板用，免得各处自己解析清单文件。stdout 只输出数据，诊断走 stderr。
 */

interface TemplatesArgv {
  /** 模板清单文件路径（本地） */
  templateConfig?: string;
  /** 输出 JSON */
  json?: boolean;
}

/** 一个模板的分支说明 */
const branchText = (branch: CreateTemplateChoiceItem["branch"]): string => {
  if (typeof branch === "string") return `分支 ${branch}`;
  if (Array.isArray(branch) && branch.length) {
    return `分支：${branch.map((b) => `${b.name}（${b.description}）`).join("；")}`;
  }
  return "默认分支";
};

export const templatesHandler = async (argv: CliHandlerArgv<TemplatesArgv>) => {
  try {
    const configPath = await resolveTemplateConfigPath(argv.templateConfig);
    const list = await getTemplateList(argv.templateConfig);
    const source = configPath ?? "内置远端模板列表";
    if (argv.json) {
      process.stdout.write(
        `${JSON.stringify({ source, templateList: list }, null, 2)}\n`,
      );
      return;
    }
    outputConsole.info(`模板来源：${source}（${list.length} 个）`);
    for (const item of list) {
      process.stdout.write(
        `${item.name} — ${item.description || "（无描述）"}\n    ${[
          item.url,
          item.directory && `目录 ${item.directory}`,
          branchText(item.branch),
        ]
          .filter(Boolean)
          .join("；")}\n`,
      );
    }
  } catch (error) {
    outputConsole.error((error as Error).message);
    process.exitCode = 1;
  }
};

/** templates 子命令配置 */
export const templatesCommandCliInfo: SubCliInfo = {
  command: "templates",
  describe: "列出可选项目模板（名称、描述、来源、目录、分支；与交互选单同源）",
  options: {
    templateConfig: {
      type: "string",
      describe: "模板列表配置文件路径(本地)，缺省读本机指针或内置远端",
    },
    json: { type: "boolean", describe: "输出 JSON", default: false },
  },
  handler: templatesHandler as SubCliInfo["handler"],
};
