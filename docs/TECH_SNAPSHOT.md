# 技术架构快照

> 最后更新：2026-04-26
> 关联任务：项目全局快照梳理

## 1. 系统上下文（C4 Level 1）

### 系统边界

```
                  ┌──────────────────────────────────────┐
                  │           done-coding-cli            │
                  │                                      │
   Developer ────▶│  DC / dc-cli / done-coding (bin)    │────▶ npm registry
                  │  │                                   │
   AI Agent ─────▶│  ├── DC create / npm create done... │────▶ Git repos (GitHub/Gitee/...)
                  │  ├── DC component                   │
                  │  ├── DC config                      │────▶ Gitee assets config repo
                  │  ├── DC extract/inject              │
                  │  ├── DC git                         │────▶ OS filesystem (.git, ~/.done-coding)
                  │  ├── DC publish                     │
                  │  ├── DC template                    │
                  │  └── DC ai (计划中)                  │
                  │                                      │
                  │  @done-coding/cli-utils (foundation) │
                  └──────────────────────────────────────┘
```

### 外部依赖

| 外部系统 | 协议 | 用途 |
|---|---|---|
| npm registry | HTTPS | 包发布、依赖安装 |
| GitHub / Gitee / GitLab / Bitbucket | HTTPS / SSH（git clone） | 模板仓库、用户仓库克隆 |
| Gitee（done-coding-cli-assets-config） | HTTPS（git clone） | 工程化配置资产拉取 |
| Node.js runtime（>= 18） | 进程环境 | 执行环境 |
| MCP（Model Context Protocol） | 环境变量 + stdin/stdout | AI agent 驱动 |

## 2. 技术选型

| 层面 | 选型 | 版本 |
|---|---|---|
| 语言 | TypeScript | ^5.8.3 |
| 运行时 | Node.js | >= 18.0.0 |
| 模块系统 | ESM（`"type": "module"`） | — |
| 包管理 | pnpm（workspaces） | — |
| 版本管理 | Lerna（independent mode） | ^7.3.0 |
| CLI 框架 | yargs（通过 @done-coding/cli-utils 封装） | — |
| 构建 | Vite + vite-plugin-dts | ^5.0.10 / ^3.7.0 |
| 交互输入 | prompts（通过 xPrompts 封装） | — |
| 模板引擎 | lodash.template | — |
| 配置格式 | JSON5 / JSON | — |
| 测试 | Vitest | ^1.6.1 |
| 代码风格 | ESLint + Prettier + ls-lint | ^8.49.0 / ^3.8.0 / ^2.2.3 |
| 提交规范 | commitlint（conventional config） | ^16.3.0 |
| Git hooks | husky + lint-staged | ^8.0.3 / ^12.5.0 |
| 发布 | Lerna publish（+ 自定义 postpush 脚本） | ^7.3.0 |

## 3. 架构风格与模式

### 整体架构：分层 Monorepo

```
入口层:  @done-coding/cli（主命令注册 + 子命令路由 + createChat 入口）
         create-done-coding（独立入口：npm create done-coding）
            │
业务层:  @done-coding/cli-component  组件管理
         @done-coding/cli-config     工程配置（运行时调用 git 包）
         @done-coding/cli-extract    信息提取
         @done-coding/cli-inject     信息注入（构建时用于 injectInfo.json）
         @done-coding/cli-git        Git 操作
         @done-coding/cli-publish    项目发布
         @done-coding/cli-template   模板编译（被 create/component/extract 依赖）
         @done-coding/cli-ai         AI 对话（开发中）
            │
基础层:  @done-coding/cli-utils      共享工具 + 类型定义
```

### 核心设计模式

| 模式 | 应用 |
|---|---|
| **Command Delegation** | yargs 父命令注册子命令模块，每个子包暴露 `createAsSubcommand()` + `handler()` |
| **Template Method** | 所有子包遵循完全相同的文件结构（main.ts / handlers/ / types/ / index.ts / cli.ts） |
| **Strategy** | injectInfo.json 机制：每个包通过 injectInfo 实现配置差异化 |
| **Observer** | husky + git hooks 事件驱动（pre-commit、pre-push 等触发检测） |
| **Proxy/Adapter** | xPrompts 封装 prompts，透明支持 hijack（AI）和 交互（人类）两种模式 |
| **Pipeline** | create 流程：clone → batchCompile → git optimize → commit |

