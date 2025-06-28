import { getEnvData } from "./env-data";
import type { Config, TemplateConfigFull } from "@/types";
import { SubcommandEnum } from "@/types";
import type { CompileOptions } from "@done-coding/cli-template";
import { compileHandler, OutputModeEnum } from "@done-coding/cli-template";
import _template from "lodash.template";
import { log } from "@done-coding/cli-utils";

/** 操作组件 */
export const operateComponent = async ({
  name,
  config,
  command,
}: {
  name: string;
  config: Config;
  command: SubcommandEnum;
}) => {
  if (![SubcommandEnum.ADD, SubcommandEnum.REMOVE].includes(command)) {
    log.error(`不支持组件${command}操作`);
    return process.exit(1);
  }
  const envData = getEnvData({
    ...config,
    name,
  });

  const rootDir = process.cwd();

  const envDataStr = JSON.stringify(envData);

  for (const { entry, index } of config.list) {
    const publicOptions = {
      envData: envDataStr,
      rollback: command === SubcommandEnum.REMOVE,
      /** 回滚时可以删除空文件 */
      rollbackDelNullFile: true,
      rollbackDelAskAsYes: true,
      dealMarkdown: true,
      batch: false,
      rootDir,
    };
    if (entry) {
      const entryAssert = entry as unknown as TemplateConfigFull;

      if (entryAssert?.input) {
        entryAssert.input = _template(entryAssert.input)(envData);
      }
      if (entryAssert?.output) {
        entryAssert.output = _template(entryAssert.output)(envData);
      }
      const entryOptions: CompileOptions = {
        ...entry,
        mode: OutputModeEnum.APPEND,
        ...publicOptions,
      };
      await compileHandler(entryOptions);
    }

    if (index) {
      const indexAssert = index as unknown as TemplateConfigFull;
      if (indexAssert?.input) {
        indexAssert.input = _template(indexAssert.input)(envData);
      }
      if (indexAssert?.output) {
        indexAssert.output = _template(indexAssert.output)(envData);
      }
      const indexOptions: CompileOptions = {
        ...index,
        mode: OutputModeEnum.OVERWRITE,
        ...publicOptions,
      };
      await compileHandler(indexOptions);
    }
  }
};
