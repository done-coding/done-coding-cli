import injectInfo from "@/injectInfo.json";
export * from "@/handlers";
export { createAsSubcommand } from "./main";
export * from "@/types";
export {
  resolveTemplateConfigPath,
  readTemplateListFromFile,
  getLocalPointerConfigPath,
  LOCAL_POINTER_CONFIG_RELATIVE_PATH,
} from "@/utils";
export { injectInfo };
