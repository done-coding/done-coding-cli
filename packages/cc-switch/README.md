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
| `--meta-silent` | 压制启动前的 profile 名输出（MCP/AI 调用避免污染上下文） |
| `--meta-generate` | 从 settings.json 重建 profile.json |
| `--meta-apiKey=<key>` | 更新指定提供商 apiKey（交互选提供商或 `--meta-provider`，自动重建） |
| `--meta-model-name=<name>` | 添加模型（交互选提供商或 `--meta-provider`，自动重建；id=去 `[1m]`、name+`[1m]`） |
| `--meta-provider=<id>` | 显式指定提供商（供 apiKey / model-name 跳过交互选择，非独立动作） |
| `--meta-provider-list` | 输出提供商列表（`id（name）`，不含 apiKey） |
| `--meta-model-list` | 输出模型列表（`name（provider）`，同模型多 provider 各一行） |
| `--meta-help` | 显示自身帮助 |
| `--meta-version` | 显示自身版本 |

优先级：`--meta-help` > `--meta-version` > `--meta-generate` > `--meta-model-list` > `--meta-provider-list` > `--meta-model-name` > `--meta-apiKey` > `--meta-pick` > `--meta-profile=`。

`--meta-apiKey` 与 `--meta-model-name` 互斥、均不得与 `--meta-generate` 同用；`--meta-provider` 仅随二者使用；`--meta-silent` 为修饰选项，不参与动作优先级。

## 配置源（settings.json 单源）

profile.json 由 settings.json 经 `--meta-generate` 生成（启动不自动生成，保速度；profile 缺失或默认 profile 悬空时提示手动运行）：

- `~/.done-coding/cc-switch/settings.json` — **唯一源**（含 apiKey，chmod 600）：
  ```json5
  {
    defaultProfile: "deepseek-pro",      // 可选：未配置 → 启动时交互选择
    disabledDefault: false,              // true → 忽略已配默认，强制交互选择
    output: { profileName: true },       // 启动前输出 profile 名（false 关闭）
    providers: {
      deepseek: {
        name: "DeepSeek",
        url: "https://api.deepseek.com/anthropic",
        apiKey: "sk-...",
        envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },  // provider 级附加 env
        models: [
          { id: "flash", name: "deepseek-v4-flash[1m]" },
          {
            id: "pro",
            name: "deepseek-v4-pro[1m]",
            envExtraParams: { ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]" }
          }
        ]
      }
    }
  }
  ```
- `~/.done-coding/cc-switch/profile.json` — 编译快照（运行时读取，原格式、chmod 600）

profile 名 = `${provider}-${id}`；每个 profile 的 env 按 `{...通用, ...providerEnvExtraParams, ...modelEnvExtraParams}` 合并（通用 = provider.url/apiKey + model.name 推导的 BASE_URL/AUTH_TOKEN/MODEL/四档/SUBAGENT）。例：pro 档让 haiku 用 flash，在该 model 的 `envExtraParams` 设 `ANTHROPIC_DEFAULT_HAIKU_MODEL`。

## 启动行为

- 启动前向 stdout 输出当前选中 profile 名一行（`output.profileName` 缺省 true；`--meta-silent` 压制，MCP/AI 调用建议带上）
- 默认选择解析序：`--meta-profile=<name>` > 交互 pick（`--meta-pick` / `disabledDefault=true`）> `defaultProfile` > 无默认也交互 pick（非 TTY 报错提示 `--meta-profile`）

> 0.3.0 起废弃 provider.json / model.json 分层源，存量配置请迁移为 settings.json。

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
