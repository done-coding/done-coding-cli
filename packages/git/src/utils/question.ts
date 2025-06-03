import type { PromptObject } from "@done-coding/cli-utils";
import { GitPlatformEnum } from "./types";

/** git平台选择 */
const gitPlatformChoices = [
  { title: "GitHub", value: GitPlatformEnum.GITHUB },
  { title: "Gitee", value: GitPlatformEnum.GITEE },
];

/** git平台选择表单 */
export const platformForm: PromptObject<string> = {
  type: "select",
  name: "platform",
  message: "选择git平台",
  choices: gitPlatformChoices,
};

/** git用户名表单 */
export const gitUsernameForm: PromptObject<string> = {
  type: "text",
  name: "username",
  message: "请输入用户名",
  format: (value) => value.trim(),
  validate: (value) => value.length > 0 || "用户名不能为空",
};

/** git access token表单 */
export const gitAccessTokenForm: PromptObject<string> = {
  type: "password",
  name: "accessToken",
  message: "请输入git access token",
  format: (value) => value.trim(),
  validate: (value) => value.length > 0 || "access token不能为空",
};
