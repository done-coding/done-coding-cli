/** 实践应用相关 */
import type { Options } from "./utils";
import { handler as injectHandler } from "./handler";

/**
 * done-coding cli信息注入
 * ---
 * 从 package.json 中注入 done-coding-cli 信息
 */
export const injectDoneCodingCliInfo = (
  moduleNameConfig = `name:cliConfig.moduleName:REG:${
    /@done-coding\/cli-([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)/.source
  }:$1`,
  injectKeyPath = [
    "version",
    "name",
    "description",
    `name:cliConfig.namespaceDir:VALUE:.done-coding`,
    moduleNameConfig,
  ],
) => {
  const injectInfoOptions: Options = {
    sourceJsonFilePath: "./package.json",
    injectKeyPath,
    injectInfoFilePath: "./src/injectInfo.json",
  };

  injectHandler(injectInfoOptions);
};
