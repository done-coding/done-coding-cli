# 技术架构快照

> 最后更新：2026-04-26
> 关联任务：架构初始化 — 补齐 TECH_SNAPSHOT.md + 用户校正（占位符机制 / 双模式）

---

## 1. 系统上下文

本项目是一个 **NPM Node.js CLI 模板工程**，用于快速创建可发布的 npm 命令行工具包。

**系统边界：**
- 输入：用户在终端执行 CLI 命令（支持主命令和子命令模式）
- 输出：终端标准输出（stdout）、错误输出（stderr）
- 部署形态：通过 npm registry 发布为 ESM 包，用户通过 `npx` 或全局安装后使用

**外部依赖：**
| 依赖 | 类型 | 用途 |
|---|---|---|
| `@done-coding/cli-utils` | 运行时 | CLI 框架封装（包装 yargs），提供 `createMainCommand`、`createSubcommand`、类型定义 |
| npm registry | 部署 | 包发布目标（`https://registry.npmjs.org/`） |
| `create-done-coding` | 脚手架 | 项目生成时将 `${variableName}` 模板占位符替换为实际值 |
| `@done-coding/cli-inject` | 开发时 | 构建阶段生成 `src/injectInfo.json`（含版本号等信息），随包发布。解决版本号在开发时无法预知的问题 |
| `@done-coding/cli-publish` | 开发时 | npm 发布辅助脚本 |

**集成点与协议：**
- CLI 入口：`bin` 字段指向 `es/cli.mjs`，运行时需 Node >= 18
- 包入口：`exports` 字段指向 `es/index.mjs`（ESM），类型声明指向 `types/index.d.ts`
- 无外部 API、无数据库依赖、无服务端组件

---

## 2. 技术选型

| 类别 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 运行时 | Node.js | >= 18.0.0 | 最低支持版本 |
| 语言 | TypeScript | ^5.8.3 | 严格模式，ES2020 目标 |
| 模块系统 | ESM | — | `"type": "module"`，输出 `.mjs` |
| 构建工具 | Vite | ^5.0.10 | lib mode，输出 ESM 格式 |
| 类型声明生成 | vite-plugin-dts | ^3.7.0 | 支持 rollupTypes（生产构建时合并） |
| 包管理器 | pnpm | (lockfile 记录) | 使用 pnpm-lock.yaml |
| 测试框架 | Vitest | ^1.6.1 | globals 模式，v8 覆盖率 |
| Lint（代码） | ESLint | ^8.49.0 | alloy 配置 + TypeScript 插件 |
| Lint（文件名） | ls-lint | ^2.2.3 | kebab-case / camelCase / PascalCase 校验 |
| 格式化 | Prettier | ^3.0.3 | 2 空格缩进，单引号，尾逗号 |
| Git hooks | Husky | ^8.0.3 | pre-commit + commit-msg |
| 暂存区检查 | lint-staged | ^12.5.0 | 配合 husky 在 pre-commit 时触发 |
| 提交规范 | commitlint | ^16.3.0 | angular conventional commits |
| 变更日志 | conventional-changelog | ^5.1.0 | angular 格式生成 CHANGELOG |
| CLI 框架（运行时） | @done-coding/cli-utils | ^0.7.4 | yargs 封装，提供主/子命令创建 API |

---

## 3. 架构风格与模式

**整体架构方法：** 模块化单体（单包），支持两种部署模式：

| 模式 | 说明 | 代码质量工具 |
|---|---|---|
| **独立项目**（当前分支 `template/standalone`） | 独立的 npm 包仓库，自包含所有工程配置 | eslint、prettier、ls-lint、commitlint、husky 等项目自行管理 |
| **大仓子包**（参考分支 `template/workspace`） | 作为 monorepo 中的子包存在 | 上述工具由大仓根目录统一管理，子包无需单独配置 |

`template/workspace` 分支展示了作为大仓子包时的精简形态。

