/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-11 09:28:42
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:37:30
 */
import { outputConsole } from "@/env-config";
import { xPrompts } from "@/prompts";
import { execSync } from "node:child_process";

/** 编辑器类型枚举 */
export enum EditorTypeEnum {
  /** vscode */
  VSCODE = "VsCode",
  /** cursor */
  CURSOR = "Cursor",
  /** 其他编辑器 */
  OTHER = "其他",
}

/** 获取编辑器类型 */
export const getEditorType = async () => {
  const { editorType } = await xPrompts([
    {
      name: "editorType",
      type: "select",
      message: "编辑器类型",
      choices: [
        EditorTypeEnum.CURSOR,
        EditorTypeEnum.VSCODE,
        EditorTypeEnum.OTHER,
      ].map((item) => ({
        title: item,
        value: item,
      })),
    },
  ]);
  return editorType;
};

const editorTypeCmdMap = {
  [EditorTypeEnum.CURSOR]: "cursor",
  [EditorTypeEnum.VSCODE]: "code",
};

const dispatchEditorCheckRes = (
  cmd: string,
  path: string,
  onError: () => void,
) => {
  try {
    execSync(`${cmd} -v`, { stdio: "ignore" });
    execSync(`${cmd} ${path}`);
  } catch (error) {
    onError();
  }
};

/** 用编辑器打开文件 */
export const openFileInEditor = (path: string, editorType: EditorTypeEnum) => {
  const outputTip = (extraTip: string) => {
    return outputConsole.info(`
      ${extraTip}, 请用编辑器打开 ${path} 进行编辑
`);
  };

  switch (editorType) {
    case EditorTypeEnum.CURSOR:
    case EditorTypeEnum.VSCODE: {
      const cmd = editorTypeCmdMap[editorType];
      dispatchEditorCheckRes(cmd, path, () => {
        outputTip(`${cmd}命令未安装`);
      });
      break;
    }
    default: {
      outputTip(`其他编辑器`);
    }
  }
};
