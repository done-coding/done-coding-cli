import {
  getRemoveDirForm,
  projectNameForm,
  getTemplateChoices,
  getTemplateForm,
  SOMEONE_PUBLIC_REPO_NAME,
  customUrlForm,
  getGitCommitMessageForm,
  CUSTOM_TEMPLATE_NAME,
  getTemplateGitBranchForm,
  materializeTemplateToProject,
  resolveTemplateSourceFromUrl,
  type TemplateSourceInfo,
} from "@/utils";
import type {
  CliHandlerArgv,
  CliInfo,
  HandlerContextInit,
  SubCliInfo,
} from "@done-coding/cli-utils";
import {
  execSyncHijack,
  generateGetAnswerSwiftFn,
  getSafePath,
  lookForParentTarget,
  outputConsole,
  readConfigFile,
  resolveHandlerContext,
  rmGitCtrlAsync,
  safeCwd,
  safeRemoveDirSync,
  updateEnvConfig,
} from "@done-coding/cli-utils";
import {
  batchCompileHandler,
  getConfigPath,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  normalizeCollectEnvDataForm,
  type CompileTemplateConfig,
  type CollectEnvDataQuestion,
} from "@done-coding/cli-template";
import { getTargetRepoUrl } from "@done-coding/cli-git";
import { cloneDoneCodingSeries } from "@done-coding/cli-git/helpers";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path, { resolve } from "node:path";
import injectInfo from "@/injectInfo.json";
import { FormNameEnum } from "@/types";
import type {
  CreateTemplateSourceTypeEnum,
  CreateCompleteOptions,
  CreateOptions,
  CreatePrepareResult,
} from "@/types";

const CREATE_DRAFT_RELATIVE_DIR = ".done-coding/default/tmp/create";
const CREATE_DRAFT_STATE_FILE_NAME = "draft.json";

interface CreateDraftState {
  draftId: string;
  rootDir: string;
  projectName: string;
  targetProjectPath: string;
  draftDir: string;
  draftProjectPath: string;
  templateSourceType: CreateTemplateSourceTypeEnum;
  templateUrl: string;
  templateBranch?: string;
  templateDirectory?: string;
  parentGitDir?: string;
  configPath: string;
  skipTemplateCompile: boolean;
  openGitDetailOptimize: boolean;
}

const getOptions = (): CliInfo["options"] => {
  return {
    rootDir: {
      type: "string",
      describe: "创建项目的根目录",
      hidden: true,
    },
    [FormNameEnum.PROJECT_NAME]: {
      alias: "n",
      type: "string",
      describe: "项目名称",
    },
    justCloneFromDoneCoding: {
      alias: "clone",
      type: "boolean",
      describe: "是否仅仅(从done-coding系列项目列表中)克隆远程仓库",
      default: false,
      hidden: true,
    },
    [FormNameEnum.TEMPLATE_URL]: {
      alias: "p",
      type: "string",
      describe: "模板地址",
    },
    [FormNameEnum.TEMPLATE_GIT_PATH]: {
      type: "string",
      describe: "模板仓库地址",
      hidden: true,
    },
    [FormNameEnum.TEMPLATE_GIT_BRANCH]: {
      alias: "b",
      type: "string",
      describe: "模板仓库分支",
    },
    templateDirectory: {
      type: "string",
      describe: "仓库内模板目录",
    },
    templateConfig: {
      type: "string",
      describe: "模板列表配置文件路径(本地)",
    },
    env: {
      type: "string",
      describe:
        '模板预设答案(JSON)，非交互供答。如 --env \'{"organization":"acme","name":"app"}\'。key 对齐模板 collectEnvDataForm[].key',
    },
    envFile: {
      type: "string",
      describe:
        "模板预设答案 JSON 文件路径(非交互供答)，内容为 { key: value } 对象",
    },
    listQuestions: {
      type: "boolean",
      describe: "仅打印该模板预设问题清单(JSON)到 stdout，不创建项目",
      default: false,
    },
    skipTemplateCompile: {
      type: "boolean",
      describe: "是否跳过模板编译",
      default: false,
      hidden: true,
    },
    openGitDetailOptimize: {
      type: "boolean",
      describe: "开启git细节优化",
      default: true,
    },
    [FormNameEnum.GIT_COMMIT_MESSAGE]: {
      alias: "m",
      type: "string",
      describe: "git细节优化:git提交信息",
    },
  };
};

