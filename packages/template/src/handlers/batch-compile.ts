import {
  SubcommandEnum,
  type CollectFormItem,
  type CompileBatchHandlerOptions,
  type CompileBatchOptions,
  type CompileTemplateConfig,
} from "@/types";
import { compileTemplate, MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";
import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
  HandlerContextInit,
} from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  outputConsole,
  readConfigFile,
  xPrompts,
  resolveHandlerContext,
} from "@done-coding/cli-utils";
import _assign from "lodash.assign";

/** 模板预置环境变量采集问题 */
export interface CollectEnvDataQuestion {
  key: string;
  label: string;
  initial?: string;
}

/** 将模板配置中的 collectEnvDataForm 归一化为 MCP/CLI 可复用的问题列表 */
export const normalizeCollectEnvDataForm = (
  collectEnvDataForm: (CollectFormItem | string)[] = [],
): CollectEnvDataQuestion[] => {
  return collectEnvDataForm.map((formItem) => {
    if (typeof formItem === "string") {
      return {
        key: formItem,
        label: formItem,
      };
    }
    return {
      key: formItem.key,
      label: formItem.label,
      initial: formItem.initial,
    };
  });
};

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
    collectEnvData: collectEnvDataInit = {},
    ...args
  }: CliHandlerArgv<CompileBatchHandlerOptions>,

  paramsConfig?: CompileTemplateConfig,
  ctxInit?: HandlerContextInit,
) => {
  const ctx = resolveHandlerContext(ctxInit);
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
    outputConsole.error(`读取配置文件失败`);
    return process.exit(1);
  }

  const {
    list: listInit = [],
    globalEnvData = {},
    collectEnvDataForm = [],
  } = config;

  const collectEnvData: Record<string, any> = {};
  const normalizedForm = normalizeCollectEnvDataForm(collectEnvDataForm);

  // 先消费已传入的答案，未传入的归集为"缺失项"
  const missingQuestions: CollectEnvDataQuestion[] = [];
  for (const question of normalizedForm) {
    const answer = collectEnvDataInit[question.key];
    if (answer !== undefined && answer !== null) {
      collectEnvData[question.key] = answer;
      continue;
    }
    missingQuestions.push(question);
  }

  if (!ctx.interactive) {
    // 非交互：有 initial 的视为非必填，回落默认值；无 initial 的为真正缺失，聚合后一次抛
    const trulyMissing: CollectEnvDataQuestion[] = [];
    for (const question of missingQuestions) {
      if (question.initial !== undefined) {
        collectEnvData[question.key] = question.initial;
      } else {
        trulyMissing.push(question);
      }
    }
    if (trulyMissing.length > 0) {
      throw new Error(
        `缺少模板预置参数，当前为非交互模式，不能等待终端输入：${trulyMissing
          .map(({ key, label }) => `${key}(${label})`)
          .join("、")}`,
      );
    }
  } else {
    for (const { key: keyName, label, initial } of missingQuestions) {
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
  }

  const list = listInit.map((item) => {
    const { envData: itemEnvData, env, input, output, ...rest } = item;

    if (env) {
      outputConsole.warn(`批量处理中 env:${env} 将被忽略, 只读envData`);
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
    const result = await compileTemplate(
      item,
      {
        rootDir,
        rollback,
      },
      ctx,
    );
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
