export { handler } from "@/handlers";
export { createAsSubcommand } from "./main";
export * from "@/types";
export {
  readRegistry,
  writeRegistry,
  getCurrentClient,
  getProviders,
  getCurrentProtocol,
  getCurrentState,
  switchClient,
  findProvider,
  addProvider,
  switchProvider,
  removeProvider,
  addModel,
  removeModel,
  switchModel,
  setProviderApiKey,
} from "@/services/registry";
export { writeClientConfig } from "@/services/client-config";
export {
  BUILTIN_CLIENTS,
  BUILTIN_PROVIDERS_BY_PROTOCOL,
  DEFAULT_CLIENT_STATE,
  getClientProtocol,
} from "@/services/presets";
