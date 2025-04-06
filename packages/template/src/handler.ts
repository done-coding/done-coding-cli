import { OutputModeEnum, type Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import _template from "lodash.template";
import prompts from "prompts";

/** 获取数据 */
const getData = <
  J extends boolean,
  R extends J extends true ? Record<string, any> : string = J extends true
    ? Record<string, any>
    : string,
>({
  filePath,
  dataInit,
  json,
  filePathKey,
  dataInitKey,
}: {
  /** 文件相对路径 */
  filePath?: string;
  /** 初始数据 */
  dataInit?: string;
  /** 是否json格式 */
  json: J;
  /** 文件路径key */
  filePathKey: keyof Options;
  /** 初始数据key */
  dataInitKey: keyof Options;
}): R => {
  if (filePath) {
    if (json) {
      if (!filePath.endsWith(".json")) {
        console.log(
          chalk.red(`${filePathKey}必须是json文件，请检查文件后缀名`),
        );
        return process.exit(1);
      }
    }

    const fileContent = fs.readFileSync(path.resolve(filePath), "utf-8");

    if (json) {
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

    if (json) {
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

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  const {
    envData: envDataInit,
    env,
    input,
    inputData,
    output,
    mode = OutputModeEnum.OVERWRITE,
    rollback = false,
  } = argv;

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

  /** 环境变量 */
  const envData = getData({
    filePath: env,
    dataInit: envDataInit,
    json: true,
    filePathKey: "env",
    dataInitKey: "envData",
  });

  /** 模板内容 */
  const templateContent = getData({
    filePath: input,
    dataInit: inputData,
    json: false,
    filePathKey: "input",
    dataInitKey: "inputData",
  });

  const compiled = _template(templateContent);
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
            (
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