const getDraftRootDir = (rootDir: string) => {
  return path.resolve(rootDir, CREATE_DRAFT_RELATIVE_DIR);
};

const getDraftDir = (rootDir: string, draftId: string) => {
  return path.resolve(getDraftRootDir(rootDir), draftId);
};

const getDraftStatePath = (draftDir: string) => {
  return path.resolve(draftDir, CREATE_DRAFT_STATE_FILE_NAME);
};

const writeDraftState = (state: CreateDraftState) => {
  mkdirSync(state.draftDir, { recursive: true });
  writeFileSync(
    getDraftStatePath(state.draftDir),
    JSON.stringify(state, null, 2),
  );
};

const readDraftState = ({
  rootDir,
  draftId,
}: {
  rootDir: string;
  draftId: string;
}): CreateDraftState => {
  const draftDir = getDraftDir(rootDir, draftId);
  const draftStatePath = getDraftStatePath(draftDir);
  if (!existsSync(draftStatePath)) {
    throw new Error(`创建草稿不存在: ${draftId}`);
  }
  return JSON.parse(readFileSync(draftStatePath, "utf-8")) as CreateDraftState;
};

const getCreateRootDir = (
  argv: CliHandlerArgv<Pick<CreateOptions, "rootDir">>,
  ctxInit?: HandlerContextInit,
) => {
  const ctx = resolveHandlerContext(ctxInit);
  return resolve(ctx.cwd, argv.rootDir ?? ctx.cwd);
};

const ensureTargetProjectNotExists = async ({
  projectName,
  projectNamePath,
  argv,
  ctxInit,
}: {
  projectName: string;
  projectNamePath: string;
  argv: CliHandlerArgv<CreateOptions>;
  ctxInit?: HandlerContextInit;
}) => {
  if (!existsSync(projectNamePath)) {
    return;
  }

  const getAnswerSwift = generateGetAnswerSwiftFn({
    presetAnswer: argv,
    ctx: ctxInit,
  });

  const isRemove = await getAnswerSwift<boolean>(
    FormNameEnum.IS_REMOVE_SAME_NAME_DIR,
    getRemoveDirForm(),
  );

  if (isRemove === true) {
    safeRemoveDirSync({
      targetPath: projectNamePath,
      parentDir: path.dirname(projectNamePath),
      label: "同名项目目录",
    });
    return;
  }

  throw new Error(`项目${projectName}已存在`);
};

const resolveTemplateSourceInfo = async ({
  argv,
  ctxInit,
}: {
  argv: CliHandlerArgv<CreateOptions>;
  ctxInit?: HandlerContextInit;
}): Promise<TemplateSourceInfo> => {
  const getAnswerSwift = generateGetAnswerSwiftFn({
    presetAnswer: argv,
    ctx: ctxInit,
  });

  let templateUrl: string | undefined =
    (await getAnswerSwift(FormNameEnum.TEMPLATE_URL)) ??
    (await getAnswerSwift(FormNameEnum.TEMPLATE_GIT_PATH));
  let templateBranch: string | undefined = await getAnswerSwift(
    FormNameEnum.TEMPLATE_GIT_BRANCH,
  );
  let templateDirectory = argv.templateDirectory;

  if (!templateUrl) {
    // MCP 模式：模板来源 [MUST] 经 list 工具显式选定后由调用方传入 templateUrl。
    // [MUST NOT] 读取 CLI 的 --templateConfig / 家目录全局配置 / 远程默认配置（更不联网）。
    const ctx = resolveHandlerContext(ctxInit);
    if (ctx.mode === "mcp") {
      throw new Error(
        "MCP 模式下必须经 list 工具显式提供模板来源(templateUrl)，不读取全局配置或远程默认模板列表",
      );
    }

    const template = await getAnswerSwift<string>(
      FormNameEnum.TEMPLATE,
      await getTemplateForm(argv.templateConfig),
    );

    if (template === CUSTOM_TEMPLATE_NAME) {
      templateUrl = await getAnswerSwift<string>(
        FormNameEnum.CUSTOM_GIT_URL_INPUT,
        customUrlForm,
      );
    } else if (template === SOMEONE_PUBLIC_REPO_NAME) {
      templateUrl = await getTargetRepoUrl();
    } else {
      const target = (await getTemplateChoices(argv.templateConfig)).find(
        (item) => item.name === template,
      );
      if (!target) {
        throw new Error(`模板${template}不存在`);
      }

      if (!target.url) {
        throw new Error(`模板${template}地址不存在`);
      }
      templateUrl = target.url;
      if (typeof target.branch === "string") {
        templateBranch = target.branch;
      } else if (Array.isArray(target.branch) && target.branch.length > 0) {
        templateBranch = await getAnswerSwift(
          FormNameEnum.TEMPLATE_GIT_BRANCH,
          getTemplateGitBranchForm(target.branch),
        );
      }
      templateDirectory = target.directory;
    }
  }

  if (!templateUrl) {
    throw new Error(`模板地址不存在`);
  }

  return resolveTemplateSourceFromUrl({
    templateUrl,
    templateBranch,
    directory: templateDirectory,
  });
};

