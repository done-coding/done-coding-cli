# 技术架构快照

> 最后更新：2026-06-22
> 关联任务：cli-generator 程序全程（gen 泛化 P1 + inject/marker P2 + MCP 接线 P3 + assemble 组装 P4a + modify 子命令 + 安全收尾硬化）；MCP 资源/提示词与隔离重构

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
                  │  ├── DC ai                          │
                  │  └── DC mrm                         │
                  │                                      │
                  │  独立 bin（未并入 DC 子命令树）:     │
                  │  ├── dc-gen <type> add/modify/...   │────▶ .done-coding/<type>/（批次发现：项目→父链→全局）
                  │  │   └── dc-gen assemble build/diff │────▶ .done-coding/generator/assemble/（recipes/fragments/manifests）
                  │  ├── dc-mcp（stdio MCP server）     │◀───▶ AI agent / MCP client（Tools/Resources/Prompts）
                  │  └── dc-cli-skills install          │────▶ .claude/skills/
                  │                                      │
                  │  @done-coding/cli-utils (foundation) │
                  └──────────────────────────────────────┘

注：DC component 已切换为 cli-generator 的 component 预设薄包装（dc-component = dc-gen component）。
```

### 外部依赖

| 外部系统 | 协议 | 用途 |
|---|---|---|
| npm registry | HTTPS | 包发布、依赖安装 |
| GitHub / Gitee / GitLab / Bitbucket | HTTPS / SSH（git clone） | 模板仓库、用户仓库克隆 |
| Gitee（done-coding-cli-assets-config） | HTTPS（git clone） | 工程化配置资产拉取 |
| Node.js runtime（>= 18） | 进程环境 | 执行环境 |
| MCP（Model Context Protocol） | hijack：环境变量 + stdin/stdout；MCP server：`@modelcontextprotocol/sdk` stdio transport | AI agent 驱动（hijack 子进程 / `dc-mcp` server 的 Tools/Resources/Prompts） |
| git CLI（execFileSync 本地壳） | 子进程（rev-parse/ls-tree/ls-files/show/status） | assemble diff 的 head/index 基准检出 + forceClean 的工作树 clean 探测 |

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
入口层:  done-coding（主命令注册 + 子命令路由 + AI 对话入口）
         create-done-coding（独立入口：npm create done-coding）
         dc-gen / dc-mcp / dc-cli-skills（独立 bin，未并入 DC 子命令树）
            │
机制层:  @done-coding/cli-generator  通用具名批次生成器（content-free 引擎 + assemble 组装层）
            │ └─ component 业务全下沉到 .done-coding/component/config.json5（无业务 JS）
业务层:  @done-coding/cli-component  组件管理（= cli-generator 的 component 预设薄包装）
         @done-coding/cli-config     工程配置（运行时调用 git 包）
         @done-coding/cli-extract    信息提取
         @done-coding/cli-inject     信息注入（构建时用于 injectInfo.json）
         @done-coding/cli-git        Git 操作
         @done-coding/cli-publish    项目发布
         @done-coding/cli-template   模板编译（被 create/component/generator/extract 依赖；含 marker 引擎）
         @done-coding/cli-mrm         模型源管理器（服务商/模型 CRUD + client 切换）
         @done-coding/cli-ai         AI 对话（/provider /model 委托 mrm，/xxx 子包帮助）
            │
接口层:  @done-coding/cli-mcp        MCP server（server-agnostic 直接 import create/generator 的 handler）
         @done-coding/cli-skills      Agent Skill 聚合包 + 安装器
            │
基础层:  @done-coding/cli-utils      共享工具 + 类型定义（safeCwd / resolveHandlerContext / 三模式）
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
| **Mechanism/Policy 分离（content-free）** | cli-generator 机制层只认 strategy/files/instanceDir；业务策略（series 算法/扫子目录/命名派生）全在各批次 `config.json5` 声明，引擎零业务逻辑 |
| **表驱动扩展（Registry）** | strategyRegistry（strategy→OutputMode）+ assemble op registry（type→OpHandler 能力声明式）：加能力 = 注册一条，planner/engine 零改 |
| **VFS + 原子 flush** | assemble 全程在内存虚拟文件树作业，最后 sibling-temp → rename 原子顶替；任一步 throw 不落盘 |
| **server-agnostic handler** | generator/create handler 签名 `(argv, ctxInit?) => Promise`，内部 `resolveHandlerContext` 走 cli/mcp/test 三模式，库函数 throw fail-loud、[MUST NOT] `process.exit`（退出码在 cli 边界落地） |

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

#### 默认子命令

WHEN 子包希望「不指定子命令时执行默认行为」[MUST] 使用 `packDefaultCommandCliInfo()` 包装目标 handler 的 `commandCliInfo`：

```typescript
// handlers/index.ts
import { packDefaultCommandCliInfo } from "@done-coding/cli-utils";

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  subcommands: [
    packDefaultCommandCliInfo(chatCommandCliInfo),  // ← $0 兜底
    chatCommandCliInfo,                              // ← 命名子命令
  ].map(createSubcommand),
  demandCommandCount: 1,
  // ...
};
```

- `packDefaultCommandCliInfo()` 内部将 `command` 改为 `"$0"`，生成一个仅 yargs 路由使用的副本，不修改原始 `commandCliInfo`
- 原始 `commandCliInfo` 同时保留在 `subcommands` 中，确保 `--help` 仍显示命名子命令
- handler 文件本身无需任何改动——`command` 保持为 `SubcommandEnum.XXX`，`handlers/index.ts`、`types/index.ts`、`main.ts` 写法不变
- 参考：`packages/ai/src/handlers/index.ts`

详细说明：每个子包的架构细节见 `packages/<name>/docs/ARCHITECTURE.md`（待创建）。

### cli-generator 内部结构（机制层，content-free）

`@done-coding/cli-generator`（bin `dc-gen`）是 component 的泛化，结构区别于普通子包：

```
packages/generator/src/
├── types/index.ts        # 权威类型契约：Strategy / StrategyRegistry / FileEntry / BatchConfig /
│                         #   EnvContext / EnvHelperNamespace / GeneratorHandlerArgv / ResolvedBatch / OperateOptions
├── handlers/             # 命令面（server-agnostic，直接被 mcp/cli-skills/component import）
│   ├── index.ts          # 装配 commandCliInfo（verb-first：add/modify/remove/list/init + assemble plan|build|diff|check）
│   ├── add.ts / modify.ts / remove.ts / list.ts / init.ts
│   ├── assemble.ts       # assembleHandler（真子命令；diff/check drift → 返回 exitCode=1，cli 边界落 process.exitCode）
│   └── shared.ts         # buildBatchQuestions / collectInteractiveAnswers / listBatchQuestions
├── core/                 # 引擎原语（供 handlers + assemble 复用）
│   ├── batch-discovery.ts  # discoverBatch / readBatchConfig / listDiscoveredBatches（项目→父链→全局，shadowed/invalid）
│   ├── env-context.ts      # createEnvContext：内建 canonical（name=PascalCase…）+ helper（_.camelCase…）+ 派生
│   ├── operate.ts          # add/remove/modify 公共引擎：预渲染→越界校验→strategy→引擎；remove dry-run 事务边界
│   ├── strategy.ts         # strategyRegistry（create/append/replace/inject → OutputMode）
│   ├── instance-dir.ts     # resolveInstanceDir / removeEmptyInstanceDir（realpath + isInside + 可疑根守卫）
│   ├── marker-ns.ts        # getMarkerNs()：从 injectInfo.bin 取 NS（单 bin 约束，多 bin fail-loud）→ "dc-gen"
│   └── safe-root.ts        # assertCwdNotSuspiciousRoot（家目录本体 / 文件系统根 → throw，--allow-dangerous 逃逸）
├── assemble/             # 模板组装层（P4a，独立子层）
│   ├── types.ts          # Recipe / AssembleOp / OpHandler（effects/preflight/apply 能力声明式）/ TargetEffect / Vfs / AssembleManifest
│   ├── recipe.ts         # loadRecipe（JSON5 校验，fail-loud）/ discoverRecipes / recipeDir / fragmentRoot
│   ├── registry.ts       # op 注册表（type→OpHandler）；registerBuiltinOps
│   ├── ops/              # 内建 5 op：add-fragment / text-patch / json-merge-op / delete-file / delete-field
│   ├── planner.ts        # plan：构 VFS → 通用判冲突（混族/conflictKey）+ 顺序模拟（不认死 kind，A-NFR-4）
│   ├── engine.ts         # runPlan / runBuild / runDiff / assertOutputsCompatible + git 本地壳（execFileSync）
│   ├── vfs.ts            # 内存 VFS + loadBaseDir + 原子 flush（sibling-temp→rename）+ manifest 孤儿删除 + 大小写折叠守卫
│   ├── render.ts         # createRender（lodash.template + _.helper）/ readFragment（throw-only，越界 throw + fence 剥离）
│   ├── json-merge.ts / json-pointer.ts / conflict.ts / glob.ts / create-sync.ts
│   └── create-sync.ts   # 可选：build 后把产物 upsert 进 create 的 templateList
└── presets/init-skeleton.ts  # init 生成的批次骨架（config.json5 注释头：helper/内建变量/策略速查）
```

**关键设计：**
- **content-free 引擎**：`operate()` 接 `OperateOptions{action,batch,env,...}` 与命令面解耦，被 add/remove/modify 三命令 + assemble 复用；只认 strategy/files/instanceDir，[MUST NOT] 出现 component/entry/index 业务概念。
- **strategy 落地**：FileEntry.strategy（create/append/replace/inject）经 strategyRegistry → 引擎 OutputMode；inject 走 marker 锚点插入 + 健壮回退（按 markerKey 精确定位，免疫块内手改）。
- **marker `===` 外壳 + NS 参数化**：marker 形如 `<注释> === <markerNs>:start:<markerKey> === <注释>`；markerNs（`dc-gen`）由 `getMarkerNs()` 从 injectInfo.bin 取，参数化以隔离跨工具命名空间，cli-template 的 4 个 marker 函数（buildMarkerLines/computeInsert/computeRollback/validateMarkerKey）markerNs **强制必填**（缺则 fail-loud，杜绝隐式串扰）。
- **modify 事务性**：过滤 INSERT 子集 → `probeMarkerPairing` 三态预检（0 缺失/1 存在/throw 损坏）→ 缺块默认原子中止（零写盘），`--skip-missing` 块级跳过；命中块原位替换。
- **assemble VFS + 漂移闸**：全程内存 VFS，原子 flush；diff/check clean-regenerate 到临时目录逐字节比对（含 mode/symlink/双向孤儿），against=worktree/head/index，drift → exit 1。manifest 落 `.done-coding/generator/assemble/manifests/<recipeId>.json`（output 外，入版控）。
- **planner 通用冲突判定**：op 经 `effects()` 声明 TargetEffect（kind/category/conflictKey/replacesWhole…），planner 据此通用判混族互斥 + 顺序模拟，新增 op 声明能力即参与，planner/engine 零改（A-NFR-4）。

### 依赖关系

```
done-coding ────────────── 直接依赖所有业务包 ─────────────────┐
    │                                                               │
    ├── create-done-coding ───── 依赖: git, template, utils          │
    ├── @done-coding/cli-generator 依赖: template, utils, lodash.template, json5
    │      ↑ component/mcp 复用其 server-agnostic handler + 原语        │
    ├── @done-coding/cli-component  依赖: cli-generator, utils（薄包装，零业务 JS）
    ├── @done-coding/cli-config ── 依赖: utils（运行时调用 git 包）   │
    ├── @done-coding/cli-extract ─ 依赖: template, utils             │
    ├── @done-coding/cli-git ──── 依赖: utils（+ axios）             │
    ├── @done-coding/cli-inject ── 依赖: utils                       │
    ├── @done-coding/cli-mrm ──── 依赖: utils                       │
    ├── @done-coding/cli-publish ─ 依赖: utils（+ semver）           │
    ├── @done-coding/cli-template  依赖: utils（+ lodash.template；含 marker 引擎）
    └── @done-coding/cli-ai ───── 依赖: utils, openai, mrm          │
         │                          + 8 个子包（提供 /xxx bin 帮助）  │
                                                                     │
    @done-coding/cli-mcp ──────── 依赖: @modelcontextprotocol/sdk, zod, create, cli-generator
    @done-coding/cli-skills ───── 对各 CLI 零运行时依赖（skill 内走 npx <cli>@latest）
         ↓                                                          │
    @done-coding/cli-utils ─────── 无内部依赖 ──────────────────────┘
