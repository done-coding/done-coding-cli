/** 编译模板 */

import type {
  CompilePublicConfig,
  CompileTemplateConfigListItem,
} from "@/types";
import { OutputModeEnum } from "@/types";
import {
  outputConsole,
  resolveHandlerContext,
  xPrompts,
  type HandlerContextInit,
} from "@done-coding/cli-utils";
import { getData } from "./get-data";
import _template from "lodash.template";
import {
  ensureInputNotNull,
  ensureOutputNotEqualsInput,
  ensureOutputNotNull,
} from "./ensure";
import {
  computeInsert,
  computeRollback,
  resolveMarkerComment,
  validateMarkerKey,
} from "./marker";
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
  ctxInit?: HandlerContextInit,
) => {
  const ctx = resolveHandlerContext(ctxInit);
  const {
    env,
    input,
    inputData,
    output,
    mode,
    rollbackDelNullFile,
    rollbackDelAskAsYes,
    dealMarkdown,
    rollbackRequireHit,
    anchor,
    markerKey,
    markerComment,
    markerNs,
    envData: envDataInit,
  } = completeOptions;

  if (rollback) {
    switch (mode) {
      case OutputModeEnum.REPLACE:
      case OutputModeEnum.RETURN: {
        outputConsole.error(`${mode}模式不支持回滚`);
        return;
      }
      // A1（design §12）：INSERT 回退独立于模板内容——在 getData/_template **之前**短路，
      // 只认 marker，免疫块内手改/模板缺失/渲染失败。其余 mode 流程一字不动。
      case OutputModeEnum.INSERT: {
        ensureOutputNotNull(mode, output);
        const outputPath = path.resolve(rootDir, output!);
        if (!fs.existsSync(outputPath)) {
          outputConsole.warn(`${mode}模式下${outputPath}不存在，无需回滚`);
          return;
        }
        if (!markerNs) {
          throw new Error(
            `INSERT/回退需注入 markerNs（调用方未提供，禁默认兜底）：${outputPath}`,
          );
        }
        const comment = resolveMarkerComment(outputPath, markerComment);
        const key = validateMarkerKey(markerKey, comment, outputPath, markerNs);
        const oldContent = fs.readFileSync(outputPath, "utf-8");
        const newContent = computeRollback(oldContent, {
          comment,
          markerKey: key,
          markerNs,
          outputPath,
        });
        if (newContent || !rollbackDelNullFile) {
          fs.writeFileSync(outputPath, newContent, "utf-8");
        } else {
          outputConsole.stage(`${mode}模式下 文件为空 删除`);
          fs.unlinkSync(outputPath);
        }
        outputConsole.success(`${mode}模式下${outputPath}回滚完成`);
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
              : ctx.interactive
                ? (
                    await xPrompts({
                      type: "confirm",
                      name: "remove",
                      message: `${mode}模式下回滚将删除${outputPath}，是否继续？`,
                    })
                  ).remove
                : (() => {
                    throw new Error(
                      `${mode}模式回滚需要确认删除 ${outputPath}，当前为非交互模式`,
                    );
                  })()
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
          // additive：仅当显式开启命中检测时校验；不开 = 旧行为逐字节不变（L3 守约）
          if (rollbackRequireHit && !oldContent.includes(outputContent)) {
            outputConsole.error(
              `${mode}模式回滚未命中目标内容，可能已被手动修改：${outputPath}。请手动确认后删除。`,
            );
            throw new Error(`APPEND rollback 未命中：${outputPath}`); // fail-loud，不静默
          }
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
    case OutputModeEnum.INSERT: {
      // 正向 inject（rollback 已在 switch 前短路，A1）：锚点定位 + marker 包裹插入。
      ensureOutputNotNull(mode, output);
      ensureOutputNotEqualsInput(output, input);
      const outputPath = path.resolve(rootDir, output!);
      if (!fs.existsSync(outputPath)) {
        // E3：inject 需既有锚点文件，[MUST NOT] 创建
        outputConsole.error(
          `${mode}模式目标文件不存在，inject 需既有锚点文件：${outputPath}`,
        );
        throw new Error(`inject 目标文件不存在：${outputPath}`);
      }
      if (!markerNs) {
        throw new Error(
          `INSERT/回退需注入 markerNs（调用方未提供，禁默认兜底）：${outputPath}`,
        );
      }
      const comment = resolveMarkerComment(outputPath, markerComment);
      const key = validateMarkerKey(markerKey, comment, outputPath, markerNs);
      const oldContent = fs.readFileSync(outputPath, "utf-8");
      const newContent = computeInsert(oldContent, outputContent, {
        comment,
        markerKey: key,
        markerNs,
        anchor,
        outputPath,
        onNotice: (msg) => outputConsole.info(msg),
      });
      fs.writeFileSync(outputPath, newContent, "utf-8");
      outputConsole.success(`模板处理完成，inject 到 ${outputPath}`);
      break;
    }
    default: {
      outputConsole.error(`mode ${mode} 不支持`);
      return process.exit(1);
    }
  }

  return outputContent;
};