**关键设计模式：**

| 模式 | 应用位置 | 说明 |
|---|---|---|
| **模板占位符替换** | `package.json` 等 | 项目使用 `${organization}`、`${name}` 等占位符作为模板。由 `create-done-coding` 脚手架在**项目生成时**替换为实际值，非 `dc-inject` 的职责 |
| **构建时版本注入** | `src/injectInfo.json` + `@done-coding/cli-inject` | 包的版本号在开发时无法预知。`dc-inject` 在版本确定后、发布前的**构建阶段**生成含版本等运行时信息的 `injectInfo.json`，随包发布供运行时读取 |
| **Subcommand Pattern** | `src/handlers/` | 每个子命令独立一个 handler 文件，包含 `commandCliInfo`（命令元数据）和 `handler`（处理函数） |
| **Factory / Conditional Construction** | `src/main.ts` | `createCommand()` 创建主命令，`createAsSubcommand()` 创建子命令，同一套逻辑通过参数区分 |
| **Switch Router** | `src/handlers/index.ts` | `handler()` 通过 `SubcommandEnum` 枚举路由到各子命令处理器，供外部程序化调用 |
| **Barrel Export** | `src/index.ts` | 统一导出包的所有公开 API |
| **Path Utility** | `src/utils/path.ts` | 集中管理模块配置路径，通过 `injectInfo` 动态拼接 |

**编程范式：**
- 函数式风格，无 Class
- 异步函数（async/await）
- TypeScript 枚举用于命令路由
- JSON 作为静态数据载体

---

## 4. 模块/组件结构

### C4 Level 2 — 包内部容器

```
template-npm-node-cli
├── CLI 入口层（cli.ts）
│   └── 调用 main.ts → createCommand()
│
├── 命令工厂层（main.ts）
│   ├── createCommand() —— 主命令
│   └── createAsSubcommand() —— 作为其他 CLI 的子命令
│
├── 命令路由层（handlers/index.ts）
│   ├── commandCliInfo —— CLI 元数据（版本、描述、子命令注册）
│   └── handler() —— 程序化调用路由
│
├── 命令实现层（handlers/test.ts）
│   ├── getOptions() —— 命令选项定义
│   ├── handler() —— 命令处理逻辑
│   └── commandCliInfo —— 子命令注册信息
│
├── 类型层（types/index.ts）
│   ├── SubcommandEnum —— 命令枚举
│   └── TestOptions —— 命令选项接口
│
└── 工具层（utils/path.ts）
    └── 配置路径常量
```

### C4 Level 3 — 依赖关系

```
cli.ts ──→ main.ts ──→ handlers/index.ts ──→ handlers/test.ts
             │                                      │
             │                                      ├── types/index.ts
             │                                      └── @done-coding/cli-utils
             │
             ├── @done-coding/cli-utils
             └── injectInfo.json

index.ts ──→ handlers/index.ts
         ──→ main.ts
         ──→ types/index.ts

handlers/index.ts ──→ handlers/test.ts
                 ──→ types/index.ts
                 ──→ injectInfo.json
                 ──→ @done-coding/cli-utils

utils/path.ts ──→ injectInfo.json
```

**模块间通信：**
- 所有模块间通过 TypeScript import/export 直接耦合
- 公共 API 通过 `src/index.ts` barrel 导出
- 无事件总线、无 DI 容器、无消息队列

**构建产物映射：**
| 源文件 | 输出 | 角色 |
|---|---|---|
| `src/index.ts` | `es/index.mjs` | 包主入口（API） |
| `src/cli.ts` | `es/cli.mjs` | CLI 入口（bin） |
| 所有 .ts 文件 | `types/*.d.ts` | 类型声明（rollup 合并） |

---

## 5. 数据架构

**核心数据模型：**

