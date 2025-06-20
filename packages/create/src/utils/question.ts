import { log, readCliConfig, type PromptObject } from "@done-coding/cli-utils";
import { CUSTOM_TEMPLATE_NAME, SOMEONE_PUBLIC_REPO_NAME } from "./const";
import type { CreateConfigJson, CreateTemplateChoiceItem } from "@/types";
import injectInfo from "@/injectInfo.json";

let templateList: CreateTemplateChoiceItem[];

/** 获取模版选项 */
export const getTemplateList = async () => {
  if (!templateList) {
    const config = await readCliConfig<CreateConfigJson>({
      moduleName: injectInfo.cliConfig.moduleName,
      onSuccess({ config, cliConfigFileRelativePath, repoUrl }) {
        if (!Array.isArray(config.templateList)) {
          const errorMsg = `远程配置文件出错, templateList 不是数组, 请检查 ${repoUrl} ${cliConfigFileRelativePath}`;
          throw new Error(errorMsg);
        }
        log.success(`模板列表拉取成功！`);
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

export const projectNameForm: PromptObject<string> = {
  type: "text",
  name: "projectName",
  message: "请输入项目名称",
  format: (value) => value.trim(),
  validate: (value) => value.length > 0 || "项目名称不能为空",
};

export const getTemplateForm: () => Promise<
  PromptObject<string>
> = async () => {
  const templateChoices = await getTemplateChoices();
  return {
    type: "select",
    name: "template",
    message: "请选择模板",
    choices: templateChoices.map((item) => ({
      title: item.branch ? `${item.name}(${item.branch})` : item.name,
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

export const saveGitHistoryForm = {
  type: "confirm" as const,
  name: "saveGitHistory",
  message: "是否保留git历史",
  initial: false,
};

/*
export const shallowCloneForm = {
  type: "confirm" as const,
  name: "shallowClone",
  message: "是否使用浅克隆(后续期望与模板git仓库有完整的交互，请选择'N')",
};
*/

/** 获取删除目录的表单 */
export const getRemoveDirForm = (message = "项目已存在，是否删除") => ({
  type: "confirm" as const,
  name: "isRemove",
  message,
});

/** 自定义模板路径表单 */
export const customUrlForm: PromptObject<string> = {
  type: "text",
  name: "customUrl",
  message: "请输入自定义模板路径",
  validate: (value) => value.trim().length > 0 || "路径不能为空",
};

/** 获取git提交信息表单 */
export const getGitCommitMessageForm: (
  projectName: string,
) => PromptObject<string> = (projectName) => {
  return {
    type: "text",
    name: "gitCommitMessage",
    message: "请输入git提交信息",
    initial: `feat: 初始化项目${projectName}`,
    validate: (value) => value.trim().length > 0 || "提交信息不能为空",
  };
};
