---
任务等级: Moderate
日期: 2026-08-09
审核状态: 已确认（需求方 + AI）
---

# 技术设计文档：cc-switch 配置单源化 + 启动前输出 + 静默选项

## 变更范围

| 类别 | 文件 |
|------|------|
| **Direct Targets** | `packages/cc-switch/src/types/index.ts`（嵌套 Settings 类型；ProfileConfig 增可选字段）、`packages/cc-switch/src/utils/path.ts`（SETTINGS_PATH；删 PROVIDER_PATH/MODEL_PATH）、`packages/cc-switch/src/utils/config.ts`（源侧重写：loadSettings / composeEnv / buildProfileConfig / generate / mutate / list / starter）、`packages/cc-switch/src/utils/meta.ts`（`--meta-silent` 常量 + 白名单 + 帮助文案）、`packages/cc-switch/src/handlers/profile.ts`（parseArgv 增 silent 字段）、`packages/cc-switch/src/handlers/index.ts`（解析分支默认可选 + 无默认 pick + spawn 前输出 + silent 压制）、`packages/cc-switch/src/cli.ts`（builder 增 `--meta-silent`）、`packages/cc-switch/src/__tests__/*`（config/generate/mutate/run-router/parse-argv/meta 等） |
| **Collateral Reads** | `packages/cc-switch/src/utils/env-guard.ts`（`SETTINGS_PATH` 为 Claude 的 settings.json，只确认不冲突、不改）、`docs/specs/2026-06-19-*`、`docs/specs/2026-06-24-*` |
| **Out-of-Scope** | provider.json/model.json 迁移工具（不做，消费方=1）、发布动作（需另行授权）、其他包、env-guard 层 2 逻辑 |

## 关键技术点

### 1. settings.json 结构与校验

```
~/.done-coding/cc-switch/settings.json（chmod 600）
{
  defaultProfile?: string,             // 可选 → 无默认 → pick
  disabledDefault?: boolean,           // true → 忽略已配默认，强制 pick
  output?: { profileName?: boolean },  // 缺省 true；false → 不输出
  providers: {
    [id]: {
      name: string, url: string, apiKey: string,
      envExtraParams?: Record<string,string>,      // provider 级附加 env
      models: [{ id, name, envExtraParams? }]      // 模型必填 id+name
    }
  }
}
```

- 新增 `loadSettings()`（仅 `--meta-generate` / mutate / list 读源，运行时只读 profile.json，不读 settings）：文件缺失 → fail-loud 提示创建 settings.json（与 `readStrictJson` 一致，[MUST NOT] 用默认值静默生成）；存在 → JSON.parse + 结构校验，非法 fail-loud（携带绝对路径 + 原因，[MUST NOT] 覆盖/自愈）。「纯新装写 starter」由 `loadOrInitConfig` 在无任何文件时触发，与读源路径分离。
- 校验规则沿用 `readStrictJson` / `parseEnvExtraParams` 的 fail-loud 风格；`models` 非空、`(provider,id)` 不重复、provider 引用天然内聚（模型在 provider 内部，跨文件引用错误面消失）。
- **命名冲突注明**：本文件是 `~/.done-coding/cc-switch/settings.json`；`env-guard.SETTINGS_PATH` 是 `~/.claude/settings.json`，同名不同物，代码注释点明。

### 2. 编译管线（settings → profile.json）

```
loadSettings() → buildProfileConfig(settings) → writeConfig(profile.json)
```

- profile 名 = `${providerId}-${model.id}`，保插入顺序。
- env 合并序不变：`通用(provider.url/apiKey + model.name 推导的 BASE_URL/AUTH_TOKEN/MODEL/四档/SUBAGENT) ← provider.envExtraParams ← model.envExtraParams`（现 `composeEnv` 逻辑复用，输入从扁平对象换嵌套遍历）。
- `defaultProfile` 有则须落在生成的 profile 中（否则 fail-loud）；无则跳过该校验（可选语义）。
- profile.json 运行时形态不变（`{ defaultProfile?, profiles }`），`loadOrInitConfig` 主路径仅放宽 defaultProfile 可选。

### 3. 启动解析顺序（runRouter run 路径）

