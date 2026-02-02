/** 编译模板 */

import type {
  CompilePublicConfig,
  CompileTemplateConfigListItem,
} from "@/types";
import { OutputModeEnum } from "@/types";
import { outputConsole, xPrompts } from "@done-coding/cli-utils";
import { getData } from "./get-data";
import _template from "lodash.template";
import {
  ensureInputNotNull,
  ensureOutputNotEqualsInput,
  ensureOutputNotNull,
} from "./ensure";
import path from "node:path";
import fs from "node:fs";

// eslint-disable-next-line complexity
export const compileTemplate = async (
  completeOptions: Omit<CompileTemplateConfigListItem, "envData"> & {
    envData:
      | CompileTemplateConfigListItem["envData"]
      | (() => CompileTemplateConfigListItem["envData"]);
  },
  { rootDir, rollback }: CompilePublicConfig,
) => {
  const {
    env,
    input,
    inputData,
    output,
    mode,
    rollbackDelNullFile,
    rollbackDelAskAsYes,
    dealMarkdown,
    envData: envDataInit,
  } = completeOptions;

  if (rollback) {
    switch (mode) {
      case OutputModeEnum.REPLACE:
      case OutputModeEnum.RETURN: {
        outputConsole.error(`${mode}模式不支持回滚`);
        return;
      }
    }
  }

  outputConsole.stage(`开始处理模板
mode: ${mode}
rollback: ${rollback}
`);

  /** 模板内容 */
  const templateContent = getData({
    rootDir,
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
      const outputPath = path.resolve(rootDir, output!);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        if (rollback) {
          if (
            rollbackDelAskAsYes
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
            outputConsole.success(`${mode}模式下${outputPath}已删除`);
            return;
          } else {
            outputConsole.warn(`${mode}模式下${outputPath}回滚取消`);
            return;
          }
        }
        outputConsole.info(`output:${outputPath} 已存在，将覆盖`);
      } else {
        if (rollback) {
          outputConsole.warn(`${mode}模式下${outputPath}不存在，无需回滚`);
          return;
        }
        outputConsole.stage(`output:${outputPath} 不存在，将创建`);
      }
      fs.writeFileSync(outputPath, outputContent, "utf-8");
      outputConsole.success(`模板处理完成，输出到 ${outputPath}`);
      break;
    }
    case OutputModeEnum.APPEND: {
      ensureOutputNotNull(mode, output);
      ensureOutputNotEqualsInput(output, input);
      // 上面两个确保后，output一定不为空
      const outputPath = path.resolve(rootDir, output!);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        const oldContent = fs.readFileSync(outputPath, "utf-8");
        if (rollback) {
          const newContent = oldContent.replace(outputContent, "");

          if (newContent || !rollbackDelNullFile) {
            fs.writeFileSync(outputPath, newContent, "utf-8");
          } else {
            outputConsole.stage(`${mode}模式下 文件为空 删除`);
            fs.unlinkSync(outputPath);
          }

          outputConsole.success(`${mode}模式下${outputPath}回滚完成`);
          return;
        }
        const newContent = oldContent + outputContent;
        fs.writeFileSync(outputPath, newContent, "utf-8");
        outputConsole.success(`模板处理完成，追加到 ${outputPath}`);
      } else {
        if (rollback) {
          outputConsole.warn(`${mode}模式下${outputPath}不存在，无需回滚`);
          return;
        }
        outputConsole.stage(`output:${outputPath} 不存在，将创建`);
        fs.writeFileSync(outputPath, outputContent, "utf-8");
        outputConsole.success(`模板处理完成，输出到 ${outputPath}`);
      }
      break;
    }
    case OutputModeEnum.REPLACE: {
      if (output) {
        outputConsole.warn(`output ${output} 将被忽略`);
      }
      ensureInputNotNull(mode, input);

      if (env && env === input) {
        outputConsole.error(`env 与 input 不能相同`);
        return process.exit(1);
      }
      const inputPathInit = path.resolve(rootDir, input!);
      let inputPath = inputPathInit;

      // 输入文件路径编译
      const inputCompileFilePath = _template(inputPathInit)(envData);
      if (inputCompileFilePath !== inputPathInit) {
        outputConsole.success(`检测输入文件名也需要替换
            ${inputPathInit} => ${inputCompileFilePath}`);
        fs.rmSync(inputPathInit);
        inputPath = inputCompileFilePath;
      }
      fs.mkdirSync(path.dirname(inputPath), { recursive: true });
      fs.writeFileSync(inputPath, outputContent, "utf-8");
      outputConsole.success(`模板处理完成，输出到 ${inputPath}`);
      break;
    }
    case OutputModeEnum.RETURN: {
      outputConsole.success(`模板处理完成，返回结果(函数调用才会拿到返回值)`);
      return outputContent;
    }
    default: {
      outputConsole.error(`mode ${mode} 不支持`);
      return process.exit(1);
    }
  }

  return outputContent;
};
