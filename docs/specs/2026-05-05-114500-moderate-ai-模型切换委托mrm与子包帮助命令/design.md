---
任务等级: Moderate
日期: 2026-05-05
审核状态: 已通过
reviewer: PM + 老板（按老板要求亲自审核设计）
---

# 技术设计文档：AI 模型切换委托 mrm + 子包帮助命令

## 变更范围

| 类别 | 文件 |
|------|------|
| **Direct Targets** | `packages/ai/package.json`（新增 8 个子包依赖）、`packages/ai/src/handlers/chat.ts`（重写模型切换 + /xxx 帮助）、`packages/ai/src/services/model-presets.ts`（删除）、`packages/mrm/src/index.ts`（新增导出）、`packages/mrm/src/services/registry.ts`（新增 setProviderApiKey）、`packages/mrm/src/types/index.ts`（新增 ClientOptions）、`packages/mrm/src/handlers/*.ts`（7 个命令新增 --client） |
| **Collateral Reads** | `packages/mrm/src/services/registry.ts`、`packages/mrm/src/services/presets.ts`、`packages/mrm/src/types/index.ts` |
| **Out-of-Scope** | cli 路由子包不改动、其他子包不改动 |

## 关键技术点

### 1. mrm 依赖与 exports

ai 新增 8 个子包依赖（版本与 cli 包对齐）：
- `@done-coding/cli-mrm: workspace:0.0.2`
- `@done-coding/cli-component: workspace:0.5.2`
- `@done-coding/cli-config: workspace:0.2.2`
- `@done-coding/cli-extract: workspace:0.2.2`
- `@done-coding/cli-inject: workspace:0.6.2`
- `@done-coding/cli-publish: workspace:0.8.2`
- `@done-coding/cli-template: workspace:0.9.2`
- `create-done-coding: workspace:0.12.2`

mrm 通过 `src/index.ts` 统一导出以下函数供 ai import：
- `switchModel`、`switchProvider`、`getProviders`、`findProvider`、`setProviderApiKey`、`readRegistry`、`writeClientConfig` 等
- ai 从 `@done-coding/cli-mrm` 主入口 import，无需 subpath exports。

### 2. /provider 委托 mrm

```
用户输入 /provider
  → 读取 mrm registry（新 registry 则自动初始化）
  → 过滤出 OPENAI 协议的服务商
  → xPrompts select 让用户选 alias
  → 调 mrm switchProvider(ClientName.DONE_CODING_AI, alias) 更新 registry
  → 调 mrm writeClientConfig(ClientName.DONE_CODING_AI, state) 写 config
  → ai 读 config，若 apiKey 为空 → xPrompts 输入 → 调 mrm setProviderApiKey(protocol, alias, key) → 再调 writeClientConfig
```

### 3. /model 委托 mrm

```
用户输入 /model
  → 从 registry 获取当前 provider 的 models
  → xPrompts select 让用户选 modelName
  → 调 mrm switchModel(ClientName.DONE_CODING_AI, modelName) 更新 registry
  → 调 mrm writeClientConfig(ClientName.DONE_CODING_AI, state) 写 config
  → ai 读 config，若 apiKey 为空 → xPrompts 输入 → 调 mrm setProviderApiKey(protocol, alias, key) → 再调 writeClientConfig
```

### 4. apiKey 管理策略

**原则：ai 包只读 config，所有写入通过 mrm 导出方法。**

**新增 mrm 方法：**
```typescript
// mrm/src/services/registry.ts
export function setProviderApiKey(
  protocol: Protocol,
  alias: string,
  apiKey: string
): void
```
直接更新 registry 中指定 provider 的 apiKey，不触发其他副作用。

**ai 侧处理：** 切换 provider/model 后读 config → apiKey 为空 → xPrompts → `setProviderApiKey()` → `writeClientConfig()` → 完成。

### 5. /xxx 子包帮助

维护映射表，`/<moduleName>` → execSync 执行 `<bin> --help`：

