import type {
  CompileTemplateConfigListItem,
  CompileTemplateConfig,
} from "@/utils";
import { OutputModeEnum, completeDefaultOptions, type Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import _template from "lodash.template";
import _assign from "lodash.assign";
import prompts from "prompts";
import injectInfo from "@/injectInfo.json";

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
  filePathKey: keyof Options;
  /** 初始数据key */
  dataInitKey: keyof Options;
  /** (检测是markdown)是否处理(单个)代码块包裹 */
  dealMarkdown?: boolean;
}): R => {
  if (filePath) {
    if (limitJson) {
      if (!filePath.endsWith(".json")) {
        console.log(
          chalk.red(`${filePathKey}必须是json文件，请检查文件后缀名`),
        );
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
      console.log(chalk.red(`${filePathKey}与${dataInitKey}不能同时为空`));
      return process.exit(1);
    }
    console.log(
      chalk.green(`${filePathKey} 为空，将使用${dataInitKey}作为数据`),
    );

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
    console.log(chalk.red(`${mode}模式下output不能为空`));
    return process.exit(1);
  }
};

/** 确保output与input不相同 */
const ensureOutputNotEqualsInput = (output: string, input?: string) => {
  if (input && output === input) {
    console.log(chalk.red(`output与input不能相同`));
    return process.exit(1);
  }
};

/** 确保input不为空 */
const ensureInputNotNull = (mode: OutputModeEnum, input?: string) => {
  if (!input) {
    console.log(chalk.red(`${mode}模式下input不能为空`));
    return process.exit(1);
  }
};

/** 编译模板 */
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
        console.log(chalk.red(`${mode}模式不支持回滚`));
        return;
      }
    }
  }

  console.log(
    chalk.blue(`开始处理模板
mode: ${mode}
rollback: ${rollback}
`),
  );

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
      const outputPath = path.resolve(output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        if (rollback) {
          if (
            rollbackDelFileAgree
              ? true
              : (
                  await prompts({
                    type: "confirm",
                    name: "remove",
                    message: `${mode}模式下回滚将删除${outputPath}，是否继续？`,
                  })
                ).remove
          ) {
            fs.rmSync(outputPath, { force: true });
            console.log(chalk.green(`${mode}模式下${outputPath}已删除`));
            return;
          } else {
            console.log(chalk.yellow(`${mode}模式下${outputPath}回滚取消`));
            return;
          }
        }
        console.log(chalk.blue(`output:${outputPath} 已存在，将覆盖`));
      } else {
        if (rollback) {
          console.log(
            chalk.yellow(`${mode}模式下${outputPath}不存在，无需回滚`),
          );
          return;
        }
        console.log(chalk.blue(`output:${outputPath} 不存在，将创建`));
      }
      fs.writeFileSync(outputPath, outputContent, "utf-8");
      console.log(chalk.green(`模板处理完成，输出到 ${outputPath}`));
      break;
    }
    case OutputModeEnum.APPEND: {
      ensureOutputNotNull(mode, output);
      ensureOutputNotEqualsInput(output, input);
      const outputPath = path.resolve(output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        const oldContent = fs.readFileSync(outputPath, "utf-8");
        if (rollback) {
          fs.writeFileSync(
            outputPath,
            oldContent.replace(outputContent, ""),
            "utf-8",
          );
          console.log(chalk.green(`${mode}模式下${outputPath}回滚完成`));
          return;
        }
        const newContent = oldContent + outputContent;
        fs.writeFileSync(outputPath, newContent, "utf-8");
        console.log(chalk.green(`模板处理完成，追加到 ${outputPath}`));
      } else {
        if (rollback) {
          console.log(
            chalk.yellow(`${mode}模式下${outputPath}不存在，无需回滚`),
          );
          return;
        }
        console.log(chalk.blue(`output:${outputPath} 不存在，将创建`));
        fs.writeFileSync(outputPath, outputContent, "utf-8");
        console.log(chalk.green(`模板处理完成，输出到 ${outputPath}`));
      }
      break;
    }
    case OutputModeEnum.REPLACE: {
      if (output) {
        console.log(chalk.yellow(`output ${output} 将被忽略`));
      }
      ensureInputNotNull(mode, input);

      if (env && env === input) {
        console.log(chalk.red(`env 与 input 不能相同`));
        return process.exit(1);
      }
      const inputPath = path.resolve(input!);
      fs.mkdirSync(path.dirname(inputPath), { recursive: true });
      fs.writeFileSync(inputPath, outputContent, "utf-8");
      console.log(chalk.green(`模板处理完成，输出到 ${inputPath}`));
      break;
    }
    case OutputModeEnum.RETURN: {
      console.log(
        chalk.green(`模板处理完成，返回结果(函数调用才会拿到返回值)`),
      );
      return outputContent;
    }
    default: {
      console.log(chalk.red(`mode ${mode} 不支持`));
      return process.exit(1);
    }
  }

  return outputContent;
};

export const batchHandler = async (
  {
    itemDefaultRollback = false,
  }: {
    /** item默认回滚? */
    itemDefaultRollback?: boolean;
  } = {},
  paramsConfig?: CompileTemplateConfig,
) => {
  let config: CompileTemplateConfig;
  if (paramsConfig) {
    config = paramsConfig;
  } else {
    const { namespaceDir, moduleName } = injectInfo.cliConfig;
    const configPath = path.resolve(namespaceDir, `${moduleName}.json`);

    if (!fs.existsSync(configPath)) {
      console.log(chalk.red(`配置文件${configPath}不存在`));
      return process.exit(1);
    }

    const configStr = fs.readFileSync(configPath, "utf-8");

    config = JSON.parse(configStr) as CompileTemplateConfig;
  }

  const {
    list: listInit,
    globalEnvData = {},
    collectEnvDataForm = [],
  } = config;

  const collectEnvData: Record<string, any> = {};

  for (const formItem of collectEnvDataForm) {
    let keyName: string;
    let label: string;
    if (typeof formItem === "string") {
      keyName = formItem;
      label = formItem;
    } else {
      keyName = formItem.key;
      label = formItem.label;
    }
    collectEnvData[keyName] = (
      await prompts({
        type: "text",
        name: keyName,
        message: `请输入${label}`,
        format: (value) => (value || "").trim(),
        validate: (value) => {
          if (!value) {
            return `${label}不能为空`;
          }
          return true;
        },
      })
    )[keyName];
  }

  console.log(140, collectEnvData);

  const list = listInit.map((item) => {
    /** 使用item的rollback，否则使用globalRollback */
    const { rollback = itemDefaultRollback } = item;
    const { envData: itemEnvData, env, ...rest } = completeDefaultOptions(item);

    if (env) {
      console.log(chalk.yellow(`批量处理中 env:${env} 将被忽略，只读envData`));
    }

    return {
      ...rest,
      envData: _assign({}, globalEnvData, collectEnvData, itemEnvData),
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

export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
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
    console.log(chalk.blue("开始批量处理"));
    return batchHandler({
      // 回滚默认值 基于全局
      itemDefaultRollback: rollback,
    });
  }
  console.log(chalk.blue("开始单个处理"));

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
