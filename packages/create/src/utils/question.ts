import type { PromptObject } from "prompts";
import { CUSTOM_TEMPLATE_NAME } from "./const";
import { readConfig } from "./readConfig";

/** 模版选项 */
export interface TemplateChoiceItem {
  name: string;
  url?: string;
}

let templateList: TemplateChoiceItem[];

/** 获取模版选项 */
export const getTemplateList = () => {
  if (!templateList) {
    const config = readConfig();
    templateList = config.templateList;
  }
  return templateList;
};

/** 模版选项 */
export const templateChoices: TemplateChoiceItem[] = [
  ...getTemplateList(),
  { name: CUSTOM_TEMPLATE_NAME },
];

export const projectNameForm: PromptObject<string> = {
  type: "text",
  name: "projectName",
  message: "请输入项目名称",
  validate: (value) => value.trim().length > 0 || "项目名称不能为空",
};

export const templateForm: PromptObject<string> = {
  type: "select",
  name: "template",
  message: "请选择模板",
  choices: templateChoices.map((item) => ({
    title: item.name,
    value: item.name,
  })),
};

export const saveGitHistoryForm = {
  type: "confirm" as const,
  name: "saveGitHistory",
  message: "是否保留git历史",
};
