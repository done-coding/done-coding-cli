/**
 * [T7] dc-component = @done-coding/cli-generator 的 component 预设薄兼容包装。
 *
 * `dc-component <verb> <name>` 等价于 `dc-gen <verb> component <name>`：
 *  - batchType 钉死为 injectInfo.cliConfig.batchType（= "component"）；
 *  - 模板目录解析到旧值 `.done-coding/component`（由 generator dir-resolver 按 segment 解析）；
 *  - 业务逻辑（series 算法 / 扫子目录 list / removeEmptyDir / dealMarkdown）全在
 *    `.done-coding/component/config.json5` 声明（T6 机械迁移产物），本包零 JS 业务逻辑（content-free，L7）。
 *
 * 对外契约（[MUST] 保持，packages/cli 依赖）：
 *  - `commandCliInfo`：供 main.ts 装配 dc-component bin / `dc` 子命令树；
 *  - `handler(command, argv)`：兼容旧分发器签名（packages/cli/src/index.ts 重导出为 componentHandler）。
 */
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  addHandler,
  modifyHandler,
  removeHandler,
  listHandler,
  type GeneratorHandlerArgv,
} from "@done-coding/cli-generator";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
  type HandlerContextInit,
  type SubCliInfo,
  type YargsOptionsRecord,
  type YargsPositionalsRecord,
} from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { batchType },
} = injectInfo;

/** dc-component 旧 list 选项（保持旧 CLI 面：-o 布尔门控写文件、-p 输出路径） */
interface ComponentListArgv {
  /** 是否输出(组件名列表)json（旧 -o 布尔门控） */
  outputJson?: boolean;
  /** 输出路径（旧 -p） */
  outputPath?: string;
}

/** 把 batchType 钉死为 component，转调 generator handler（content-free 透传） */
const withBatchType = (
  argv: CliHandlerArgv<GeneratorHandlerArgv>,
): GeneratorHandlerArgv => {
  const merged: GeneratorHandlerArgv = {
    ...(argv as GeneratorHandlerArgv),
    type: batchType,
  };
  return merged;
};

/** add：dc-component add <name> == dc-gen component add <name> */
export const addCommandHandler = (
  argv: CliHandlerArgv<GeneratorHandlerArgv>,
  ctxInit?: HandlerContextInit,
) => addHandler(withBatchType(argv), ctxInit);

/** remove：dc-component remove <name> == dc-gen component remove <name> */
export const removeCommandHandler = (
  argv: CliHandlerArgv<GeneratorHandlerArgv>,
  ctxInit?: HandlerContextInit,
) => removeHandler(withBatchType(argv), ctxInit);

/** modify：dc-component modify <name> == dc-gen component modify <name> */
export const modifyCommandHandler = (
  argv: CliHandlerArgv<GeneratorHandlerArgv>,
  ctxInit?: HandlerContextInit,
) => modifyHandler(withBatchType(argv), ctxInit);

/**
 * list：dc-component list [-o] [-p path] == dc-gen component list [-o]。
 * 旧语义：-o 布尔门控写 json，-p 覆盖输出路径，缺省回退 config.nameListJsonOutputPath。
 * generator list 写文件门控为 `argv.output ?? config.nameListJsonOutputPath` 真值，
 * 故映射：
 *  - -o 真：output = outputPath（-p）或 undefined（让 generator 回退 config 路径）→ 写；
 *  - -o 假：output = ""（空串非 null/undefined，`??` 保留之、`if("")` 为假）→ 仅打表不写（K5 实例 list 路由）。
 */
export const listCommandHandler = (
  argv: CliHandlerArgv<ComponentListArgv>,
  ctxInit?: HandlerContextInit,
) => {
  const { outputJson, outputPath } = argv as ComponentListArgv;
  const output = outputJson ? outputPath : "";
  return listHandler({ type: batchType, output }, ctxInit);
};

/** 旧分发器（兼容签名，packages/cli/src/index.ts 重导出为 componentHandler） */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<GeneratorHandlerArgv & ComponentListArgv>,
) => {
  switch (command) {
    case SubcommandEnum.ADD: {
      return addCommandHandler(argv);
    }
    case SubcommandEnum.MODIFY: {
      return modifyCommandHandler(argv);
    }
    case SubcommandEnum.REMOVE: {
      return removeCommandHandler(argv);
    }
    case SubcommandEnum.LIST: {
      return listCommandHandler(argv);
    }
    default: {
      throw new Error(`不支持的命令 ${command}`);
    }
  }
};

/** <name> positional（add/remove/modify） */
const namePositional: YargsPositionalsRecord<{ name: string }> = {
  name: { describe: "组件名", type: "string" },
};

/** 非交互供答 + 探针 + skip-missing 选项（modify，对齐 generator modifyOptions） */
const modifyOptions: YargsOptionsRecord<
  Pick<
    GeneratorHandlerArgv,
    "env" | "envFile" | "listQuestions" | "skipMissing"
  >
> = {
  env: {
    type: "string",
    describe: "非交互供答(JSON)，key 对齐 collectEnvDataForm[].name",
  },
  envFile: { type: "string", describe: "非交互供答 JSON 文件路径" },
  listQuestions: {
    type: "boolean",
    describe: "仅打印该批次问题清单(JSON)到 stdout，不落地",
    default: false,
  },
  skipMissing: {
    type: "boolean",
    describe: "跳过不存在的 marker 块（块级），改其余",
    default: false,
  },
};

/** 非交互供答 + 探针选项（add，对齐 generator） */
const addOptions: YargsOptionsRecord<
  Pick<GeneratorHandlerArgv, "env" | "envFile" | "listQuestions">
> = {
  env: {
    type: "string",
    describe: "非交互供答(JSON)，key 对齐 collectEnvDataForm[].name",
  },
  envFile: { type: "string", describe: "非交互供答 JSON 文件路径" },
  listQuestions: {
    type: "boolean",
    describe: "仅打印该批次问题清单(JSON)到 stdout，不落地",
    default: false,
  },
};

/** 非交互供答选项（remove） */
const removeOptions: YargsOptionsRecord<
  Pick<GeneratorHandlerArgv, "env" | "envFile">
> = {
  env: { type: "string", describe: "非交互供答(JSON)，用于复算 remove 落地块" },
  envFile: { type: "string", describe: "非交互供答 JSON 文件路径" },
};

/** list 选项（保持旧 -o/-p 面） */
const listOptions: YargsOptionsRecord<ComponentListArgv> = {
  outputJson: {
    alias: "o",
    describe: "是否输出组件名列表json",
    type: "boolean",
    default: false,
  },
  outputPath: {
    alias: "p",
    describe: "输出路径",
    type: "string",
  },
};

const addCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.ADD} <name>`,
  describe: "新增一个组件",
  positionals: namePositional,
  options: addOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    addCommandHandler(argv)) as SubCliInfo["handler"],
};

const modifyCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.MODIFY} <name>`,
  describe: "原位修改组件 inject 块的值",
  positionals: namePositional,
  options: modifyOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    modifyCommandHandler(argv)) as SubCliInfo["handler"],
};

const removeCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.REMOVE} <name>`,
  describe: "移除一个组件",
  positionals: namePositional,
  options: removeOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    removeCommandHandler(argv)) as SubCliInfo["handler"],
};

const listCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.LIST,
  describe: "展示组件列表",
  options: listOptions,
  handler: ((argv: CliHandlerArgv<ComponentListArgv>) =>
    listCommandHandler(argv)) as SubCliInfo["handler"],
};

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [
    addCommandCliInfo,
    modifyCommandCliInfo,
    removeCommandCliInfo,
    listCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
