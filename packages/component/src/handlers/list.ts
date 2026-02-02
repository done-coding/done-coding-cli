import path from "node:path";
import fs from "node:fs";
import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { chalk, outputConsole } from "@done-coding/cli-utils";
import type { ListOptions, Config } from "@/types";
import { SubcommandEnum } from "@/types";
import { getComponentEnvData, getConfig } from "@/utils";

/** 获取列表选项 */
const getOptions = (): YargsOptionsRecord<ListOptions> => {
  return {
    outputJson: {
      alias: "o",
      describe: "是否输出组件名列表json",
      type: "boolean",
      default: false,
    },
    outputPath: {
      alias: "p",
      describe: "输入路径",
      type: "string",
    },
  };
};

/**
 * 获取组件列表
 */
export const getComponentList = (config: Config): string[] => {
  const { componentDir: componentDirAbsolutePath, nameExcludes } = config;
  const stats = fs.statSync(componentDirAbsolutePath);

  if (stats.isDirectory()) {
    const files = fs.readdirSync(componentDirAbsolutePath);

    const list = files
      .map((file) => {
        const filePath = path.join(componentDirAbsolutePath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          outputConsole.info("filePath:", filePath, path.basename(filePath));
          return path.basename(filePath);
        } else {
          return "";
        }
      })
      .filter((nameKebab) => {
        if (!nameKebab) {
          return false;
        }

        // 过滤排除的文件名
        if (nameExcludes.includes(nameKebab)) {
          return false;
        }
        return true;
      });

    return list;
  } else {
    outputConsole.error("组件源码路径不是目录");
    return process.exit(1);
  }
};

export const handler = async ({
  outputJson,
  outputPath: outputPathInit,
}: CliHandlerArgv<ListOptions>) => {
  outputConsole.stage("展示列表");
  const config = getConfig();
  const list = getComponentList(config);

  const outputPath = outputPathInit || config.nameListJsonOutputPath;

  const listInfo = list.map((nameKebab) => {
    const { name, fullName } = getComponentEnvData({
      ...config,
      name: nameKebab,
    });

    return {
      name,
      nameKebab,
      fullName,
    };
  });

  outputConsole.table(
    listInfo.map(({ name, fullName, nameKebab }) => {
      return {
        [chalk.greenBright("名称")]: name,
        [chalk.greenBright("带系列名称")]: fullName,
        [chalk.greenBright("绝对路径")]: path.resolve(
          config.componentDir,
          nameKebab,
        ),
      };
    }),
  );

  if (outputJson && outputPath) {
    const outputAbsolutePath = path.resolve(outputPath);
    const outputDir = path.dirname(outputAbsolutePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    outputConsole.stage(`输出组件名列表到${outputAbsolutePath}`);
    fs.writeFileSync(outputAbsolutePath, JSON.stringify(listInfo, null, 2));
  }
};

/** 展示组件列表cli信息 */
export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.LIST,
  describe: "展示组件列表",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
