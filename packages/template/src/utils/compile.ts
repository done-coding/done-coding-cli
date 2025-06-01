import type {
  CompileTemplateConfigListItem,
  CompileTemplateConfig,
} from "@/utils";
import {
  OutputModeEnum,
  completeDefaultOptions,
  getConfigPath,
  type CompileOptions,
} from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import path from "node:path";
import fs from "node:fs";
import _template from "lodash.template";
import _assign from "lodash.assign";
import { log, xPrompts } from "@done-coding/cli-utils";

/** 获取数据 */
const getData = <
  J extends boolean,
  R extends J extends true ? Record<string, any> : string = J extends true
    ? Record<string, any>
    : string,
>({
  filePath,
  dataInit,
  limitJson,
  filePathKey,
  dataInitKey,
  dealMarkdown = false,
}: {
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

    const fileContentInit = fs.readFileSync(path.resolve(filePath), "utf-8");

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

/** 确保output不为空 */
const ensureOutputNotNull = (mode: OutputModeEnum, output?: string) => {
  if (!output) {
    log.error(`${mode}模式下output不能为空`);
    return process.exit(1);
  }
};

/** 确保output与input不相同 */
const ensureOutputNotEqualsInput = (output?: string, input?: string) => {
  if (input && output === input) {
    log.error(`output与input不能相同`);
    return process.exit(1);
  }
};

/** 确保input不为空 */
const ensureInputNotNull = (mode: OutputModeEnum, input?: string) => {
  if (!input) {
    log.error(`${mode}模式下input不能为空`);
    return process.exit(1);
  }
};

/** 编译模板 */
// eslint-disable-next-line complexity
const compileTemplate = async (
  completeOptions: Omit<CompileTemplateConfigListItem, "envData"> & {
    envData:
      | CompileTemplateConfigListItem["envData"]
      | (() => CompileTemplateConfigListItem["envData"]);
  },
  {
    rollbackDelFileAgree = false,
  }: {
    /** 回滚遇到删除文件是否同意 */
    rollbackDelFileAgree?: boolean;
  } = {},
) => {
  const {
    env,
    input,
    inputData,
    output,
    mode,
    rollback,
    dealMarkdown,
    envData: envDataInit,
  } = completeOptions;

  if (rollback) {
    switch (mode) {
      case OutputModeEnum.REPLACE:
      case OutputModeEnum.RETURN: {
        log.error(`${mode}模式不支持回滚`);
        return;
      }
    }
  }

  log.stage(`开始处理模板
mode: ${mode}
rollback: ${rollback}
`);

  /** 模板内容 */
  const templateContent = getData({
    filePath: input,
    dataInit: inputData,
    limitJson: false,
    filePathKey: "input",
    dataInitKey: "inputData",
    dealMarkdown,
  });

  const compiled = _template(templateContent);
  const envData =
    typeof envDataInit === "function" ? envDataInit() : envDataInit;
  const outputContent = compiled(envData);

  switch (mode) {
    case OutputModeEnum.OVERWRITE: {
      ensureOutputNotNull(mode, output);
      ensureOutputNotEqualsInput(output, input);
      // 上面两个确保后，output一定不为空
      const outputPath = path.resolve(output!);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        if (rollback) {
          if (
            rollbackDelFileAgree
              ? true
              : (
                  await xPrompts({
                    type: "confirm",
                    name: "remove",
                    message: `${mode}模式下回滚将删除${outputPath}，是否继续？`,
                  })
                ).remove
          ) {
            fs.rmSync(outputPath, { force: true });
            log.success(`${mode}模式下${outputPath}已删除`);
            return;
          } else {
            log.warn(`${mode}模式下${outputPath}回滚取消`);
            return;
          }
        }
        log.info(`output:${outputPath} 已存在，将覆盖`);
      } else {
        if (rollback) {
          log.warn(`${mode}模式下${outputPath}不存在，无需回滚`);
          return;
        }
        log.stage(`output:${outputPath} 不存在，将创建`);
      }
      fs.writeFileSync(outputPath, outputContent, "utf-8");
      log.success(`模板处理完成，输出到 ${outputPath}`);
      break;
    }
    case OutputModeEnum.APPEND: {
      ensureOutputNotNull(mode, output);
      ensureOutputNotEqualsInput(output, input);
      // 上面两个确保后，output一定不为空
      const outputPath = path.resolve(output!);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        const oldContent = fs.readFileSync(outputPath, "utf-8");
        if (rollback) {
          fs.writeFileSync(
            outputPath,
            oldContent.replace(outputContent, ""),
            "utf-8",
          );
          log.success(`${mode}模式下${outputPath}回滚完成`);
          return;
        }
        const newContent = oldContent + outputContent;
        fs.writeFileSync(outputPath, newContent, "utf-8");
        log.success(`模板处理完成，追加到 ${outputPath}`);
      } else {
        if (rollback) {
          log.warn(`${mode}模式下${outputPath}不存在，无需回滚`);
          return;
        }
        log.stage(`output:${outputPath} 不存在，将创建`);
        fs.writeFileSync(outputPath, outputContent, "utf-8");
        log.success(`模板处理完成，输出到 ${outputPath}`);
      }
      break;
    }
    case OutputModeEnum.REPLACE: {
      if (output) {
        log.warn(`output ${output} 将被忽略`);
      }
      ensureInputNotNull(mode, input);

      if (env && env === input) {
        log.error(`env 与 input 不能相同`);
        return process.exit(1);
      }
      const inputPathInit = path.resolve(input!);
      let inputPath = inputPathInit;

      // 输入文件-不包含运行目录部分
      const inputRawFilePath = input!.replace(`${process.cwd()}/`, "");
      // 输入文件路径编译
      const inputCompileFilePath = _template(inputRawFilePath)(envData);
      if (inputCompileFilePath !== inputRawFilePath) {
        log.success(`检测输入文件名也需要替换
            ./${inputRawFilePath} => ./${inputCompileFilePath} `);
        fs.rmSync(inputPathInit);
        inputPath = path.resolve(`./${inputCompileFilePath}`);
      }
      fs.mkdirSync(path.dirname(inputPath), { recursive: true });
      fs.writeFileSync(inputPath, outputContent, "utf-8");
      log.success(`模板处理完成，输出到 ${inputPath}`);
      break;
    }
    case OutputModeEnum.RETURN: {
      log.success(`模板处理完成，返回结果(函数调用才会拿到返回值)`);
      return outputContent;
    }
    default: {
      log.error(`mode ${mode} 不支持`);
      return process.exit(1);
    }
  }

  return outputContent;
};

