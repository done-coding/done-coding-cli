import injectInfo from "@/injectInfo.json";
export * from "@/handlers";
export { createAsSubcommand } from "./main";
export * from "@/types";
export {
  resolveTemplateConfigPath,
  readTemplateListFromFile,
  readTemplateListResource,
  getLocalPointerConfigPath,
  LOCAL_POINTER_CONFIG_RELATIVE_PATH,
} from "@/utils";
export type { CreateTemplateListResource } from "@/utils";
export { injectInfo };