```typescript
// injectInfo.json 结构（模板/开发阶段含占位符，dc-inject 构建后替换为实际值）
{
  name: string;           // 包名（构建后 @${organization}/${name} → 实际值）
  version: string;        // 版本号（构建后 0.0.0 → 实际发布版本号——这是 dc-inject 的核心用途）
  description: string;    // 描述（构建后占位符 → 实际值）
  bin: Record<string, string>;  // CLI 入口映射（构建后占位符 → 实际值）
  cliConfig: {
    namespaceDir: string;  // 用户级配置目录（构建后 .${organization} → 实际值）
    moduleName: string;    // 模块名称（构建后 ${name} → 实际值）
  }
}

// 子命令枚举
enum SubcommandEnum { TEST = "test" }

// 命令选项
interface TestOptions { xx: string }
```

**数据流模式：**

```
用户输入（CLI argv）
  → @done-coding/cli-utils（yargs 解析）
  → SubcommandEnum 路由
  → handler(argv: CliHandlerArgv<TOptions>)
  → console.log 输出
```

**状态管理方案：** 无状态管理。CLI 工具为一次性执行模式，无持久化运行时状态。

**持久化策略：**
- 用户级配置路径：`~/${namespaceDir}/${moduleName}.json`（由 `@done-coding/cli-utils` 管理，当前代码仅定义了路径常量）
- 无本地数据库、无缓存层

---

## 6. 设计原则与约定

**编码标准：**

| 规则类别 | 工具 | 具体约定 |
|---|---|---|
| 文件名 | ls-lint | `.ts` 文件 kebab-case（use[A-Z]*.ts 例外用 camelCase）、`.json` kebab-case、目录 kebab-case |
| 代码风格 | ESLint（alloy） | TypeScript 推荐规则，import 排序，正则校验 |
| 格式化 | Prettier | 80 字符换行、2 空格缩进、单引号、尾逗号、LF 换行 |
| 提交信息 | commitlint | Angular Conventional Commits（feat/fix/chore 等） |
| TypeScript | tsconfig | strict 模式、noUnusedLocals、isolatedModules、ES2020 目标 |

**路径别名：** `@/` → `src/`

**命名约定（推断）：**
- 枚举：PascalCase 后缀 Enum（如 `SubcommandEnum`）
- 接口：PascalCase 后缀 Options（如 `TestOptions`）
- 函数：camelCase（如 `createCommand`、`getOptions`）
- 常量：UPPER_SNAKE_CASE（如 `MODULE_CONFIG_RELATIVE_PATH`）

**项目特定模式：**
- 每个子命令 handler 导出三件套：`handler`、`commandCliInfo`、`getOptions`
- handler 路由文件同时提供 CLI 元信息（`commandCliInfo`）和程序化调用入口（`handler`）
- `injectInfo.json` 由 `dc-inject` 在构建时生成，包含版本号等运行时元信息，是连接构建与运行时的关键文件

---

## 7. 架构决策记录（ADR）

### ADR-1: 选择 Vite 作为构建工具
- **状态：** 活跃
- **背景：** 需要将 TypeScript 源码构建为 ESM 格式的 npm 包
- **决策：** 使用 Vite（lib mode），而非 tsc 或 rollup 直接
- **权衡：** Vite 提供开箱即用的开发热构建（hotBuild），比 tsc 更快；内置 tree-shaking；配合 vite-plugin-dts 生成类型声明
- **备选方案：** tsc 直接编译——更简单但缺少 HMR 和优化

### ADR-2: 两层占位符机制
- **状态：** 活跃
- **背景：** 项目作为模板需要支持变量替换，同时包版本号在开发阶段无法预知
- **决策：** 分两层处理——
  - **第一层（项目生成时）：** `create-done-coding` 脚手架将 `${organization}`、`${name}` 等模板占位符替换为实际值
  - **第二层（构建时）：** `@done-coding/cli-inject`（`dc-inject`）在 `prebuild` 阶段生成 `src/injectInfo.json`，包含版本号等运行时信息，随包发布