## 4. 模块/组件结构（C4 Level 2-3）

### 统一子包结构

每个 `packages/<name>/src/` 下有完全一致的文件结构：

```
packages/<name>/src/
├── cli.ts              # #!/usr/bin/env node 入口，调用 createCommand()
├── main.ts             # createCommand() + createAsSubcommand() 导出
├── index.ts            # 统一导出：handler + createAsSubcommand + types
├── handlers/
│   ├── index.ts        # commandCliInfo（子命令列表 + 路由）+ handler（switch-case 分发）
│   └── <subcommand>.ts # 每个子命令：commandCliInfo + handler + getOptions()
├── types/
│   └── index.ts        # SubcommandEnum + 选项类型定义
└── injectInfo.json     # 包元数据（构建时注入）
```

**关键文件约定：**
- `main.ts` 的 `createAsSubcommand()` 被 cli 主包导入，作为 yargs `CommandModule` 注册
- `handlers/index.ts` 导出 `commandCliInfo`（含 describe, version, subcommands, demandCommandCount）和 `handler()`（子命令 switch-case 路由）
- 无 `handler()` 的二层 dispatch——`DC create` 进入 ai 包的 handler，内部 switch `SubcommandEnum` 分发到各子命令

#### 默认子命令（`$0`）

WHEN 子包希望「不指定子命令时执行默认行为」，将对应 `handlers/<subcommand>.ts` 中的 `command` 设为 `"$0"`，其余文件与普通子命令完全一致：

```typescript
// handlers/<默认子命令>.ts — 仅此文件有差异
export const commandCliInfo: SubCliInfo = {
  command: `$0`,  // ← 普通子命令为 SubcommandEnum.XXX，默认子命令为 "$0"
  describe: "该子命令的描述",
  handler: <handlerFn> as SubCliInfo["handler"],
};
```

- 该子命令仍保留在 `SubcommandEnum` 中，仍可通过 `handler(SubcommandEnum.XXX, argv)` 编程调用
- `handlers/index.ts`、`types/index.ts`、`main.ts` 无需任何特殊处理
- 参考：`packages/template/src/handlers/compile.ts`

详细说明：每个子包的架构细节见 `packages/<name>/docs/ARCHITECTURE.md`（待创建）。

### 依赖关系

```
@done-coding/cli ────────────── 直接依赖所有业务包 ─────────────────┐
    │                                                               │
    ├── create-done-coding ───── 依赖: git, template, utils          │
    ├── @done-coding/cli-component  依赖: template, utils            │
    ├── @done-coding/cli-config ── 依赖: utils（运行时调用 git 包）   │
    ├── @done-coding/cli-extract ─ 依赖: template, utils             │
    ├── @done-coding/cli-git ──── 依赖: utils（+ axios）             │
    ├── @done-coding/cli-inject ── 依赖: utils                       │
    ├── @done-coding/cli-publish ─ 依赖: utils（+ semver）           │
    ├── @done-coding/cli-template  依赖: utils（+ lodash.template）  │
    └── @done-coding/cli-ai ───── 依赖: utils                       │
         ↓                                                          │
    @done-coding/cli-utils ─────── 无内部依赖 ──────────────────────┘
```

**唯一的跨包运行时调用：** `config` →（运行时通过 yargs 的 `DC git check reverse-merge`）→ `git`。其余包间通信仅通过 npm 依赖 + 编译时导出。

### 构建输出

每个子包构建产物：
```
packages/<name>/
├── es/           # Vite 构建的 ESM JS（main 入口：es/index.mjs）
├── types/        # vite-plugin-dts 生成的 .d.ts
└── lib/          # （部分包）额外输出
```

## 5. 数据架构

### 配置数据流

