import {
  SubcommandEnum,
  type CompileBatchOptions,
  type CompileTemplateConfig,
} from "@/types";
import { compileTemplate, MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";
import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  log,
  readConfigFile,
  xPrompts,
} from "@done-coding/cli-utils";
import _assign from "lodash.assign";

/** 获取编译选项 */
export const getOptions = (): YargsOptionsRecord<CompileBatchOptions> => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
    rollbackDelAskAsYes: {
      describe: "回滚删除询问默认yes(即不再额外询问，直接认为同意)",
      type: "boolean",
      default: false,
    },
    rollbackDelNullFile: {
      describe: "回滚时是否删除空文件",
      type: "boolean",
      default: false,
    },
    dealMarkdown: {
      alias: "d",
      describe: "(检测是markdown)是否处理(单个)代码块包裹",
      type: "boolean",
      default: false,
    },
    rollback: {
      alias: "r",
      describe: "是否回滚",
      type: "boolean",
      default: false,
    },
  };
};

/** 批量编译模板 */
export const handler = async (
  {
    extraEnvData = {},
    ...args
  }: CliHandlerArgv<
    CompileBatchOptions & {
      /** 额外的环境变量 */
      extraEnvData?: object;
    }
  >,

  paramsConfig?: CompileTemplateConfig,
) => {
  const defaultOptions = getOptions();
  const {
    rootDir = defaultOptions.rootDir.default,
    configPath = defaultOptions.configPath?.default,
    rollback,
  } = args;

  let config: CompileTemplateConfig | undefined;

  /** 获得配置 */

  if (paramsConfig) {
    config = paramsConfig;
  } else {
    config = await readConfigFile({
      rootDir,
      configPath,
    });
  }

  if (!config) {
    log.error(`读取配置文件失败`);
    return process.exit(1);
  }

  const {
    list: listInit = [],
    globalEnvData = {},
    collectEnvDataForm = [],
  } = config;

  const collectEnvData: Record<string, any> = {};

  for (const formItem of collectEnvDataForm) {
    /** 键名 */
    let keyName: string;
    /** 标签 */
    let label: string;
    /** 初始值 */
    let initial: string | undefined;
    if (typeof formItem === "string") {
      keyName = formItem;
      label = formItem;
      initial = undefined;
    } else {
      keyName = formItem.key;
      label = formItem.label;
      initial = formItem.initial;
    }
    collectEnvData[keyName] = (
      await xPrompts({
        type: "text",
        name: keyName,
        message: `请输入${label}`,
        initial,
        format: (value) => value.trim(),
        validate: (value) => value.length > 0 || `${label}不能为空`,
      })
    )[keyName];
  }

  const list = listInit.map((item) => {
    const { envData: itemEnvData, env, input, output, ...rest } = item;

    if (env) {
      log.warn(`批量处理中 env:${env} 将被忽略, 只读envData`);
    }

    return {
      ...rest,
      env,
      input,
      output,
      envData: _assign(
        {},
        extraEnvData,
        globalEnvData,
        collectEnvData,
        itemEnvData,
      ),
      rollback,
    };
  });

  const listResult = [];
  for (const item of list) {
    const result = await compileTemplate(item, {
      rootDir,
      rollback,
    });
    listResult.push(result);
  }
  return listResult;
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.BATCH,
  describe: "批量编译模板",
  options: getOptions(),
  handler: handler as unknown as SubCliInfo["handler"],
};
