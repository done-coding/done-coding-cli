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

| 选项                       | 行为                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `--meta-profile=<name>`    | 显式指定 profile 启动                                                                                    |
| `--meta-pick`              | 终端交互选择 profile 启动（需 TTY）                                                                      |
| `--meta-silent`            | 压制启动前的 profile 名输出（MCP/AI 调用避免污染上下文）                                                 |
| `--meta-generate`          | 从 settings.json 重建 profile.json，报告移除 / 新增的 profile 名                                         |
| `--meta-migrate`           | 显式迁移 v1 → v2，先保存 600 权限备份，再原子写回                                                        |
| `--meta-ui`                | 浏览器编辑 settings v2，保存后自动重建 profile 并提示改名影响                                           |
| `--meta-apiKey=<key>`      | 更新凭据（`--meta-provider` 选提供商，多账号再用 `--meta-account` 或交互选择，自动重建）                 |
| `--meta-model-name=<name>` | 添加模型（交互选提供商或 `--meta-provider`，自动重建；v2 alias=去尾部 `[1m]`、name+`[1m]`、自动补 UUID） |
| `--meta-provider=<alias>`  | 显式指定提供商（供 apiKey / model-name 跳过交互选择，非独立动作）                                        |
| `--meta-account=<alias>`   | 多账号服务商更新 apiKey 时选择账号；非 TTY 必须显式指定，仅用于 apiKey                                   |
| `--meta-provider-list`     | 输出提供商列表（`alias（name，账号 157 / 199）`，不含 apiKey）                                           |
| `--meta-model-list`        | 输出模型列表（`name（provider，账号 157 / 199）`，同模型多 provider 各一行）                             |
| `--meta-help`              | 显示自身帮助                                                                                             |
| `--meta-version`           | 显示自身版本                                                                                             |

优先级：`--meta-help` > `--meta-version` > `--meta-ui` > `--meta-migrate` > `--meta-generate` > `--meta-model-list` > `--meta-provider-list` > `--meta-model-name` > `--meta-apiKey` > `--meta-pick` > `--meta-profile=`。

`--meta-migrate` 不得与 `--meta-generate` 或源修改同用；`--meta-apiKey` 与 `--meta-model-name` 互斥、均不得与 `--meta-generate` 同用；`--meta-provider` 仅随二者使用；`--meta-silent` 为修饰选项，不参与动作优先级。

`--meta-ui` 与其他 meta 动作及 provider/account 选择器互斥；help/version 仍优先，silent 可同用。

## 浏览器配置界面

```bash
dc-cc-switch --meta-ui
```

要求源配置为 v2；已有 v1 请先运行 `--meta-migrate`。界面由随包 Schema 的表单视图生成，可编辑服务商、账号、模型及输出选项。UUID 不展示，新增行自动补 UUID，改别名保留身份和默认引用。API 密钥使用密码框。

- 单密钥模式填写服务商 API 密钥，账号列表留空；多账号模式清空服务商密钥并添加账号。两处同时有非空凭据时保存失败。
- 默认引用、额外环境变量及其它未展示字段原样保留；需要修改它们时编辑 settings.json。删除默认引用所指的实体会报错，请先调整默认引用。
- 每次启动都打印完整本地 URL。TTY 尝试打开浏览器；非 TTY 设置 `openBrowser:false`，无桌面或自动打开失败时可手动打开 URL。链接仅在本次会话有效，请勿分享。
- 保存成功后以 600 权限原子写回 settings、自动重建 profile，输出移除 / 新增名称及外部按名引用提示，以退出码 0 结束。拒绝 settings/profile 目标软链。
- 页面字段校验失败可原地修正重试，不写文件。v2 语义校验失败会结束会话、终端提示原因并退出 1；重新启动后再修改。默认 5 分钟超时退出 1，关闭页面本身不代表保存成功。
- settings 和 profile 分别原子替换；若 settings 已保存而 profile 重建失败，终端明确提示运行 `--meta-generate` 修复，不会声称全部成功。超时不能撤回已开始的文件操作。

可重复的本地集成冒烟（先 `pnpm build`）：在本包执行 `node scripts/smoke-meta-ui.mjs`。脚本用临时 HOME、禁开浏览器，通过真实 CLI 和 HTTP 验证删行 / 新增 / 改别名、UUID、默认引用、600 权限、重建字节与退出码，并清理夹具。需要允许监听 127.0.0.1；这不代替浏览器视觉验收。

## settings v2：稳定身份、可改别名、多账号

配置源仍是 `~/.done-coding/cc-switch/settings.json`，运行时读取由它编译的 `profile.json`。v2 服务商、账号、模型均带 `uuid`（稳定身份）和 `alias`（拼 profile 名）；改 alias 时保留 UUID，默认引用仍指向同一实体。