const moveDraftProjectToTarget = (state: CreateDraftState) => {
  if (existsSync(state.targetProjectPath)) {
    throw new Error(`目标项目目录已存在: ${state.targetProjectPath}`);
  }
  renameSync(state.draftProjectPath, state.targetProjectPath);
  safeRemoveDirSync({
    targetPath: state.draftDir,
    parentDir: getDraftRootDir(state.rootDir),
    label: "创建项目草稿目录",
  });
};

/** 准备创建项目：非交互模式下克隆模板、读取模板预置问题并返回草稿信息 */
export const prepareCreateProject = async (
  argv: CliHandlerArgv<CreateOptions>,
  ctxInit?: HandlerContextInit,
): Promise<CreatePrepareResult> => {
  const ctx = resolveHandlerContext(ctxInit);
  const rootDir = getCreateRootDir(argv, ctx);
  const getAnswerSwift = generateGetAnswerSwiftFn({
    presetAnswer: argv,
    ctx,
  });

  const projectNameNoTrim = await getAnswerSwift(
    FormNameEnum.PROJECT_NAME,
    projectNameForm,
    argv[FormNameEnum.PROJECT_NAME],
  );

  let projectName = projectNameNoTrim?.trim();
  if (!projectName) {
    throw new Error(`项目名称不能为空`);
  }

  const projectNameSafe = getSafePath(projectName);
  if (projectNameSafe !== projectName) {
    outputConsole.warn(
      `项目名称\`${projectName}\`包含非法字符，已自动转换为\`${projectNameSafe}\``,
    );
    projectName = projectNameSafe;
  }

  const targetProjectPath = resolve(rootDir, projectName);
  await ensureTargetProjectNotExists({
    projectName,
    projectNamePath: targetProjectPath,
    argv,
    ctxInit: ctx,
  });

  const templateSource = await resolveTemplateSourceInfo({
    argv,
    ctxInit: ctx,
  });

  const parentGitDir = lookForParentTarget(".git", { currentDir: rootDir });
  const draftId = randomUUID();
  const draftDir = getDraftDir(rootDir, draftId);
  const draftProjectPath = resolve(draftDir, projectName);
  const skipTemplateCompile = argv.skipTemplateCompile ?? false;
  const openGitDetailOptimize = argv.openGitDetailOptimize ?? true;

  outputConsole.stage("正在初始化项目，请稍等...");
  const templateInstance = materializeTemplateToProject({
    templateSource,
    rootDir,
    targetPath: draftProjectPath,
  });
  outputConsole.stage(`模板已生成: ${projectName}`);

  const configPath = MODULE_DEFAULT_CONFIG_RELATIVE_PATH;
  const state: CreateDraftState = {
    draftId,
    rootDir,
    projectName,
    targetProjectPath,
    draftDir,
    draftProjectPath,
    templateSourceType: templateInstance.type,
    templateUrl: templateInstance.url,
    templateBranch: templateInstance.branch,
    templateDirectory: templateInstance.directory,
    parentGitDir,
    configPath,
    skipTemplateCompile,
    openGitDetailOptimize,
  };
  writeDraftState(state);

  const configPathFinal = getConfigPath({
    rootDir: draftProjectPath,
    configPath,
  });

  if (!configPathFinal || skipTemplateCompile) {
    return {
      status: "ready",
      draftId,
      projectPath: targetProjectPath,
      draftProjectPath,
    };
  }

  const config = await readConfigFile<CompileTemplateConfig>({
    rootDir: draftProjectPath,
    configPath,
  });
  const questions: CollectEnvDataQuestion[] = normalizeCollectEnvDataForm(
    config?.collectEnvDataForm,
  );

  if (questions.length === 0) {
    return {
      status: "ready",
      draftId,
      projectPath: targetProjectPath,
      draftProjectPath,
    };
  }

  outputConsole.stage(`当前模板项目配置了预设问题`);

  return {
    status: "need_input",
    draftId,
    projectPath: targetProjectPath,
    draftProjectPath,
    questions,
  };
};

