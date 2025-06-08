import {
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  OutputModeEnum,
  type CompileTemplateConfig,
  type InitOptions,
} from "@/utils";
import {
  log,
  xPrompts,
  type CliHandlerArgv,
  initHandlerCommon,
  getUseDefaultConfig,
  getConfigFileCommonOptions,
} from "@done-coding/cli-utils";
import configDefault from "@/json/default.json";

export const getInitOptions = () =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

/** 获取初始化模板内容 */
const getContent = async (useDefaultConfig: boolean) => {
  let content: CompileTemplateConfig = {};

  if (useDefaultConfig) {
    content = configDefault as CompileTemplateConfig;
  } else {
    const { globalEnvCount, collectEnvCount, compileFileCount } =
      await xPrompts([
        {
          name: "globalEnvCount",
          type: "number",
          message: "全局固定变量数量",
          initial: 1,
          format: (value) => Number(value) || 0,
          validate: (value) => value >= 0,
        },
        {
          name: "collectEnvCount",
          type: "number",
          message: "采集变量数量",
          initial: 1,
          format: (value) => Number(value) || 0,
          validate: (value) => value >= 0,
        },
        {
          name: "compileFileCount",
          type: "number",
          message: "预编译文件数量",
          initial: 1,
          format: (value) => Number(value) || 0,
          validate: (value) => value >= 0,
        },
      ]);

    if (globalEnvCount) {
      content.globalEnvData = Array.from({
        length: globalEnvCount,
      }).reduce((acc: CompileTemplateConfig["globalEnvData"], item, index) => {
        acc![`GLOBAL_${index}`] = "";
        return acc;
      }, {});
    }

    if (collectEnvCount) {
      content.collectEnvDataForm = Array.from({
        length: collectEnvCount,
      }).map((_, index) => {
        return {
          key: `COLLECT_KEY_${index}`,
          label: `COLLECT_LABEL_${index}`,
          initial: undefined,
        };
      });
    }
    if (compileFileCount) {
      content.list = Array.from({
        length: compileFileCount,
      }).map((_, index) => {
        return {
          input: `(相对于命令运行目录)需要编译的模板文件路径${index}`,
          output: `(相对于命令运行目录)编译后输出的文件路径${index}`,
          mode: OutputModeEnum.REPLACE,
        };
      });
    }
  }
  return content;
};

/** 初始化模板 */
export const initHandler = async (argv: CliHandlerArgv<InitOptions>) => {
  const useDefaultConfig = await getUseDefaultConfig();

  const content = await getContent(useDefaultConfig);

  await initHandlerCommon(content, argv, {
    edit: true,
    onFileGenerated(filePath) {
      if (!useDefaultConfig) {
        log.success(`配置文件已生成：${filePath}
        请具体需要替换
        globalEnvData中的 GLOBAL_\${index}及其对应值
        collectEnvDataForm各项中 COLLECT_KEY_\${index} COLLECT_LABEL_\${index}
        list各项中的 input值 output值
    `);
      }
    },
  });
};