```
构建时:
  src/injectInfo.json
    ← @done-coding/cli-inject 的 local:init 脚本写入
    → 编译为 es/injectInfo.json.mjs
    → 运行时 import 使用

运行时配置（每个子包独立）:
  .done-coding/
    ├── extract.json5       # DC extract config
    ├── inject.json         # DC inject config
    ├── template.json       # DC template config
    ├── publish.json        # DC publish config
    └── git.config.json     # DC git config

全局配置:
  ~/.done-coding/config.json   # 全局持久化配置（计划中，AI key/model 等）
```

### 关键数据流

```
DC create:
  prompts 输入（projectName, template...）
  → git clone 模板仓库
  → 读取模板中 .done-coding/ config
  → batchCompileHandler（Lodash 模板）
  → git 细节优化（分支/URL/history）
  → 初始 commit

DC template:
  环境数据（-e JSON 文件 或 -E JSON 字符串）
  + 模板（-i 文件 或 -I 字符串）
  → lodash.template 编译
  → 按 -m 模式写入（overwrite/append/replace/return）

DC extract:
  extractInput 定义（源文件 + 匹配规则）
  → reg/json-inject/fixed 提取
  → extractOutput 定义（模板 + 输出路径）
  → batchCompileHandler 写入

DC inject:
  keyConfigMap 定义（键名 + 提取方式）
  → 从 source JSON 提取值
  → lodash _set 组装对象
  → 写入 inject JSON 文件
```

### MCP/Hijack 数据流

```
父进程（AI agent）
  → set env: DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON
  → spawn 子进程

子进程 CLI
  → processIsHijacked() = true
  → xPrompts: 跳过交互，从 env 读预设值或 CLI arg 取值
  → console 输出 → hijack 日志文件
  → beforeInputExit → process.exit()
```

## 6. 设计原则与约定

### 编码约定

| 约定 | 说明 |
|---|---|
| ESM only | 所有包 `"type": "module"`，只产出 ESM |
| 路径别名 `@/` | `@/handlers` = `./src/handlers`（Vite alias） |
| Bin 命名 | `DC`（主大写）+ `dc-cli`（备用）+ `done-coding`（品牌），子包用 `dc-<name>` |
| TypeScript strict | 严格模式，完整类型导出到 `types/` |
| Side-effect free | 所有包 `"sideEffects": false` |
| 无循环依赖 | cli → 各子包 → utils（单向） |
| 禁止魔鬼字符串 | 业务关键字（如命令、状态、配置 key）[MUST] 使用枚举值，禁止内联字符串字面量 |
| 禁止魔鬼数字 | 有语义的数值（如索引标记、状态码）[MUST] 定义为具名常量 |
| JSDoc 注释 | 所有 `export` 类型/接口、枚举成员、公共函数 [MUST] 包含 `/** 中文描述 */` |

### 子包模板一致性

新建子包必须通过脚手架模板创建，确保每个包的 `main.ts`、`handlers/`、`types/` 结构完全一致。详见 `packages/ai` 作为最新模板参考。

### Child Process Hijack 约定

| 约定 | 说明 |
|---|---|
| env 变量名 | `DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON` |
| hijack 检测 | `processIsHijacked()` — 在 `@done-coding/cli-utils` 中定义 |
| hijack 时禁止 syscall | hijack 模式下 [MUST NOT] 调用 `process.exit()`、`execSync` 等 |
| 所有交互必须经 xPrompts | [MUST] 使用 xPrompts 包装 prompts，禁止直接调用 prompts；xPrompts 在 hijack 模式下自动使用预设值 |

## 7. 架构决策记录（ADR）

### ADR-1：使用 yargs 而非 commander

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | 选择 yargs 作为 CLI 框架 |
| **背景** | 需要支持层级子命令路由、自动 --help/--version、类型安全的选项定义。Commander 在当时版本对类型支持较弱。 |
| **权衡** | yargs bundle 更大但类型定义完整，`createSubcommand`/`createMainCommand` 封装消除了样板代码。 |