const getCompleteAnswerSwift = (
  argv: CliHandlerArgv<CreateCompleteOptions>,
  ctxInit?: HandlerContextInit,
) => {
  return generateGetAnswerSwiftFn({
    presetAnswer: argv,
    ctx: ctxInit,
  });
};

const applyTemplateCompile = async ({
  state,
  argv,
  ctxInit,
}: {
  state: CreateDraftState;
  argv: CliHandlerArgv<CreateCompleteOptions>;
  ctxInit?: HandlerContextInit;
}) => {
  const configPathFinal = getConfigPath({
    rootDir: state.draftProjectPath,
    configPath: state.configPath,
  });

  if (!configPathFinal) {
    return;
  }

  if (state.skipTemplateCompile) {
    outputConsole.stage(`用户设置:跳过模板编译`);
    return;
  }

  outputConsole.stage(`开始进行模板编译`);
  await batchCompileHandler(
    {
      rootDir: state.draftProjectPath,
      configPath: state.configPath,
      extraEnvData: {
        $projectName: state.projectName,
      },
      collectEnvData: argv.envData,
    },
    undefined,
    ctxInit,
  );
  rmSync(configPathFinal, { force: true });
  outputConsole.stage("模板项目配置编译成功, 编译配置文件已删除");
};

const applyGitDetailOptimize = async ({
  state,
  argv,
  ctxInit,
}: {
  state: CreateDraftState;
  argv: CliHandlerArgv<CreateCompleteOptions>;
  ctxInit?: HandlerContextInit;
}) => {
  const ctx = resolveHandlerContext(ctxInit);
  const getAnswerSwift = getCompleteAnswerSwift(argv, ctx);

  if (!state.openGitDetailOptimize) {
    outputConsole.stage(`跳过git细节优化`);
    return;
  }

  outputConsole.stage("项目初始化完成");

  await rmGitCtrlAsync(state.draftProjectPath);
  if (state.parentGitDir) {
    outputConsole.stage(
      `项目创建在父级git仓库${state.parentGitDir}中，已跳过${state.projectName}目录git初始化`,
    );
    return;
  }
  execSyncHijack(`git init`, {
    cwd: state.draftProjectPath,
    stdio: "inherit",
  });

  const gitCommitMessage = await getAnswerSwift<string>(
    FormNameEnum.GIT_COMMIT_MESSAGE,
    ctx.interactive ? getGitCommitMessageForm(state.projectName) : undefined,
    ctx.interactive ? undefined : `feat: 初始化项目${state.projectName}`,
  );

  execSyncHijack(`git add . && git commit -m '${gitCommitMessage}'`, {
    cwd: state.draftProjectPath,
    stdio: "inherit",
  });
};

/** 完成创建项目：使用 prepare 阶段草稿和模板参数完成编译、git 初始化与目录落位 */
export const completeCreateProject = async (
  argv: CliHandlerArgv<CreateCompleteOptions>,
  ctxInit?: HandlerContextInit,
) => {
  const ctx = resolveHandlerContext(ctxInit);
  const rootDir = getCreateRootDir(argv, ctx);
  const state = readDraftState({
    rootDir,
    draftId: argv.draftId,
  });

  await applyTemplateCompile({
    state,
    argv,
    ctxInit: ctx,
  });

  await applyGitDetailOptimize({
    state,
    argv,
    ctxInit: ctx,
  });

  moveDraftProjectToTarget(state);

  outputConsole.success(`项目${state.projectName}初始化完成`);
  outputConsole.info(`
使用步骤: 
  1. cd ${state.projectName}
  2. pnpm install
  3. pnpm run dev
  `);

  return {
    success: true,
    projectPath: state.targetProjectPath,
    draftId: state.draftId,
    message: `项目${state.projectName}初始化完成`,
  };
};