| moduleName | bin |
|------------|-----|
| mrm | dc-mrm |
| component | dc-component |
| config | dc-config |
| create | create-done-coding |
| extract | dc-extract |
| inject | dc-inject |
| publish | dc-publish |
| template | dc-template |

**输出格式：**

```
[黄色] 当前相关cli未完全ai工具化，敬请期待。
[青色] 以下是其版本及使用帮助：

[绿色] 版本: 0.1.3

[默认色] <bin --help 原始输出>
```

**bin 查找策略：** 从 `process.cwd()` 向上遍历目录树，查找 `node_modules/.bin/<bin>`，找到后使用绝对路径执行 `--version` 和 `--help`。

**颜色方案：**
- 提示语：`chalk.yellow`
- 副标题：`chalk.cyan`
- 版本号：`chalk.green`
- 帮助文本：`process.stdout.write`（默认色，保持原始格式）

**未知 `/xxx`：** 不在映射表中的 `/` 开头输入 → `handleSubpackageHelp` 返回 false → 不 `continue`，走入 AI 对话逻辑。

### 6. 首次使用流程

首次使用无 AI_CONFIG 时：
- 使用 mrm registry 列出 OPENAI 协议服务商 → 用户选择
- 列出该服务商模型 → 用户选择
- 输入 apiKey
- 写 config
- 不再需要旧的 `model-presets.ts`

### 7. 删除 model-presets.ts

该文件不再被引用，直接删除。

### 8. mrm CLI 新增 --client 选项

**范围：** ls / model use / provider use / provider add / provider remove / model add / model remove（switch 保持 `<client>` 位置参数，不改动）

**类型定义：**
```typescript
// mrm/src/types/index.ts 新增
export interface ClientOptions {
  client?: ClientName;
}
```

**实现方式：** 每个受影响的 handler 新增 `--client` option（string 类型），解析时校验合法值 `claude-code | done-coding-ai`。

**行为规则：**
- 不传 `--client` → 使用 `getCurrentClient()`（现有行为）
- 传了 `--client` → 本次操作临时切换 `switchClient(client)` 后执行，完成后不恢复（直接留在目标 client）

**简化说明：** 由于操作直接走底层函数（传 clientName），实际只需：传了 --client 则用它，否则用 currentClient。不需要真正切换 currentClient。

**影响文件：**
- `packages/mrm/src/types/index.ts` — 新增 ClientOptions
- `packages/mrm/src/handlers/ls.ts` — 新增 --client option + 透传 clientName
- `packages/mrm/src/handlers/model-use.ts` — 新增 --client option + 透传 clientName
- `packages/mrm/src/handlers/provider-use.ts` — 新增 --client option + 透传 clientName
- `packages/mrm/src/handlers/provider-add.ts` — 新增 --client option + 透传 clientName
- `packages/mrm/src/handlers/provider-remove.ts` — 新增 --client option + 透传 clientName
- `packages/mrm/src/handlers/model-add.ts` — 新增 --client option + 透传 clientName
- `packages/mrm/src/handlers/model-remove.ts` — 新增 --client option + 透传 clientName

## 开发范式 / 参考模块

- 现有的 `/exit`、`/clear` 处理逻辑保持不变，仅在其旁边追加 `/provider`、`/model`、`/xxx` 分支
- xPrompts 交互模式参考现有 `selectModelForProvider()` 的写法
- execSync 用法参考 cli 包 `main.ts` 中的 `execSyncHijack`
- config 读写复用现有 `readGlobalConfig()` / `writeGlobalConfig()`

## 注意事项 / 已知风险

| 风险 | 应对 |
|------|------|
| mrm registry 不存在（首次使用） | mrm 的 `readRegistry()` 自动生成默认 registry |
| execSync 执行 help 超时或失败 | catch 后输出"命令不可用" |
| /xxx 输入不在映射表中 | 返回 false → 不 continue → 发给 AI |
| 切换 provider 后 apiKey 为空 | 检测后 xPrompts 提示输入 |