### ADR-2：独立子包版本（Lerna independent mode）

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | 每个子包独立 SemVer，不统一版本号 |
| **背景** | 不同子包变更频率不同（如 utils 变更少，create 变更多），统一版本会造成不必要的版本跳跃和依赖更新。 |

### ADR-3：Vite 构建替代 tsc/rollup

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | 使用 Vite + vite-plugin-dts 构建 |
| **背景** | tsc 不支持单文件 ESM 输出；rollup 配置复杂。Vite 提供零配置 ESM 构建 + 并行 dts 生成。 |

### ADR-4：MCP/Hijack 通过 env 变量而非独立二进制

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | 同一份代码同时服务人类交互和 AI agent 调用，通过 `DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON` 区分模式 |
| **背景** | 避免维护两套逻辑。hijack 模式通过 xPrompts 透明处理交互跳过、日志输出重定向。 |

### ADR-5：AI 对话使用 OpenAI 兼容协议

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | `@done-coding/cli-ai` 的 AI 对话后端使用 OpenAI 兼容的 `/v1/chat/completions` 接口 + SSE 流式 |
| **背景** | 绝大多数模型厂商支持此协议；暂不支持 Anthropic Messages API（用户选型时说明）。零第三方 AI SDK 依赖，用 fetch + SSE parser 自建轻量 adapter。 |

## 8. 质量属性与非功能需求

| 属性 | 要求 |
|---|---|
| 启动速度 | CLI 无子命令时（`DC`）应在 1s 内显示提示 |
| 跨平台 | Windows / macOS / Linux 行为一致（路径用 `path` 模块、避免 shell 特定语法） |
| 可扩展性 | 新增子包：脚手架创建 → 实现 handlers → cli 注册两行 import，其余零触碰 |
| 错误处理 | yargs 自动处理无效命令；子包 handler 内错误直接 throw（yargs 输出到 stderr，exitCode ≠ 0） |
| 日志 | hijack 模式下输出到日志文件；正常模式 stdout + chalk 美化 |
| 包体积 | 各子包 `files` 字段严格控制为 `es`、`lib`、`types` |

## 9. 注意事项与常见陷阱

### 变更高风险区域

| 区域 | 风险 | 说明 |
|---|---|---|
| `@done-coding/cli-utils` 的类型定义 | 高 | `CliInfo`/`SubCliInfo` 类型变更影响所有子包， [MUST] 确保向后兼容 |
| `createAsSubcommand` 函数签名 | 高 | 所有子包的 `main.ts` 依赖此签名注册到 cli 主命令 |
| xPrompts hijack 检测逻辑 | 高 | 修改不当会导致 AI agent 调用卡在交互式 prompt |
| injectInfo.json 格式 | 中 | 所有子包的名称/版本/bin 信息依赖此文件，格式变更需同步更新构建脚本 |
| Child process spawn | 中 | hijack 模式下子进程通信依赖 env 变量， [MUST NOT] 在子进程中调用 `process.exit()` |

### 常见错误

| 错误 | 原因 | 正确做法 |
|---|---|---|
| 在子包 handler 中直接使用 `prompts` | hijack 模式会在交互式 prompt 卡住 | [MUST] 使用 `xPrompts` |
| 修改 utils 的 type 后只构建 utils | 其他包的类型检查引用了旧类型 | pnpm build（所有包）或至少构建依赖链 |
| 在 `handler()` 中调用 `process.exit()` | hijack 模式会杀掉父进程 | throw error 让 yargs 处理 |
| 在子包中 import cli 主包 | 会造成循环依赖 | 子包 [MUST NOT] import cli 包 |
| `npm install` 而非 `pnpm install` | preinstall 脚本 `npx only-allow pnpm` 会拒绝 | [MUST] 使用 pnpm |
| 使用内联字符串作业务判断 | 如 `if (cmd === "/exit")`，分散在多处难维护 | [MUST] 定义枚举，引用枚举值 |
| 使用魔法数字 | 如 `value: -1` 标记"自定义"，语义不清 | [MUST] 定义为具名常量 |
| 导出类型缺少 JSDoc | 其他开发者/AI agent 无法理解字段含义 | [MUST] `/** */` 注释每个 `export type`/`enum` 成员 |