/** 批量编译模板 */
export const batchCompileHandler = async (
  {
    rootDir = process.cwd(),
    itemDefaultRollback = false,
    extraEnvData = {},
  }: {
    /** 根目录 */
    rootDir?: string;
    /** item默认回滚? */
    itemDefaultRollback?: boolean;
    /** 额外环境变量 */
    extraEnvData?: object;
  } = {},
  paramsConfig?: CompileTemplateConfig,
) => {
  let config: CompileTemplateConfig;
  if (paramsConfig) {
    config = paramsConfig;
  } else {
    const configPath = getConfigPath(rootDir);

    if (!configPath) {
      log.error(`配置文件${configPath}不存在`);
      return process.exit(1);
    }

    const configStr = fs.readFileSync(configPath, "utf-8");

    config = JSON.parse(configStr) as CompileTemplateConfig;
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

  // console.log(140, collectEnvData);

  const list = listInit.map((item) => {
    /** 使用item的rollback，否则使用globalRollback */
    const { rollback = itemDefaultRollback } = item;
    const {
      envData: itemEnvData,
      env,
      input,
      output,
      ...rest
    } = completeDefaultOptions(item);

    if (env) {
      log.warn(`批量处理中 env:${env} 将被忽略，只读envData`);
    }

    return {
      ...rest,
      env,
      input: rootDir && input ? path.resolve(rootDir, input) : input,
      output: rootDir && output ? path.resolve(rootDir, output) : output,
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
      rollbackDelFileAgree: true,
    });
    listResult.push(result);
  }

  return listResult;
};

/** 编译模板 */
export const compileHandler = async (argv: CliHandlerArgv<CompileOptions>) => {
  const {
    envData: envDataInit,
    env,
    input,
    inputData,
    output,
    mode,
    rollback,
    dealMarkdown,
    batch,
  } = completeDefaultOptions(argv);

  if (batch) {
    log.stage(`开始批量处理`);
    return batchCompileHandler({
      // 回滚默认值 基于全局
      itemDefaultRollback: rollback,
    });
  }
  log.stage(`开始单个处理`);

  /** 环境变量 */
  const envData = getData({
    filePath: env,
    dataInit: envDataInit,
    limitJson: true,
    filePathKey: "env",
    dataInitKey: "envData",
    dealMarkdown,
  });

  return compileTemplate({
    input,
    inputData,
    output,
    mode,
    rollback,
    dealMarkdown,
    envData,
  });
};
