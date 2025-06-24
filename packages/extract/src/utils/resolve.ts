import type {
  ExtractInputKeyConfigFixed,
  ExtractInputKeyConfigReg,
} from "@/types";
import { ExtractTypeEnum, type ExtractInputKeyConfig } from "@/types";
import path from "node:path";
import fs from "node:fs";
import {
  keyConfigResolve as injectKeyConfigResolve,
  InjectTypeEnum,
} from "@done-coding/cli-inject";

/** 内容解析 */
export const contentResolve = ({
  input,
  rootDir,
}: {
  input: string;
  rootDir: string;
}) => {
  const inputPath = path.resolve(rootDir, input);

  const contentStr = fs.readFileSync(inputPath, "utf-8");

  if (input.endsWith(".json") || input.endsWith(".json5")) {
    return JSON.parse(contentStr) as Record<string, any>;
  } else {
    return contentStr;
  }
};

/** 内容是否为对象 */
export const contentIsObj = (content: ReturnType<typeof contentResolve>) => {
  return typeof content === "object" && !!content;
};

/** 配置解析 */
export const keyConfigResolve = ({
  content,
  targetKey,
  keyConfig,
}: {
  content: ReturnType<typeof contentResolve>;
  targetKey: string;
  keyConfig: ExtractInputKeyConfig;
}) => {
  const { type, ...noTypeKeyConfig } = keyConfig;
  switch (type) {
    case ExtractTypeEnum.REG: {
      if (typeof content !== "string") {
        throw new Error(`${type} 类型的keyConfig需要content为字符串`);
      }

      /** 将文件字符串 包装为一个一[targetKey] = content 的对象 */
      return injectKeyConfigResolve({
        sourceJson: {
          [targetKey]: content,
        },
        targetKey,
        keyConfig: {
          ...(noTypeKeyConfig as Omit<ExtractInputKeyConfigReg, "type">),
          type: InjectTypeEnum.REG,
          sourceKey: targetKey,
        },
      });
    }
    case ExtractTypeEnum.JSON_INJECT: {
      if (!contentIsObj(content)) {
        throw new Error(`${type} 类型的keyConfig需要content为json`);
      }

      return injectKeyConfigResolve({
        sourceJson: content,
        targetKey,
        keyConfig: keyConfig.inject,
      });
    }
    case ExtractTypeEnum.FIXED: {
      return injectKeyConfigResolve({
        sourceJson: {},
        targetKey,
        keyConfig: {
          ...(noTypeKeyConfig as Omit<ExtractInputKeyConfigFixed, "type">),
          type: InjectTypeEnum.FIXED,
        },
      });
    }
    default: {
      throw new Error(`不支持的类型${type}`);
    }
  }
};