## 10. 技术债务与风险

| 债务 | 优先级 | 说明 |
|---|---|---|
| `createChat` 为假实现 | **高** | 见 `packages/cli/src/main.ts`，应替换为调用 `@done-coding/cli-ai` |
| `@done-coding/cli-ai` 仅有 test 骨架 | **高** | 需实现完整的 AI 对话（选模型 → key → SSE 流式聊天） |
| 缺少自动化测试 | 中 | 大部分子包仅有 vitest 配置但无实质性测试用例 |
| create-done-coding 远程模板列表依赖 Gitee | 低 | Gitee 不可用时模板选择不可用，应考虑 fallback 方案 |
| vite 构建产物包含 `#!/usr/bin/env node` 在非 cli 入口文件中 | 低 | 仅 `cli.ts` 应包含 shebang，构建配置需过滤 |
| 部分包 `.npmignore` 可能与 `files` 字段冲突 | 低 | 两个机制都在用，应以 `files` 为准 |

## 11. 开发工作流

### 本地开发

```bash
pnpm install          # 安装所有依赖（preinstall 强制 pnpm）
pnpm run dev          # 所有子包 Vite watch 模式（hotBuild）
pnpm run build        # 所有子包构建
```

### 质量门禁

| 步骤 | 触发 | 工具 |
|---|---|---|
| 文件命名检查 | pre-commit | ls-lint |
| 代码风格 | pre-commit | ESLint --fix → Prettier --write |
| 提交信息校验 | commit-msg | commitlint |
| 分支合并方向检查 | 多个 git hooks | DC git hooks（reverse-merge） |

### 发布流程

```bash
# alpha 预发布
npx lerna publish prerelease --dist-tag alpha --preid alpha

# 正式发布
pnpm run push  # = lerna publish
  → postpush: node ./scripts/postpush.mjs
```

### 新增子包

1. 通过脚手架模板创建 `packages/<name>/`（含统一文件结构）
2. 在 `SubcommandEnum` 中定义子命令
3. 在 `handlers/index.ts` 中实现 switch-case 路由
4. 在 `packages/cli/package.json` 添加 workspace 依赖
5. 在 `packages/cli/src/index.ts` 添加 `createAsSubcommand` + `handler` 导出
6. 在 `packages/cli/src/main.ts` 的 `subcommands` 数组中注册

## 12. 横切关注点

### 日志/输出

- 正常模式：`outputConsole`（chalk 封装）：`.info()`、`.stage()`、`.skip()`、`.log()`
- hijack 模式：输出重定向到日志文件
- `debug` 库用于开发调式（`DEBUG=done-coding:<module>`）

### 错误处理

- yargs 框架层：无效命令自动 `.strict()` 拦截，输出 usage 提示 → exitCode 1
- handler 层：错误直接 throw，yargs 捕获并输出到 stderr
- hijack 层：[MUST NOT] `process.exit()`——改为 throw error
- publish rollback：发布失败时 `git reset` + 删除 tag

### 认证/安全

- npm publish 认证：依赖用户本地 `~/.npmrc`（`npm login` 结果）
- Git clone 认证：依赖用户本地 git credential / SSH key
- AI API Key：计划持久化到 `~/.done-coding/config.json`（`{ ai: { key: "xxx" } }`）
- AES 加密：`@done-coding/cli-utils` 提供 `encryptAES`/`decryptAES`（用于配置中的敏感值）

### 包间通信模式

| 通信方式 | 使用场景 |
|---|---|
| npm workspace 依赖 | 所有子包 depend on `@done-coding/cli-utils` |
| yargs 子命令注册 | cli 主包注册所有子包的 `createAsSubcommand()` |
| 运行时 child_process | `config` 调用 `git check reverse-merge`（唯一跨包运行时调用） |
| 构建时 injectInfo | `@done-coding/cli-inject` 在构建时将元数据写入各包的 `injectInfo.json` |
