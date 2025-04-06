import type { ArgumentsCamelCase } from "yargs";
import { getEnvData } from "./env-data";
import type { Config, TemplateConfigFull } from "./types";
import { SubcommandEnum } from "./types";
import type { Options } from "@done-coding/cli-template";
import { handler, OutputModeEnum } from "@done-coding/cli-template";
import _template from "lodash.template";

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
  const envData = getEnvData({
    ...config,
    name,
  });

  const envDataStr = JSON.stringify(envData);

  for (const { entry, index } of config.list) {
    config.list.forEach((item) => {
      const { entry, index } = item;
      if (entry) {
        const entryAssert = entry as unknown as TemplateConfigFull;

        if (entryAssert?.input) {
          entryAssert.input = _template(entryAssert.input)(envData);
        }
        if (entryAssert?.output) {
          entryAssert.output = _template(entryAssert.output)(envData);
        }
      }

      if (index) {
        const indexAssert = index as unknown as TemplateConfigFull;
        if (indexAssert?.input) {
          indexAssert.input = _template(indexAssert.input)(envData);
        }
        if (indexAssert?.output) {
          indexAssert.output = _template(indexAssert.output)(envData);
        }
      }
    });
    const entryOptions: Options = {
      ...entry,
      envData: envDataStr,
      mode: OutputModeEnum.APPEND,
      rollback: command === SubcommandEnum.REMOVE,
    };
    await handler(entryOptions as ArgumentsCamelCase<Options>);
    if (index) {
      const indexOptions: Options = {
        ...index,
        envData: envDataStr,
        mode: OutputModeEnum.OVERWRITE,
        rollback: command === SubcommandEnum.REMOVE,
      };
      await handler(indexOptions as ArgumentsCamelCase<Options>);
    }
  }
};