```

**跨包运行时调用：**
- `config` →（运行时通过 yargs 的 `DC git check reverse-merge`）→ `git`
- `ai` →（/xxx 命令通过 execSyncHijack 调用）→ 各子包 bin（dc-mrm / dc-component / create-done-coding 等）
- `component` →（编译时 import 薄包装）→ `cli-generator` 的 addHandler/modifyHandler/removeHandler/listHandler（batchType 钉死 "component"）
- `mcp` →（编译时 import server-agnostic handler）→ `create` 的 prepare/complete + `cli-generator` 的 add/remove/init/list_questions/list_batches（ctxInit.cwd = 必填 rootDir，[MUST NOT] fallback server cwd）
- `assemble engine` →（execFileSync 本地壳）→ `git`（diff 的 head/index 基准检出 + forceClean 工作树 clean 探测）

其余包间通信仅通过 npm 依赖 + 编译时导出。

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

cli-generator 批次（就近向上 + 全局解析）:
  .done-coding/<type>/      # dc-gen 批次类型（项目 → 父链 → 全局 ~/.done-coding/<type>/）
    ├── index.json          # 批次元数据
    ├── config.json5        # 批次声明（content-free：instanceDir/files[]/strategy/collectEnvDataForm/globalEnvData…）
    └── template/           # 模板源（readFragment/input 的越界基准）

cli-generator assemble（cwd-only，项目本地构建配置）:
  .done-coding/generator/assemble/
    ├── recipes/*.json5     # 配方（base + 有序 ops + output）
    ├── fragments/...       # 碎片（readFragment 越界基准 = fragmentRoot）
    └── manifests/<recipeId>.json  # 生成清单（漂移闸基准 + 孤儿删除依据，入版控）

全局配置:
  ~/.done-coding/config.json   # 全局持久化配置（ASSETS_CONFIG_REPO_URL、AI_CONFIG）
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

### MCP server 数据流（dc-mcp，server-agnostic）

```
AI 客户端 ──(stdio MCP)──▶ dc-mcp（@modelcontextprotocol/sdk）
  server 注册：processCreateByHijack:false（[MUST] 显式关，否则继承 hijack preset 串扰）
  → registerCreateTools/Resources/Prompts + registerGeneratorTools/Prompts

