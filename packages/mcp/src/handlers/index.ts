/** create MCP tools / resources / prompts 注册方法导出 */
export {
  registerCreateTools,
  registerCreateResources,
  registerCreatePrompts,
  buildCreateProjectPromptText,
  LOCAL_POINTER_CONFIG_DISPLAY_PATH,
  prepareInputSchema,
  CREATE_TEMPLATE_LIST_RESOURCE_URI_TEMPLATE,
} from "./create";

/** dc-generator（cli-generator）MCP tools / prompt 注册方法导出（P3） */
export {
  registerGeneratorTools,
  registerGeneratorPrompts,
  buildGeneratePromptText,
  listBatchesInputSchema,
  listQuestionsInputSchema,
  addInputSchema,
  removeInputSchema,
  initInputSchema,
} from "./generator";