```
if (action === "pick")                      resolvedName = await pickProfile(cfg)
else if (profileName)                       resolvedName = profileName
else if (cfg.disabledDefault)               resolvedName = await pickProfile(cfg)
else if (cfg.defaultProfile)                resolvedName = cfg.defaultProfile
else                                        resolvedName = await pickProfile(cfg)  // 无默认
```

- `--meta-pick` 与 `--meta-profile` 并存沿用既有 action 优先级（pick 高，mergeAction 不变）。
- 显式 `--meta-profile` 优先于 `disabledDefault`（显式 > 配置禁默认）。
- pick 均走现有 `pickProfile`（TTY 弹选择器；非 TTY → stderr 提示 `--meta-profile` + exit(1)）。

### 4. 启动前输出 + `--meta-silent`

- 插入点：层 2 env-guard 通过后、`buildChildEnv`/`spawn` 前（守卫失败不输出）。
- 条件：`!silent && cfg.output?.profileName !== false` → `process.stdout.write(name + "\n")`。
- `--meta-silent` 优先级高于配置（MCP 调用无需改配置）。
- parseArgv 新增 `silent` 字段（消费 `--meta-silent`，不入 passthrough）；`isUnknownMetaOption` 白名单 + `--meta-help` 文案 + `cli.ts` builder 同步声明。

### 5. mutate / list 命令落点

- `--meta-apiKey=` / `--meta-model-name=` / `--meta-provider=`：读 settings.json → 改（provider.apiKey / providers[id].models push）→ 写 settings.json（600）→ 自动重编译 profile.json。
- `--meta-provider-list`：`Object.keys(providers)` → `id（name）`；`--meta-model-list`：遍历 providers→models → `name（provider）`（同模型多 provider 各一行）。均不含 apiKey。

### 6. 新装 / 迁移策略

- `loadOrInitConfig` 新逻辑：
  1. profile.json 存在 → 读 + 校验（defaultProfile 放宽可选）→ 用（运行时主路径不变）。
  2. profile.json 缺失 + settings.json 存在 → fail-loud 提示运行 `--meta-generate`。
  3. 两者皆无 → 写 starter settings.json（deepseek 源形态：provider.deepseek + flash/pro 两 model + defaultProfile）→ 编译 profile.json。
- 存量 provider.json / model.json 不读不迁；settings.json 缺失时 `--meta-generate`/mutate 直接 fail-loud 指向 settings.json。

### 7. 类型设计

```typescript
interface SettingsModel { id: string; name: string; envExtraParams?: Record<string,string> }
interface SettingsProvider { name: string; url: string; apiKey: string;
  envExtraParams?: Record<string,string>; models: SettingsModel[] }
interface Settings { defaultProfile?: string; disabledDefault?: boolean;
  output?: { profileName?: boolean }; providers: Record<string, SettingsProvider> }
// ProfileConfig: defaultProfile?: string; disabledDefault?: boolean;
//   output?: { profileName?: boolean }; profiles: Record<string, Profile>
```

- 扁平 `Provider`/`Model`/`ProviderConfig`/`ModelConfig` 类型废弃（或重构成嵌套形态），按引用清理。

## 开发范式 / 参考模块

- `pickProfile` / `selectProvider`（utils/meta.ts）交互逻辑原样复用。
- `readStrictJson` / `parseEnvExtraParams` fail-loud 校验风格复用。
- `composeEnv` env 合并序复用（仅来源遍历变化）。
- 既有 `printMetaHelp` 帮助块追加 `--meta-silent` 行。

## 注意事项 / 已知风险

| 风险 | 应对 |
|------|------|
| 0.2.0 已发布，provider/model 格式废弃 | 消费方=1，一次性收敛；`--meta-generate`/mutate 缺 settings.json 时 fail-loud 指路 |
| settings.json 与 Claude 的 settings.json 同名 | 代码注释 + 帮助文案均写明完整路径区分 |
| 无默认 + 非 TTY（AI/MCP）触发 pick | pickProfile 现有逻辑报错提示 `--meta-profile`，不挂起 |
| profile.json 与 settings.json 漂移（改源未编译） | 同 0.2.0 语义：mutate 自动重编译；手改源需显式 `--meta-generate` |
| 启动前 echo 污染 MCP 上下文 | `--meta-silent`（本轮默认输出，MCP 调用方显式压制） |