// eslint-disable-next-line complexity
const interactiveCreateHandler = async (
  argv: CliHandlerArgv<CreateOptions>,
) => {
  outputConsole.info(`版本: ${injectInfo.version}`);

  const {
    [FormNameEnum.PROJECT_NAME]: projectNameInit,
    justCloneFromDoneCoding,
  } = argv;

  if (justCloneFromDoneCoding) {
    outputConsole.info(`仅仅(从done-coding系列项目列表中)克隆远程仓库`);
    await cloneDoneCodingSeries(projectNameInit);
    return;
  }

  const getAnswerSwift = generateGetAnswerSwiftFn({
    presetAnswer: argv,
  });

  const projectNameNoTrim = await getAnswerSwift(
    FormNameEnum.PROJECT_NAME,
    projectNameForm,
    projectNameInit,
  );

  let projectName = projectNameNoTrim?.trim();

  if (!projectName) {
    outputConsole.error(`项目名称不能为空`);
    return process.exit(1);
  }

  const projectNameSafe = getSafePath(projectName);

  if (projectNameSafe !== projectName) {
    outputConsole.warn(
      `项目名称\`${projectName}\`包含非法字符，已自动转换为\`${projectNameSafe}\``,
    );
    projectName = projectNameSafe;
  }

  const projectNamePath = resolve(safeCwd(), projectName);

  if (existsSync(projectNamePath)) {
    const isRemove = await getAnswerSwift<boolean>(
      FormNameEnum.IS_REMOVE_SAME_NAME_DIR,
      getRemoveDirForm(),
    );

    if (isRemove === true) {
      safeRemoveDirSync({
        targetPath: projectNamePath,
        parentDir: path.dirname(projectNamePath),
        label: "同名项目目录",
      });
    } else {
      outputConsole.error(`项目${projectName}已存在`);
      return process.exit(1);
    }
  }

  const templateSource = await resolveTemplateSourceInfo({ argv });
  const parentGitDir = lookForParentTarget(".git");
  outputConsole.stage("正在初始化项目，请稍等...");
  materializeTemplateToProject({
    templateSource,
    rootDir: safeCwd(),
    targetPath: projectNamePath,
  });
  outputConsole.stage(`模板已生成: ${projectName}`);

  const configPath = MODULE_DEFAULT_CONFIG_RELATIVE_PATH;

  const configPathFinal = getConfigPath({
    rootDir: projectNamePath,
    configPath,
  });

  if (configPathFinal) {
    outputConsole.stage(`当前模板项目配置了预设问题`);

    if (argv.skipTemplateCompile) {
      outputConsole.stage(`用户设置:跳过模板编译`);
    } else {
      outputConsole.stage(`开始进行模板编译`);
      await batchCompileHandler({
        rootDir: projectNamePath,
        configPath,
        extraEnvData: {
          $projectName: projectName,
        },
      });
      rmSync(configPathFinal, { force: true });
      outputConsole.stage("模板项目配置编译成功, 编译配置文件已删除");
    }
  }

  if (!argv.openGitDetailOptimize) {
    outputConsole.stage(`跳过git细节优化`);
    return process.exit(0);
  }

  outputConsole.stage("项目初始化完成");

  await rmGitCtrlAsync(projectNamePath);
  if (parentGitDir) {
    outputConsole.stage(
      `项目创建在父级git仓库${parentGitDir}中，已跳过${projectName}目录git初始化`,
    );
  } else {
    execSyncHijack(`git init`, {
      cwd: projectNamePath,
      stdio: "inherit",
    });
  }

  const gitCommitMessage = await getAnswerSwift<string>(
    FormNameEnum.GIT_COMMIT_MESSAGE,
    getGitCommitMessageForm(projectName),
  );

  execSyncHijack(`git add . && git commit -m '${gitCommitMessage}'`, {
    cwd: projectNamePath,
    stdio: "inherit",
  });

  outputConsole.success(`项目${projectName}初始化完成`);

  outputConsole.info(`
使用步骤: 
  1. cd ${projectName}
  2. pnpm install
  3. pnpm run dev
  `);
};

/** 将 JSON 字符串解析为对象，失败或非对象时抛出明确错误 */
const parseEnvJsonObject = (
  raw: string,
  label: string,
): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} 解析失败(需为合法 JSON 对象): ${raw}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
};

