import type { CompileOptions } from "@/types";
import { log } from "@done-coding/cli-utils";
import fs from "node:fs";
import path from "node:path";

/** 获取数据 */
export const getData = <
  J extends boolean,
  R extends J extends true ? Record<string, any> : string = J extends true
    ? Record<string, any>
    : string,
>({
  rootDir,
  filePath,
  dataInit,
  limitJson,
  filePathKey,
  dataInitKey,
  dealMarkdown = false,
}: {
  /** 运行目录/根目录 */
  rootDir: string;
  /** 文件相对路径 */
  filePath?: string;
  /** 初始数据 */
  dataInit?: string;
  /**
   * 是否限制必须json
   * ----
   * 拓展名为json 同时以JSON parse解析
   */
  limitJson: J;
  /** 文件路径key */
  filePathKey: keyof CompileOptions;
  /** 初始数据key */
  dataInitKey: keyof CompileOptions;
  /** (检测是markdown)是否处理(单个)代码块包裹 */
  dealMarkdown?: boolean;
}): R => {
  if (filePath) {
    if (limitJson) {
      if (!filePath.endsWith(".json")) {
        log.error(`${filePathKey}必须是json文件，请检查文件后缀名`);
        return process.exit(1);
      }
    }

    const fileContentInit = fs.readFileSync(
      path.resolve(rootDir, filePath),
      "utf-8",
    );

    let fileContent = fileContentInit;
    if (dealMarkdown && filePath.endsWith(".md")) {
      fileContent = fileContentInit.replace(
        /^\s*```[a-zA-Z0-9]+\s*[\r\n]+([\s\S]+?)```\s*$/,
        "$1",
      );
    }

    if (limitJson) {
      return JSON.parse(fileContent) as R;
    } else {
      return fileContent as R;
    }
  } else {
    if (!dataInit) {
      log.error(`${filePathKey}与${dataInitKey}不能同时为空`);
      return process.exit(1);
    }
    log.info(`${filePathKey} 为空，将使用${dataInitKey}作为数据`);

    if (limitJson) {
      return JSON.parse(dataInit) as R;
    } else {
      return dataInit as R;
    }
  }
};
