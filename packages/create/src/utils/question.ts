import {
  chalk,
  outputConsole,
  readCliModuleAssetsConfig,
  type PromptObject,
} from "@done-coding/cli-utils";
import { CUSTOM_TEMPLATE_NAME, SOMEONE_PUBLIC_REPO_NAME } from "./const";
import type {
  CreateConfigJson,
  CreateTemplateBranchInfo,
  CreateTemplateChoiceItem,
} from "@/types";
import injectInfo from "@/injectInfo.json";
import { FormNameEnum } from "@/types";

let templateList: CreateTemplateChoiceItem[];

/** 获取模版选项 */
export const getTemplateList = async () => {
  if (!templateList) {
    const config = await readCliModuleAssetsConfig<CreateConfigJson>({
      moduleName: injectInfo.cliConfig.moduleName,
      onSuccess({ config, moduleEntryFileRelativePath, repoUrl }) {
        if (!Array.isArray(config.templateList)) {
          const errorMsg = `配置文件出错, templateList 不是数组, 请检查 ${repoUrl} ${moduleEntryFileRelativePath}`;
          throw new Error(errorMsg);
        }
        outputConsole.success(`模板列表拉取成功！`);
      },
    });
    templateList = config.templateList;
  }
  return templateList;
};

/** 模版选项 */
export const getTemplateChoices = async () => {
  const templateList = await getTemplateList();
  return [
    ...templateList,
    { name: CUSTOM_TEMPLATE_NAME },
    { name: SOMEONE_PUBLIC_REPO_NAME },
  ];
};

export const projectNameForm: PromptObject<FormNameEnum.PROJECT_NAME> = {
  type: "text",
  name: FormNameEnum.PROJECT_NAME,
  message: "请输入项目名称",
  format: (value) => value.trim(),
  validate: (value) => value.length > 0 || "项目名称不能为空",
};

/** 获取模板标题 */
export const getTemplateTitle = ({
  name,
  branch,
}: CreateTemplateChoiceItem) => {
  const branchConfigType = typeof branch;
  if (branchConfigType === "string") {
    return `${name}(${chalk.white(branch)})`;
  } else {
    return `${name}(${
      Array.isArray(branch) && branch.length
        ? chalk.greenBright(`${branch.length}个细分分支`)
        : chalk.white(`默认分支`)
    })`;
  }
};

export const getTemplateForm: () => Promise<
  PromptObject<FormNameEnum.TEMPLATE>
> = async () => {
  const templateChoices = await getTemplateChoices();
  return {
    type: "select",
    name: FormNameEnum.TEMPLATE,
    message: "请选择模板",
    choices: templateChoices.map((item) => ({
      title: getTemplateTitle(item),
      value: item.name,
      description:
        `${item.description || ""}${
          item.instances?.length
            ? `, 已应用于: ${[""].concat(item.instances).join("\n- ")}`
            : ""
        }` || undefined,
    })),
    validate: (value) => value.trim().length > 0 || "模板不能为空",
  };
};

export const saveGitHistoryForm: PromptObject<FormNameEnum.IS_SAVE_GIT_HISTORY> =
  {
    type: "confirm",
    name: FormNameEnum.IS_SAVE_GIT_HISTORY,
    message: "是否保存模板仓库git历史记录",
    initial: false,
  };

export const transHttp2SshUrlForm = ({
  httpUrl,
  sshUrl,
}: {
  httpUrl: string;
  sshUrl: string;
}): PromptObject<FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL> => {
  return {
    type: "confirm",
    name: FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL,
    message: `是否将模板仓库地址由http形式(${httpUrl})转换为ssh形式(${sshUrl})`,
    initial: false,
  };
};

/*
export const shallowCloneForm: PromptObject<FormNameEnum.IS_SHALLOW_CLONE> = {
  type: "confirm" as const,
  name: FormNameEnum.IS_SHALLOW_CLONE,
  message: "是否使用浅克隆(后续期望与模板git仓库有完整的交互，请选择'N')",
};
*/

/** 获取删除目录的表单 */
export const getRemoveDirForm = (
  message = "项目已存在，是否删除",
): PromptObject<FormNameEnum.IS_REMOVE_SAME_NAME_DIR> => ({
  type: "confirm",
  name: FormNameEnum.IS_REMOVE_SAME_NAME_DIR,
  message,
});

/** 自定义模板路径表单 */
export const customUrlForm: PromptObject<FormNameEnum.CUSTOM_GIT_URL_INPUT> = {
  type: "text",
  name: FormNameEnum.CUSTOM_GIT_URL_INPUT,
  message: "请输入自定义模板路径",
  validate: (value) => value.trim().length > 0 || "路径不能为空",
};

/** 获取git提交信息表单 */
export const getGitCommitMessageForm: (
  projectName: string,
) => PromptObject<FormNameEnum.GIT_COMMIT_MESSAGE> = (projectName) => {
  return {
    type: "text",
    name: FormNameEnum.GIT_COMMIT_MESSAGE,
    message: "请输入git提交信息",
    initial: `feat: 初始化项目${projectName}`,
    validate: (value) => value.trim().length > 0 || "提交信息不能为空",
  };
};

/** 是否更改分支名-当指定模板分支时(即本地是否需要重命名分支名) */
export const getIsChangeBranchName = (
  templateBranch: string,
): PromptObject<FormNameEnum.IS_CHANGE_BRANCH_NAME> => {
  return {
    type: "confirm",
    name: FormNameEnum.IS_CHANGE_BRANCH_NAME,
    message: `是否要重命名指定克隆分支名(${templateBranch})在本地的分支名`,
    initial: true,
  };
};

/** （如果要改分支名）本地分支名 */
export const localBranchNameForm: PromptObject<FormNameEnum.LOCAL_BRANCH_NAME> =
  {
    type: "text",
    name: FormNameEnum.LOCAL_BRANCH_NAME,
    message: "请输入克隆到本地后的分支名",
    initial: "master",
    validate: (value) => value?.trim().length > 0 || "分支名不能为空", // ✅ 添加验证
  };

/** 获取模板项目git分支 */
export const getTemplateGitBranchForm = (
  branchList: CreateTemplateBranchInfo[],
): PromptObject<FormNameEnum.TEMPLATE_GIT_BRANCH> => {
  return {
    type: "select",
    name: FormNameEnum.TEMPLATE_GIT_BRANCH,
    message: "请选择模板分支",
    choices: branchList.map((item) => {
      return {
        title: item.name,
        value: item.name,
        description: item.description,
      };
    }),
  };
};