/** 解析 CLI 非交互供答的 envData：--envFile 作底，--env 浅覆盖；都未给则返回 undefined */
const resolveCliEnvData = (
  argv: CliHandlerArgv<CreateOptions>,
): Record<string, unknown> | undefined => {
  if (!argv.envFile && !argv.env) {
    return undefined;
  }
  let result: Record<string, unknown> = {};
  if (argv.envFile) {
    const envFilePath = resolve(safeCwd(), argv.envFile);
    if (!existsSync(envFilePath)) {
      throw new Error(`模板预设答案文件不存在: ${envFilePath}`);
    }
    result = {
      ...result,
      ...parseEnvJsonObject(
        readFileSync(envFilePath, "utf-8"),
        `模板预设答案文件 ${envFilePath}`,
      ),
    };
  }
  if (argv.env) {
    result = {
      ...result,
      ...parseEnvJsonObject(argv.env, "--env"),
    };
  }
  return result;
};

const LIST_QUESTIONS_PROBE_PROJECT_NAME = "__list_questions_probe__";

/** --list-questions：打印模板预设问题清单(JSON)到 stdout，不创建项目、清理草稿 */
const listTemplateQuestions = async (
  argv: CliHandlerArgv<CreateOptions>,
  ctxInit?: HandlerContextInit,
) => {
  // 静默装饰性 stage 日志，保证 stdout 为纯 JSON
  updateEnvConfig({ consoleLog: false });
  try {
    // 仅查询问题清单，无需真实项目名；用合成名跑 prepare，结束后清理草稿
    const probeArgv: CliHandlerArgv<CreateOptions> = {
      ...argv,
      [FormNameEnum.PROJECT_NAME]:
        argv[FormNameEnum.PROJECT_NAME] ?? LIST_QUESTIONS_PROBE_PROJECT_NAME,
    };
    const prepareResult = await prepareCreateProject(probeArgv, ctxInit);
    const questions =
      prepareResult.status === "need_input" ? prepareResult.questions : [];
    const output = questions.map((question) => ({
      key: question.key,
      required: question.initial === undefined,
      ...(question.initial !== undefined ? { default: question.initial } : {}),
    }));

    // 清理 prepare 物化的草稿，避免残骸
    try {
      const rootDir = getCreateRootDir(probeArgv, ctxInit);
      safeRemoveDirSync({
        targetPath: getDraftDir(rootDir, prepareResult.draftId),
        parentDir: getDraftRootDir(rootDir),
        label: "create --list-questions 草稿目录",
      });
    } catch (cleanupError) {
      // 清理失败不阻塞清单输出
    }

    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output;
  } catch (error) {
    // console 已静默，错误直接写 stderr，保证可见且 stdout 不被污染
    process.stderr.write(
      `获取模板预设问题失败: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return process.exit(1);
  }
};

/** create 命令 handler：交互模式保持原 CLI 流程，非交互模式走 prepare/complete 协议 */
export const handler = async (
  argv: CliHandlerArgv<CreateOptions>,
  ctxInit?: HandlerContextInit,
) => {
  const ctx = resolveHandlerContext(ctxInit);
  if (ctx.interactive) {
    return interactiveCreateHandler(argv);
  }

  if (argv.listQuestions) {
    return listTemplateQuestions(argv, ctx);
  }

  outputConsole.info(`版本: ${injectInfo.version}`);

  if (argv.justCloneFromDoneCoding) {
    throw new Error(`非交互模式暂不支持 justCloneFromDoneCoding`);
  }

  const envData = resolveCliEnvData(argv);
  const prepareResult = await prepareCreateProject(argv, ctx);

  // 非交互单发：prepare 后直接 complete，预设答案缺失由模板编译 fast-fail 兜底
  try {
    return await completeCreateProject(
      {
        ...argv,
        draftId: prepareResult.draftId,
        envData,
      },
      ctx,
    );
  } catch (error) {
    // 单发失败（如缺必填快速失败）：清理本次草稿，避免在项目下累积 tmp 残骸
    try {
      const rootDir = getCreateRootDir(argv, ctx);
      safeRemoveDirSync({
        targetPath: getDraftDir(rootDir, prepareResult.draftId),
        parentDir: getDraftRootDir(rootDir),
        label: "create 非交互失败草稿目录",
      });
    } catch (cleanupError) {
      // 清理失败不阻塞错误传播
    }
    throw error;
  }
};

/** create 子命令配置 */
export const commandCliInfo: SubCliInfo = {
  command: `$0`,
  describe: injectInfo.description,
  options: getOptions(),
  handler,
};
