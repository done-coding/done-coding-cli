import type { PromptObject } from "prompts";
import { CUSTOM_TEMPLATE_NAME, SOMEONE_PUBLIC_REPO_NAME } from "./const";
import { readConfig } from "./readConfig";

/** 模版选项 */
export interface TemplateChoiceItem {
  name: string;
  url?: string;
}

let templateList: TemplateChoiceItem[];

/** 获取模版选项 */
export const getTemplateList = async () => {
  if (!templateList) {
    const config = await readConfig();
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
  validate: (value) => value.trim().length > 0 || "项目名称不能为空",
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
      title: item.name,
      value: item.name,
    })),
  };
};

export const saveGitHistoryForm = {
  type: "confirm" as const,
  name: "saveGitHistory",
  message: "是否保留git历史",
  initial: false,
};

export const shallowCloneForm = {
  type: "confirm" as const,
  name: "shallowClone",
  message: "是否使用浅克隆(后续期望与模板git仓库有完整的交互，请选择'N')",
};

/** 获取删除目录的表单 */
export const getRemoveDirForm = (message = "项目已存在，是否删除") => ({
  type: "confirm" as const,
  name: "isRemove",
  message,
});
