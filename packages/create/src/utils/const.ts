import injectInfo from "@/injectInfo.json";
/** 配置仓库地址 */
export const CONFIG_GIT_REPO = import.meta.env.VITE_CONFIG_GIT_REPO;

/** 自定义模板路径 */
export const CUSTOM_TEMPLATE_NAME = "自定义模版路径";

/** 某个公共仓库 */
export const SOMEONE_PUBLIC_REPO_NAME = "某个git平台用户仓库";

/** 临时目录 */
export const READ_CONFIG_TEMPORARY_DIRECTORY = `./.${injectInfo.name}_temp`;