generator Tools（B1 rootDir 必填，ctxInit.cwd=rootDir，[MUST NOT] fallback safeCwd/server cwd）:
  done_coding_gen_list_batches  → listDiscoveredBatches（含 invalid/errors）
  done_coding_gen_list_questions → buildBatchQuestions（纯函数，stdout 洁净，B5）
  done_coding_gen_add / remove / init → addHandler/removeHandler/initHandler（envData 结构化 object，B3）
  关键：handler throw fail-loud（B2，operate 交引擎前按策略守必填字段），表现为 MCP 错误结果而非杀 server 进程

create Resources（隔离重构后）:
  模板列表 = 参数化 Resource（URI 模板 done-coding-create-template-list://{+configPath}，RFC6570）
  → 取资源时传本地绝对 configPath（zod 强制），纯本地读、不联网、无全局 fallback
  → prepare tool 的 templateUrl 由 z.string().optional() 收紧为 z.string() 必填（边界改由 zod schema 结构化强制，非运行时 mode 分支）
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

### ADR-5：AI 模型切换委托 mrm 管理

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | `@done-coding/cli-ai` 的 `/provider`、`/model` 内部委托 `@done-coding/cli-mrm` 的 registry API 实现，ai 包只读 config、所有写入通过 mrm 导出方法 |
| **背景** | ai 包内置的 `model-presets.ts` 与 mrm 功能重复且数据不同步。统一由 mrm 管理服务商/模型，ai 作为消费方。切换流程：switchProvider/switchModel → writeClientConfig → 检查 apiKey。 |

