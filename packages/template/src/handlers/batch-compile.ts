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
import _template from "lodash.template";

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
    markerNs: topMarkerNs,
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

  // initial 默认值的渲染上下文（按配置顺序累积）：
  //   内置（extraEnvData，如 create 注入的 $projectName）+ 全局（globalEnvData）
  //   + 「前序已答变量」（collectEnvData，随循环逐条累积）。
  // 优先级：内置（$ 前缀保留键，不可被遮蔽）> 前序答案（用户意图）> 全局（作者默认）。
  // _assign 后写覆盖先写，故参数顺序为 globalEnvData → collectEnvData → extraEnvData。
  // 约束：① 只能引用「前面」出现的变量——单趟有序循环天然挡住自引用/向后引用；
  //   ② 仅渲染含 `${` 的 initial，纯字符串原样放过（向后兼容）；
  //   ③ 引用了上下文中不存在的变量 → fail fast，明确指出是哪个 key 的 initial。
  const resolveInitial = (
    questionKey: string,
    initial?: string,
  ): string | undefined => {
    if (typeof initial !== "string" || !initial.includes("${")) return initial;
    const renderCtx = _assign({}, globalEnvData, collectEnvData, extraEnvData);
    try {
      return _template(initial)(renderCtx);
    } catch (error) {
      throw new Error(
        `模板参数「${questionKey}」的 initial 默认值 ${JSON.stringify(
          initial,
        )} 引用了不存在的变量：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  // 单趟有序循环：逐条「先消费已传入答案 → 否则按交互/非交互补齐」，
  // collectEnvData 随之累积，供后续问题的 initial 引用前序答案。
  const trulyMissing: CollectEnvDataQuestion[] = [];
  for (const question of normalizedForm) {
    const { key: keyName, label, initial } = question;

    const answer = collectEnvDataInit[keyName];
    if (answer !== undefined && answer !== null) {
      collectEnvData[keyName] = answer;
      continue;
    }

    if (!ctx.interactive) {
      // 非交互：有 initial 的视为非必填，回落（渲染后的）默认值；
      // 无 initial 的为真正缺失，聚合后一次抛。
      if (initial !== undefined) {
        collectEnvData[keyName] = resolveInitial(keyName, initial);
      } else {
        trulyMissing.push(question);
      }
      continue;
    }

    // 交互：逐个 prompt，initial 用渲染后的默认值
    collectEnvData[keyName] = (
      await xPrompts({
        type: "text",
        name: keyName,
        message: `请输入${label}`,
        initial: resolveInitial(keyName, initial),
        format: (value) => value.trim(),
        validate: (value) => value.length > 0 || `${label}不能为空`,
      })
    )[keyName];
  }

  if (!ctx.interactive && trulyMissing.length > 0) {
    throw new Error(
      `缺少模板预置参数，当前为非交互模式，不能等待终端输入：${trulyMissing
        .map(({ key, label }) => `${key}(${label})`)
        .join("、")}`,
    );
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
      markerNs: rest.markerNs ?? topMarkerNs,
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