- **权衡：** `dc-inject` 解决了"版本号只有构建时才能确定"的时序问题，`injectInfo.json` 让运行时代码能读取包元信息；但增加了一个构建步骤和 devDependency
- **备选方案：** 运行时读取 `package.json`——但 `package.json` 可能不被包含在 `files` 中或路径不可靠

### ADR-3: 不使用 express/yargs 直接依赖，封装在 @done-coding/cli-utils
- **状态：** 活跃
- **背景：** CLI 需要命令解析框架
- **决策：** 依赖封装层 `@done-coding/cli-utils`，而非直接依赖 yargs
- **权衡：** 统一公司内部 CLI 构建模式；但引入了对外部私有包的依赖

### ADR-4: ESM only
- **状态：** 活跃
- **背景：** npm 包输出格式选择
- **决策：** 仅输出 ESM 格式（`"type": "module"`），不输出 CJS
- **权衡：** 面向未来，减少双格式维护成本；但限制了不支持 ESM 的旧版 Node.js 用户

---

## 8. 质量属性与非功能需求

| 属性 | 当前状态 | 说明 |
|---|---|---|
| **性能** | 低优先级 | CLI 为一次性短时执行，无性能瓶颈 |
| **安全性** | 基础 | 无认证/授权需求，无敏感数据处理 |
| **可扩展性** | 模板化 | 通过 SubcommandEnum 枚举 + 新 handler 文件扩展命令；通过 barrel export 扩展公开 API |
| **可维护性** | 良好 | 模块职责清晰，文件粒度细（每个文件 < 50 行） |
| **可靠性** | 待加强 | 无测试用例（`src/` 下无 `*.test.ts` 或 `*.spec.ts` 文件） |
| **兼容性** | Node >= 18 | 构建目标 node16，源码目标 ES2020 |
| **可移植性** | 良好 | 纯 Node.js，无原生依赖 |

---

## 9. 注意事项与常见陷阱

1. **[MUST] 不要手动修改 `es/`、`lib/`、`types/` 目录下的文件。** 这些是构建产物，不在版本控制中（`.gitignore` 已排除），任何手动修改都会在下次构建时被覆盖。

2. **[MUST] `src/injectInfo.json` 由 `dc-inject` 在构建阶段生成，不要手动编辑。** 该文件包含版本号等运行时信息，在 `prebuild` 钩子中自动生成。开发阶段（`pnpm dev`）不会触发 `prebuild`，因此 hotBuild 模式下该文件可能不存在或内容为占位符状态。

3. **[MUST] 新增子命令需同时更新三处：**
   - `src/types/index.ts` —— 在 `SubcommandEnum` 中新增枚举值
   - `src/handlers/<name>.ts` —— 创建新的 handler 文件
   - `src/handlers/index.ts` —— 在 `handler()` switch 中添加 case，在 `commandCliInfo.subcommands` 中注册

4. **开发模式注意事项：** `pnpm dev` 使用 `-m hotBuild` 模式，不会 rollup 类型声明，适合快速迭代。发布前需运行 `pnpm build` 进行生产构建。

5. **prebuild 脚本：** `pnpm build` 前会自动执行 `dc-inject`，如果注入失败（如缺少环境配置），构建会中断。

6. **路径别名 `@/`：** 在 Vite 构建中可用，但在 tsc 原生编译中不可用。项目中未使用 tsc 直接编译，因此不受影响。

7. **独立项目 vs 大仓子包：** 当前分支（`template/standalone`）为独立项目形态，包含完整的 eslint/prettier/ls-lint/commitlint/husky 配置。若作为 monorepo 子包使用，这些工具应由大仓根目录统一管理，子包可移除相关配置。参考 `template/workspace` 分支了解子包形态。

---

## 10. 技术债务与风险

