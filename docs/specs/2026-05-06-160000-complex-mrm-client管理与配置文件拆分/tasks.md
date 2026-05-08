---
任务等级: Complex
日期: 2026-05-07
审核状态: 待执行
---

# 任务清单：mrm Client 管理与配置文件拆分

## TASK-1: utils 包 — 路径常量 + AI 配置读写方法

- [ ] 1. `packages/utils/src/const.ts`：新增 `DONE_CODING_AI_CONFIG_RELATIVE_PATH`（`.done-coding/ai/config.json`）、`DONE_CODING_MRM_CONFIG_RELATIVE_DIR`（`.done-coding/mrm`）
- [ ] 2. `packages/utils/src/cli-config.ts`：AiConfig 的 model/apiKey/baseUrl 改为 optional；新增 `getAiConfigFilePath()`、`getMrmConfigDirPath()`、`readAiConfig()`、`writeAiConfig()`、`checkLegacyAiConfig()`；DoneCodingCliGlobalConfigKeyEnum 移除 AI_CONFIG；DoneCodingCliGlobalConfig 移除 AI_CONFIG 字段
- [ ] 3. `pnpm build --filter @done-coding/cli-utils`

## TASK-2: mrm 类型定义更新

- [ ] 1. `packages/mrm/src/types/index.ts`：Client.name 改为 `string`（保留 ClientName 枚举）；Client 新增 `builtin: boolean` 字段；SubcommandEnum 新增 `CLIENT_ADD`/`CLIENT_REMOVE`/`CLIENT_FOCUS`；Registry 新增 `clients: Client[]` 字段；新增 ClientAddOptions/ClientRemoveOptions/ClientFocusOptions 等 options 接口

## TASK-3: mrm presets + client-config 更新

- [ ] 1. `packages/mrm/src/services/presets.ts`：BUILTIN_CLIENTS 各元素加 `builtin: true`；done-coding-ai 的 configPath 更新为 `ai/config.json`；getClientProtocol 改为调用 resolveClientProtocol
- [ ] 2. `packages/mrm/src/services/client-config.ts`：writeClientConfig 使用 getAllClients + resolveClientProtocol 替代 BUILTIN_CLIENTS 硬编码；writeDoneCodingAiConfig 写入路径改为 `~/.done-coding/ai/config.json`，增加 protocol 字段写入；新增 writeGenericConfig 处理用户自定义 client；DoneCodingAiGlobalConfig 类型不再使用（AI 配置结构扁平化）

## TASK-4: mrm registry.ts 重写为目录结构

- [ ] 1. 新增文件路径辅助函数：`clientsPath()` / `registryPath()` / `providerPath(protocol)`
- [ ] 2. 新增文件级读写：`readClientsFile/writeClientsFile`、`readRegistryFile/writeRegistryFile`、`readProvidersFile/writeProvidersFile`
- [ ] 3. 重写 `readRegistry()`：合并内置 + 自定义 client，补齐缺失状态和 provider，动态检测 done-coding-ai 协议
- [ ] 4. 重写 `writeRegistry()`：分文件持久化（clients.json 仅写自定义、registry.json、providers/<proto>.json）
- [ ] 5. 新增 `resolveClientProtocol()`：done-coding-ai 从 ai/config.json 动态读取协议（sync），其他 client 从 client 定义取
- [ ] 6. 新增 `getAllClients()`、`addClient()`、`removeClient()`、`focusClient()`、`getDefaultStateForClient()`
- [ ] 7. 更新 `getCurrentProtocol()`、`switchClient()`、`switchProvider()`、`removeProvider()`、`switchModel()` 使用新 API（resolveClientProtocol / getAllClients）

## TASK-5a: mrm 新增 client 管理 handlers

- [ ] 1. `packages/mrm/src/handlers/client-add.ts`（新文件）：命令 `"client add <name> <protocol> <configPath>"`，校验 name kebab-case + protocol 合法 + 去重，调用 addClient
- [ ] 2. `packages/mrm/src/handlers/client-remove.ts`（新文件）：命令 `"client remove <name>"`，校验非内置 + promptConfirm 确认，调用 removeClient
- [ ] 3. `packages/mrm/src/handlers/client-focus.ts`（新文件）：命令 `"client focus <name>"`，调用 focusClient，输出当前状态行

## TASK-5b: mrm 现有 handlers 集成更新

- [ ] 1. `packages/mrm/src/handlers/index.ts`：import 三个新 handler；handler() switch-case 新增 CLIENT_ADD/CLIENT_REMOVE/CLIENT_FOCUS；subcommands 数组注册三个新 commandCliInfo
- [ ] 2. `packages/mrm/src/handlers/switch.ts`：校验从 `Object.values(ClientName)` 改为 `getAllClients()` 动态列表
- [ ] 3. `packages/mrm/src/handlers/ls.ts`：--client choices 移除硬编码，handler 中用 getAllClients/resolveClientProtocol 替代 BUILTIN_CLIENTS/getClientProtocol

## TASK-6: mrm 导出 + ai 包配置路径适配

- [ ] 1. `packages/mrm/src/index.ts`：新增导出 `getAllClients`、`resolveClientProtocol`、`addClient`、`removeClient`、`focusClient`
- [ ] 2. `packages/ai/src/handlers/chat.ts`：移除本地 `readGlobalConfig`/`writeGlobalConfig` 函数；将所有 `readGlobalConfig()` + `config[AI_CONFIG]` 替换为 `readAiConfig()`；将所有 `config[AI_CONFIG] = ...` + `writeGlobalConfig(config)` 替换为 `writeAiConfig(...)`；移除 `DoneCodingCliGlobalConfig`/`DoneCodingCliGlobalConfigKeyEnum`/`getGlobalConfigFilePath` 的 import
- [ ] 3. `pnpm build --filter @done-coding/cli-ai --filter @done-coding/cli-mrm`

## 验证

- [ ] 删除 `~/.done-coding/mrm/` 后运行 `dc-mrm ls` → 自动创建完整目录结构
- [ ] `dc-mrm client add test-client openai /tmp/test-config.json` → 创建成功，输出配置信息
- [ ] `dc-mrm client remove test-client` → 交互确认后删除成功
- [ ] `dc-mrm client remove claude-code` → 报错"不能删除内置 client: claude-code"
- [ ] `dc-mrm client focus done-coding-ai` → 切换到 done-coding-ai 并恢复其状态
- [ ] `dc-mrm switch done-coding-ai` → 作为 focus 的别名正常工作
- [ ] 检查 `~/.done-coding/config.json` 不含 AI_CONFIG
- [ ] 检查 `~/.done-coding/ai/config.json` 独立存在
- [ ] 检查 `~/.done-coding/mrm/` 目录结构完整（clients.json + registry.json + providers/）
- [ ] ai 包 `/protocol` 切换到 anthropic → `dc-mrm ls` 列出 anthropic 协议 provider
- [ ] ai 包 `/protocol` 切换到 openai → `dc-mrm ls` 列出 openai 协议 provider
