import {
  EditorTypeEnum,
  OutputModeEnum,
  type CompileTemplateConfig,
  type InitOptions,
} from "@/utils";
import { log, xPrompts, type CliHandlerArgv } from "@done-coding/cli-utils";
import { execSync } from "node:child_process";
import templateDefaultJson from "@/json/template-default.json";
import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

export const dispatchEditorCheckRes = (
  cmd: "cursor" | "code",
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

/** 初始化模板 */
export const initHandler = async (argv: CliHandlerArgv<InitOptions>) => {
  const { configPath: configPathInit } = argv;

  const { useDefaultConfig } = await xPrompts({
    name: "useDefaultConfig",
    type: "confirm",
    message: "使用默认模板配置",
  });

  let content: CompileTemplateConfig = {};

  if (useDefaultConfig) {
    content = templateDefaultJson as CompileTemplateConfig;
  } else {
    const { globalEnvCount, collectEnvCount, compileFileCount } =
      await xPrompts([
        {
          name: "globalEnvCount",
          type: "number",
          message: "全局固定变量数量",
          initial: 1,
          format: (value) => Number(value) || 0,
          validate: (value) => value >= 0,
        },
        {
          name: "collectEnvCount",
          type: "number",
          message: "采集变量数量",
          initial: 1,
          format: (value) => Number(value) || 0,
          validate: (value) => value >= 0,
        },
        {
          name: "compileFileCount",
          type: "number",
          message: "预编译文件数量",
          initial: 1,
          format: (value) => Number(value) || 0,
          validate: (value) => value >= 0,
        },
      ]);

    if (globalEnvCount) {
      content.globalEnvData = Array.from({
        length: globalEnvCount,
      }).reduce((acc: CompileTemplateConfig["globalEnvData"], item, index) => {
        acc![`GLOBAL_${index}`] = "";
        return acc;
      }, {});
    }

    if (collectEnvCount) {
      content.collectEnvDataForm = Array.from({
        length: collectEnvCount,
      }).map((_, index) => {
        return {
          key: `COLLECT_KEY_${index}`,
          label: `COLLECT_LABEL_${index}`,
          initial: undefined,
        };
      });
    }
    if (compileFileCount) {
      content.list = Array.from({
        length: compileFileCount,
      }).map((_, index) => {
        return {
          input: `(相对于命令运行目录)需要编译的模板文件路径${index}`,
          output: `(相对于命令运行目录)编译后输出的文件路径${index}`,
          mode: OutputModeEnum.REPLACE,
        };
      });
    }
  }

  /** 生成路径 及 编辑器 */
  const targetAnswer = await xPrompts([
    {
      name: "configPath",
      type: "text",
      message: "配置文件生成路径",
      initial: configPathInit,
    },
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

  const { configPath, editorType } = targetAnswer;

  const configPathFinal = path.resolve(configPath);

  const configPathDir = path.dirname(configPathFinal);
  if (!existsSync(configPathDir)) {
    mkdirSync(configPathDir, {
      recursive: true,
    });
  }

  writeFileSync(configPathFinal, JSON.stringify(content, null, 2));

  if (!useDefaultConfig) {
    log.success(`配置文件已生成：${configPathFinal}
    请具体需要替换
    globalEnvData中的 GLOBAL_\${index}及其对应值
    collectEnvDataForm各项中 COLLECT_KEY_\${index} COLLECT_LABEL_\${index}
    list各项中的 input值 output值
`);
  }

  const outputTip = (extraTip: string) => {
    return log.info(`
      ${extraTip}, 请用编辑器打开 ${configPathFinal} 进行编辑
`);
  };

  switch (editorType) {
    case EditorTypeEnum.CURSOR: {
      dispatchEditorCheckRes("cursor", configPathFinal, () => {
        outputTip("cursor命令未安装");
      });
      break;
    }
    case EditorTypeEnum.VSCODE: {
      dispatchEditorCheckRes("code", configPathFinal, () => {
        outputTip("code命令未安装");
      });
      break;
    }
    default: {
      outputTip(`其他编辑器`);
    }
  }
};