| 条目 | 优先级 | 说明 |
|---|---|---|
| **缺少测试** | 高 | `src/` 下无任何测试文件。`vitest` 已安装并配置但未被使用。新功能需补齐测试。 |
| **eslint 配置文件缺失** | 中 | 项目根目录未找到 `.eslintrc.*` 或 `eslint.config.*` 文件，但 `devDependencies` 中已安装所有必要的 eslint 插件。`CLAUDE.md` 中列出了 `eslint --fix .` 命令。可能是模板占位符，待首次 init 时生成。 |
| **硬编码路径** | 低 | `src/utils/path.ts` 中的路径常量依赖 `injectInfo.json` 中的占位符，注入后才能使用 |
| **文档不完整** | 中 | README.md 仅包含模板占位符片段，缺少实际的使用说明、API 文档、贡献指南 |
| **@done-coding/cli-utils 外部依赖风险** | 低 | 核心 CLI 能力依赖一个内部/私有包，若该包有破坏性变更或不可用，需重构命令注册逻辑 |
| **lib 输出目录用途不明** | 低 | `package.json` 的 `files` 中包含 `lib`，但 `vite.config.ts` 只输出 ESM 到 `es/`，`lib/` 目录未在构建配置中出现，可能是历史遗留或 CJS 预留 |

---

## 11. 开发工作流

### 环境设置

```bash
# 确保 Node >= 18
node -v

# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装依赖
pnpm install
```

### 日常开发命令

| 操作 | 命令 | 说明 |
|---|---|---|
| 开发模式 | `pnpm dev` | Vite watch 模式 + hotBuild，快速迭代 |
| 生产构建 | `pnpm build` | 完整构建：注入 + Vite build + rollup 类型声明 |
| 运行测试 | `pnpm test` | 运行 vitest（当前无测试文件） |
| 覆盖率 | `pnpm coverage` | vitest run --coverage（v8 provider） |
| Lint（代码） | `npx eslint --fix .` | 代码质量检查 |
| 清理 | `rm -rf es lib types` | 清理构建产物 |

### Git Hooks 流程

```
git commit
  → pre-commit: lint-staged
    → ls-lint（文件名检查，仅 src/ 下文件）
    → eslint --fix（*.ts 等）
    → prettier --write（*.ts 等）
  → commit-msg: commitlint（校验 conventional commit 格式）
```

### CI/CD（待确认）

项目当前未发现 CI/CD 配置文件（无 `.github/workflows/`、`.gitlab-ci.yml`、`Jenkinsfile` 等）。npm 发布通过 `pnpm push` 调用 `@done-coding/cli-publish` 执行。

### 发布流程

```bash
# 1. 确保构建通过
pnpm build

# 2. 发布到 npm
pnpm push   # 内部调用 dc-publish -m npm
```

---

## 12. 横切关注点

### 日志/监控

- CLI 输出通过 `console.log`，无结构化日志库
- 无远程监控、无 APM 集成
- 错误通过 `throw new Error()` 直接抛出

### 错误处理策略

- 子命令路由中未知命令抛出 `Error`（` handlers/index.ts` switch default 分支）
- 依赖 `@done-coding/cli-utils` 内部的 yargs 错误处理（参数校验、帮助信息等）
- 无全局错误边界、无优雅降级

### 认证/授权

- 无认证/授权需求。CLI 为本地执行工具。

### 国际化

- 当前仅中文注释，命令行描述使用中文
- 无 i18n 框架或翻译机制

### 无障碍

- 不适用（CLI 工具无 GUI 界面）

### 配置管理

- 用户级配置路径：`~/.${organization}/${name}.json`
- 无环境变量配置（当前未使用 `process.env`）
- 模板占位符（`${variableName}`）由 `create-done-coding` 脚手架在项目生成时替换
- 构建时版本信息由 `dc-inject` 生成 `src/injectInfo.json`，随包发布

---

> **快照维护说明：** 本文档应在每次涉及架构变更的任务归档时更新（覆盖式更新，不追加历史）。若发现遗漏或不准确之处，请提交校正。