```json
{
  "version": 2,
  "defaultProfile": {
    "provider": "00000000-0000-4000-8000-000000000001",
    "account": "00000000-0000-4000-8000-000000000003",
    "model": "00000000-0000-4000-8000-000000000004"
  },
  "providers": [
    {
      "uuid": "00000000-0000-4000-8000-000000000001",
      "alias": "ark-agent-plan",
      "name": "火山方舟 agent plan",
      "url": "https://example.test/anthropic",
      "accounts": [
        {
          "uuid": "00000000-0000-4000-8000-000000000002",
          "alias": "157",
          "apiKey": "test-key-157"
        },
        {
          "uuid": "00000000-0000-4000-8000-000000000003",
          "alias": "199",
          "apiKey": "test-key-199"
        }
      ],
      "models": [
        {
          "uuid": "00000000-0000-4000-8000-000000000004",
          "alias": "glm",
          "name": "glm[1m]"
        }
      ]
    }
  ]
}
```

这里生成 `ark-agent-plan-157-glm` / `ark-agent-plan-199-glm`，默认选第二个。URL 和 key 均为示例，需换成实际配置。

- 一个服务商只可有 `apiKey` 或非空 `accounts` 之一。单 key 模式的 profile 名是 `${provider.alias}-${model.alias}`，默认引用不带 `account`。
- alias 匹配 `^[A-Za-z0-9][A-Za-z0-9._-]*$`；同层 UUID / alias 唯一；生成的 profile 名全局唯一，碰撞时报冲突来源。providers / models 均非空。
- `defaultProfile` 引用 UUID，必须解析到该服务商所属的账号和模型，否则报「默认 profile 悬空」，修正源后再生成。
- env 合并顺序仍为通用字段 ← provider.envExtraParams ← model.envExtraParams；账号 key 提供通用 AUTH_TOKEN。
- v2 读取时不自动修补缺失 UUID。CLI 新增模型、显式迁移和导出的 `assignMissingUuids` 为新实体补 UUID；手工加实体时需填写 UUID。
- `settings.schema.json` 随包发布。迁移自动写入带当前包版本的 jsdelivr `$schema` 地址。UUID 标 `readOnly`，apiKey 标 `x-dc-ui.secret`；UI 使用隐藏身份字段的表单视图，重复和默认引用等语义仍由 CLI 校验。

```bash
dc-cc-switch --meta-apiKey=test-new-key --meta-provider=ark-agent-plan --meta-account=199
dc-cc-switch --meta-model-name=new-model --meta-provider=ark-agent-plan
dc-cc-switch --meta-provider-list
dc-cc-switch --meta-generate
```

TTY 可交互选提供商和账号；非 TTY 多账号缺 `--meta-account` 会立即报错。新增模型由该服务商所有账号共享。列表只显示别名和名称，不显示密钥。

改 alias 后运行 generate：若 profile 名变化，会列出移除 / 新增名称；有移除时提醒同步外部 `--meta-profile=` 和脚本引用，无变化不输出差异。UUID 只能保持配置内部引用，外部按名称使用的脚本仍需更新。

## v1 兼容与迁移

没有 `version`、providers 为对象的旧配置继续只读编译，生成内容保持不变，并提示迁移命令。旧 meta 修改仍可操作 v1，不会隐式升级。显式执行：

```bash
dc-cc-switch --meta-migrate
dc-cc-switch --meta-generate
```

迁移保留旧 provider 键 / model.id 为 alias，补 UUID 并将默认完整 profile 名解析为 UUID 引用；不合并服务商。原文件先备份到同目录 `settings.json.v1-<时间戳>.bak`（权限 600），再原子写回。默认无法解析则省略并提示；非法 alias 或冲突则报错，不改原文件。已是 v2 时不重复备份或改写。有效默认项的配置在迁移前后生成的 profile 名和 env 完全相同。

旧格式示例（仅供已有 v1 配置参考）：

profile.json 由 settings.json 经 `--meta-generate` 生成（启动不自动生成，保速度；profile 缺失或默认 profile 悬空时提示手动运行）：

- `~/.done-coding/cc-switch/settings.json` — **唯一源**（含 apiKey，chmod 600）：
  ```json5
  {
    defaultProfile: "deepseek-pro", // 可选：未配置 → 启动时交互选择
    disabledDefault: false, // true → 忽略已配默认，强制交互选择
    output: { profileName: true }, // 启动前输出 profile 名（false 关闭）
    providers: {
      deepseek: {
        name: "DeepSeek",
        url: "https://api.deepseek.com/anthropic",
        apiKey: "sk-...",
        envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" }, // provider 级附加 env
        models: [
          { id: "flash", name: "deepseek-v4-flash[1m]" },
          {
            id: "pro",
            name: "deepseek-v4-pro[1m]",
            envExtraParams: {
              ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
            },
          },
        ],
      },
    },
  }
  ```
- `~/.done-coding/cc-switch/profile.json` — 编译快照（运行时读取，原格式、chmod 600）

v1 profile 名 = `${provider}-${id}`；每个 profile 的 env 按 `{...通用, ...providerEnvExtraParams, ...modelEnvExtraParams}` 合并（通用 = provider.url/apiKey + model.name 推导的 BASE_URL/AUTH_TOKEN/MODEL/四档/SUBAGENT）。例：pro 档让 haiku 用 flash，在该 model 的 `envExtraParams` 设 `ANTHROPIC_DEFAULT_HAIKU_MODEL`。

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