### ADR-6：AI 对话使用 openai SDK + OpenAI 兼容协议

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | `@done-coding/cli-ai` 使用 `openai` npm SDK（^4.x）+ SSE 流式 |
| **背景** | 绝大多数模型厂商支持 OpenAI 兼容协议；SDK 提供 `.stream()` 流式调用、完整 TS 类型、baseURL 可改为任意兼容端点。暂不支持 Anthropic Messages API。 |

### ADR-7：cli-generator 作为 component 的 content-free 泛化（机制层）

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | 抽出 `@done-coding/cli-generator`（bin `dc-gen`）作 content-free 机制层，`dc-component` 退化为其 component 预设的薄包装（batchType 钉死 "component"，零业务 JS） |
| **背景** | 组件之外还有 page/api/store 等大量「具名批次」需求；为每种各写脚手架重复。机制层只认 strategy/files/instanceDir，业务语义（series 算法/扫子目录/命名派生）全下沉各批次 `config.json5`，一套引擎复用。 |
| **权衡** | 引擎需保持 content-free 纪律（[MUST NOT] 渗入业务概念）；component 行为须对旧 `.done-coding/component` 逐字节兼容（gen 重打包 golden diff 为空验收）。 |

### ADR-8：server-agnostic handler + 退出码在 cli 边界落地

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | generator/create 的 handler 签名 `(argv, ctxInit?) => Promise`，内部 `resolveHandlerContext` 走 cli/mcp/test 三模式；库函数 throw fail-loud，[MUST NOT] `process.exit`；退出码（diff/check drift=1）由 cli 边界落 `process.exitCode` |
| **背景** | 同一份 handler 要同时服务 CLI、MCP server（长驻、不可被 `process.exit` 杀）、单测。库内 `process.exit` 会杀掉 MCP 宿主进程；malformed config 须表现为 MCP 错误结果而非崩进程（B2 守卫）。 |

