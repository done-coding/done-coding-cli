import path from "node:path";
import fs from "node:fs";
import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { getLogText, log } from "@done-coding/cli-utils";
import type { ListOptions } from "@/types";
import { SubcommandEnum, type Config } from "@/types";
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
          log.info("filePath:", filePath, path.basename(filePath));
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
    log.error("组件源码路径不是目录");
    return process.exit(1);
  }
};

export const handler = async ({
  outputJson,
  outputPath: outputPathInit,
}: CliHandlerArgv<ListOptions>) => {
  log.stage("展示列表");
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

  console.table(
    listInfo.map(({ name, fullName, nameKebab }) => {
      return {
        [getLogText.success("名称")]: name,
        [getLogText.success("带系列名称")]: fullName,
        [getLogText.success("绝对路径")]: path.resolve(
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
    log.stage(`输出组件名列表到${outputAbsolutePath}`);
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
