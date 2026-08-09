# @done-coding/cli-cc-switch

```
模型路由
```

## 使用

```bash
npm install @done-coding/cli-cc-switch
```

安装后提供两个命令入口（指向同一 `es/cli.mjs`）：

- `dc-cc-switch` — 正式命令名
- `cc-router` — 兼容入口（迁移自 `@ccsuite/cli-router` 保留）

```bash
dc-cc-switch [command] [options]   # 正式
cc-router [command] [options]      # 兼容
```

除 `--meta-*` 外的所有参数**原样透传**给 claude。

## meta 选项（cc-switch 自身命令面，不透传）

| 选项 | 行为 |
| ---- | ---- |
| `--meta-profile=<name>` | 显式指定 profile 启动 |
| `--meta-pick` | 终端交互选择 profile 启动（需 TTY） |
| `--meta-generate` | 从 provider.json + model.json 重建 profile.json |
| `--meta-apiKey=<key>` | 更新指定提供商 apiKey（交互选提供商或 `--meta-provider`，自动重建） |
| `--meta-model-name=<name>` | 添加模型（交互选提供商或 `--meta-provider`，自动重建；id=去 `[1m]`、name+`[1m]`） |
| `--meta-provider=<id>` | 显式指定提供商（供 apiKey / model-name 跳过交互选择，非独立动作） |
| `--meta-provider-list` | 输出提供商列表（`id（name）`，不含 apiKey） |
| `--meta-model-list` | 输出模型列表（`name（provider）`，同模型多 provider 各一行） |
| `--meta-help` | 显示自身帮助 |
| `--meta-version` | 显示自身版本 |

优先级：`--meta-help` > `--meta-version` > `--meta-generate` > `--meta-model-list` > `--meta-provider-list` > `--meta-model-name` > `--meta-apiKey` > `--meta-pick` > `--meta-profile=`。

`--meta-apiKey` 与 `--meta-model-name` 互斥、均不得与 `--meta-generate` 同用；`--meta-provider` 仅随二者使用。

## 配置源（provider / model 分层）

profile.json 由两个 DRY 源经 `--meta-generate` 生成（启动不自动生成，保速度；profile 缺失或默认 profile 悬空时提示手动运行）：

- `~/.done-coding/cc-switch/provider.json` — 服务商层：`{ providers: { id: { name, url, apiKey, envExtraParams? } } }`
- `~/.done-coding/cc-switch/model.json` — 模型层：`{ defaultProfile, models: [{ provider, id, name, envExtraParams? }] }`

profile 名 = `${provider}-${id}`；每个 profile 的 env 按 `{...通用, ...providerEnvExtraParams, ...modelEnvExtraParams}` 合并（通用 = provider.url/apiKey + model.name 推导的 BASE_URL/AUTH_TOKEN/MODEL/四档/SUBAGENT）。例：pro 档让 haiku 用 flash，在该 model 的 `envExtraParams` 设 `ANTHROPIC_DEFAULT_HAIKU_MODEL`。

运行 `dc-cc-switch --meta-generate` 后生成 profile.json（保持原格式、chmod 600）。

<!-- repo-map:start -->

## 目录导航（自动维护，勿手改段内 — 由项目初始化脚本重跑刷新）

- `.done-coding/` — 注入配置
- `src/` — 源码
  - `__tests__/` — 单元测试
    - `config.test.ts`
    - `deepseek-template.test.ts`
    - `env-guard.test.ts`
    - `parse-argv.test.ts`
    - `prompt-interactive.test.ts`
    - `prompt.test.ts`
    - `run-router.test.ts`
    - `select-profile.test.ts`
  - `handlers/` — 子命令处理器
  - `types/` — 类型定义
  - `utils/` — 工具函数
  - `cli.ts` — CLI 入口
  - `index.ts` — 库出口
  - `main.ts` — 路由主流程

> 用途：供协作者/AI 按图定位，免遍历目录树。结构变更后重跑初始化刷新。
> （模块根的本段展开该模块**内部**结构；深层大目录 ≥8 项或继续分叉则嵌套列出，叶子小目录不展。）

<!-- repo-map:end -->