### ADR-9：marker `===` 对称外壳 + markerNs 参数化（强制必填）

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | inject marker 改为对称 `<注释> === <markerNs>:start:<markerKey> === <注释>`；cli-template 的 4 个 marker 函数 markerNs **强制必填**（缺则 fail-loud，无隐式 fallback）；generator 经 `getMarkerNs()` 从 injectInfo.bin 取（单 bin 约束）注入 `dc-gen` |
| **背景** | markerNs 参数化以隔离跨工具命名空间（`dc-gen:` vs 未来 `dc-template:`）；硬编码 NS 会让多工具串扰。强制必填（而非默认值静默回退）确保任何调用方漏传都 fail-loud，杜绝隐式污染。markerNs 须穿透到 item 级（batchCompileHandler 逐项透传），非止于 handler options。 |

### ADR-10：assemble VFS + 原子 flush + manifest 驱动漂移闸

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | assemble 全程在内存 VFS 作业，最后 sibling-temp → rename 原子顶替（任一步 throw 不落盘）；diff/check clean-regenerate 到临时目录逐字节比对（含 mode/symlink/双向孤儿），drift → exit 1；manifest 落 output 外 `.done-coding/generator/assemble/manifests/<recipeId>.json`（入版控），驱动孤儿安全删除 |
| **背景** | 组装多碎片须原子（半成品落盘会污染工作树）；产物入版控后须防手改（漂移闸 CI 守）；删除孤儿须有依据（manifest），不能无界 rm。op 经 `effects()` 声明能力，planner 通用判冲突/顺序，新增 op 零改 planner（A-NFR-4）。 |

### ADR-11：MCP 隔离边界由运行时 mode 分支改为 zod schema 结构化强制

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | create MCP 删除 `done_coding_list_create_templates` tool，模板列表改为参数化 Resource（取资源时传本地 configPath，纯本地不联网）；prepare 的 templateUrl 由 optional 收紧为必填；隔离边界从 `ctx.mode==="mcp"` 运行时 if-guard 改为 tool 层 zod schema 强制 |
| **背景** | 运行时 mode 分支可测性差、边界隐式；改由 zod schema 在工具调用入口结构化强制——MCP 永远到不了「无显式 templateUrl 读模板列表」的路径，从结构上杜绝远程/全局 fallback 读取。 |

### ADR-12：destructive 入口可疑根守卫（安全收尾硬化）

| 项 | 内容 |
|---|---|
| **状态** | `活跃` |
| **决策** | 仅在 destructive 入口（assemble `runBuild` 整目录替换+孤儿删除 / gen `removeEmptyInstanceDir`）守「可疑根」（cwd = 家目录本体 / 文件系统根 → throw），`--allow-dangerous`/`allowDangerous` 显式逃逸；删除前 realpath 双解 + isInside 边界校验；flush 前大小写折叠冲突 fail-loud |
| **背景** | `safeCwd()` 防崩会回落到家目录/根，destructive 操作落此会真删用户家目录。守卫放 destructive 入口而非 `safeCwd()`（后者契约是「永不崩、总回落可用目录」，8+ 非 destructive 消费者依赖之）。`allowDangerous` 同时从 argv 与 ctxInit 取（programmatic/server 调用也生效）。 |

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
| `cli-generator/src/types/index.ts` 类型契约 | 高 | Strategy/FileEntry/BatchConfig/EnvContext 是 Wave B 不可再改契约，下游（component 薄包装/mcp/assemble）以此为准，回改会破坏 content-free 边界 |
| cli-template 4 个 marker 函数签名 | 高 | markerNs 强制必填；漏传 fail-loud。改这些会同时影响 generator inject/modify/remove 与 marker on-disk 格式（变更须重生 golden 基准） |
| assemble engine destructive 入口（runBuild flush） | 高 | 整目录替换 + 孤儿删除，须经可疑根守卫 + realpath/isInside 边界；改 flush/manifest 逻辑可能误删用户文件 |
| `getMarkerNs()` 单 bin 约束 | 中 | 从 injectInfo.bin 取 NS，包出现多 bin 会 fail-loud；新增 bin 需重新设计 NS 取法 |

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
| 直接用 `process.cwd()` | cwd 被删/不可访问时抛 `uv_cwd`(EPERM) 崩溃 | [MUST] 用 `@done-coding/cli-utils` 的 `safeCwd()`（回落 PWD → homedir） |
| generator 引擎里写死 component/entry/index 业务概念 | 破坏 content-free 边界，泛化失效 | [MUST] 业务语义下沉 `config.json5`；引擎只认 strategy/files/instanceDir |
| 在 MCP server 可达的 handler 里 `process.exit()` | 杀掉长驻 dc-mcp 进程 | [MUST] throw fail-loud；退出码在 cli 边界落 `process.exitCode` |
| MCP 工具 fallback 到 server 进程 cwd | 落错目录（生成到 server 安装位置而非用户项目） | [MUST] rootDir 必填，ctxInit.cwd=rootDir，[MUST NOT] fallback safeCwd |
| inject 同一文件同 markerKey 多次 / 调 marker 函数漏传 markerNs | add 幂等替换错块 / remove 只删首个 / 跨工具 NS 串扰 | [MUST] 各 inject 项设不同 markerKey；marker 函数 markerNs 必填（缺即 fail-loud） |
| 在工作树原地比对 assemble 产物 | 污染工作树 + 漂移闸不可信 | [MUST] clean-regenerate 到临时目录再 diff（A5③ 漂移闸基准） |

## 10. 技术债务与风险

| 债务 | 优先级 | 说明 |
|---|---|---|
| cli-generator / cli-mcp / cli-skills 未发布（version 0.0.0） | 中 | 源码已交付且测试绿，但 `npx`/全局安装尚不可用；`dc-gen`/`dc-mcp`/`dc-cli-skills` 也未并入主 `DC` 子命令树（仅 `DC component` 经薄包装接通） |
| 测试覆盖不均：generator/template/mcp/cli-skills 有实质 vitest 套件（generator 含 golden/漂移闸回归，~299 测试），其余子包仍仅有配置 | 中 | 核心机制层已硬覆盖；老业务子包（git/publish/config 等）测试用例仍稀疏 |
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

- 正常模式：`outputConsole`（chalk 封装）：`.info()`、`.stage()`、`.skip()`、`.success()`、`.error()`、`.warn()`、`.debug()`
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
- AI API Key：持久化到 `~/.done-coding/config.json` 的 `AI_CONFIG` 字段（含 model、apiKey、baseUrl）
- AES 加密：`@done-coding/cli-utils` 提供 `encryptAES`/`decryptAES`（用于配置中的敏感值）

### 包间通信模式

| 通信方式 | 使用场景 |
|---|---|
| npm workspace 依赖 | 所有子包 depend on `@done-coding/cli-utils` |
| yargs 子命令注册 | cli 主包注册所有子包的 `createAsSubcommand()` |
| 运行时 child_process | `config` 调用 `git check reverse-merge`；`assemble engine` 经 execFileSync 调 git（diff 基准检出 / clean 探测） |
| server-agnostic handler 直 import | `component`/`mcp` 编译时 import `cli-generator` 的 handler + 原语（`(argv, ctxInit?)=>Promise`，三模式 cli/mcp/test） |
| MCP stdio | `dc-mcp` 经 `@modelcontextprotocol/sdk` 把 create/generator 暴露为 Tools/Resources/Prompts |
| 构建时 injectInfo | `@done-coding/cli-inject` 在构建时将元数据写入各包的 `injectInfo.json` |
