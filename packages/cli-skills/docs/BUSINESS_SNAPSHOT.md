# 业务快照

> 最后更新：2026-04-26
> 关联任务：初始化补齐业务快照文档

## 1. 业务领域与背景

本项目是一个 **npm 包脚手架模板**，属于 Done Coding 组织的内部基础设施工具链。它提供了创建 Node.js CLI 工具 npm 包的标准化起点，目标是以模板方式消除新项目初始化过程中的重复工程配置工作，使开发者可以专注于业务逻辑实现。

### 核心业务问题与价值主张

- **问题**：每次新建 CLI npm 包都需要重新配置 TypeScript、Vite、ESLint、Prettier、Husky、commitlint、ls-lint、vitest 等工具链，耗时且容易产生不一致。
- **解决方案**：通过模板项目预置全套工程配置，配合 `dc-inject`（@done-coding/cli-inject）工具在脚手架阶段注入项目特定信息（组织名、包名、描述等），实现一行命令完成项目初始化。
- **价值主张**：标准化 + 零配置启动，确保组织内所有 CLI 包统一代码风格、目录结构、构建流程和发布规范。

### 关键业务术语表

| 术语 | 说明 |
|---|---|
| `dc-inject` | Done Coding 组织的模板注入工具（@done-coding/cli-inject），在 prebuild/predev 阶段将占位符替换为实际项目值 |
| `dc-publish` | Done Coding 组织的 npm 发布工具（@done-coding/cli-publish），封装 npm publish 流程 |
| `@done-coding/cli-utils` | Done Coding 组织的 CLI 工具库，提供 createMainCommand、createSubcommand、类型定义等 CLI 基础设施 |
| 占位符（Placeholder） | 模板中以 `${variableName}` 形式存在的变量，由 dc-inject 在构建前替换为实际值 |

---

## 2. 用户画像与角色

### 主要用户类型

| 角色 | 描述 | 核心目标 |
|---|---|---|
| **Done Coding 内部开发者** | 需要创建新 CLI npm 包的开发人员 | 基于模板快速初始化项目，遵循组织规范，减少配置时间 |
| **模板维护者** | 负责维护和演进模板项目的人员（如 JustSoSu） | 保持模板与组织最佳实践同步，确保产出包的质量一致性 |
| **最终 npm 消费者** | 安装和使用基于此模板产出的 CLI 工具包的终端用户 | 获得功能完善、行为一致的 CLI 工具 |

### 外部系统/角色

- **npm Registry**（https://registry.npmjs.org/）：包的发布目标，包访问级别为 `public`
- **Git 仓库**：模板所在 git 仓库地址，通过占位符 `${repositoryUrl}` 注入

---

## 3. 核心业务流程

### 3.1 模板初始化流程（脚手架阶段）

```
1. 开发者从模板仓库创建新项目
2. dc-inject 工具读取 src/injectInfo.json 中的占位符定义
3. dc-inject 将占位符替换为实际项目信息（组织名、包名、描述等）
4. 开发者执行 pnpm install 安装依赖
5. 项目可立即投入开发
```

### 3.2 日常开发流程

```
1. pnpm dev  → 启动 Vite 热构建模式（watch），开发时实时输出
2. 编写 src/ 下业务代码
3. Git commit → Husky pre-commit hook 触发 lint-staged（eslint + prettier + ls-lint）
4. Git commit → Husky commit-msg hook 触发 commitlint 校验 commit message 格式
5. pnpm test  → 运行 vitest 测试
```

### 3.3 构建与发布流程

```
1. pnpm build  → vite build 生成 es/（ESM 输出）、lib/、types/（dts 类型声明）
2. pnpm log    → conventional-changelog 生成 CHANGELOG.md
3. pnpm push   → dc-publish 执行 npm 发布
```

### 3.4 作为子命令集成流程

```
外部 CLI 工具可通过 createAsSubcommand() 将本包作为子命令集成：
1. 外部包 import { createAsSubcommand } from '此包'
2. 注入到外部 CLI 的命令树中
```

---

## 4. 功能清单

### 4.1 CLI 命令框架

| 功能 | 状态 | 说明 |
|---|---|---|
| 主命令（Main Command） | `活跃` | 通过 `createCommand()` 创建独立 CLI 入口（bin 字段指向 `es/cli.mjs`） |
| 子命令注册 | `活跃` | 基于 @done-coding/cli-utils 的 createSubcommand 模式统一注册子命令 |
| test 示例子命令 | `活跃` | 演示性质，展示子命令的标准写法（options、handler、describe） |
| 作为子命令导出 | `活跃` | 通过 `createAsSubcommand()` 导出，允许被其他 CLI 作为子命令集成 |
| 命令分发路由 | `活跃` | `handler()` 函数按 SubcommandEnum 枚举路由到对应处理器 |

### 4.2 库导出（Programmatic API）

| 功能 | 状态 | 说明 |
|---|---|---|
| handler 导出 | `活跃` | 外部可通过 `import { handler }` 直接调用子命令处理逻辑 |
| createAsSubcommand 导出 | `活跃` | 外部 CLI 可集成此包子命令 |
| 类型导出 | `活跃` | TypeScript 类型定义随包发布（types/index.d.ts） |

### 4.3 构建与代码质量基础设施

| 功能 | 状态 | 说明 |
|---|---|---|
| Vite 构建 | `活跃` | 双入口（src/index.ts + src/cli.ts），输出 ESM 格式 |
| TypeScript 编译 | `活跃` | 通过 vite-plugin-dts 自动生成 .d.ts 声明文件 |
| ESLint | `活跃` | 基于 eslint-config-alloy + TypeScript 规则 |
| Prettier | `活跃` | 代码格式化，含 postinstall 自动格式化 pnpm-lock.yaml |
| ls-lint | `活跃` | 文件命名规范检查（kebab-case / camelCase / PascalCase） |
| Husky + lint-staged | `活跃` | Git 提交前自动执行 lint 和格式化 |
| commitlint | `活跃` | Angular Conventional Commits 规范校验 |
| vitest | `活跃` | 单元测试框架，含 v8 coverage 报告 |
| conventional-changelog | `活跃` | 基于 commit 消息自动生成 CHANGELOG |

### 4.4 发布与部署

| 功能 | 状态 | 说明 |
|---|---|---|
| npm 发布（dc-publish） | `活跃` | 统一发布入口，access 为 public |
| CHANGELOG 生成 | `活跃` | 基于 conventional-changelog |

### 功能间依赖关系

```
CLI 命令框架 ──依赖──> @done-coding/cli-utils
模板注入     ──依赖──> @done-coding/cli-inject
npm 发布     ──依赖──> @done-coding/cli-publish
构建系统     ──依赖──> Vite + vite-plugin-dts
代码质量     ──依赖──> ESLint + Prettier + ls-lint + commitlint + husky
```

---

## 5. 业务规则与约束

### 5.1 环境约束

- [MUST] Node.js >= 18.0.0
- [MUST] 使用 pnpm 作为包管理器
- [MUST] 输出格式为 ESM（`"type": "module"`）
- [MUST] npm 发布为 public access（`"access": "public"`）

### 5.2 代码规范约束

- [MUST] 提交消息遵循 Angular Conventional Commits 规范（由 commitlint 强制执行）
- [MUST] `/src` 下文件名遵循 ls-lint 规则：
  - 目录：kebab-case / lowercase
  - hooks（`use[A-Z]*.ts`）：camelCase
  - 其他 .ts 文件：kebab-case / lowercase
  - .tsx / .vue：PascalCase
- [MUST NOT] 在 Git 提交时破坏 lint-staged 检查（eslint --fix + prettier --write + ls-lint）

### 5.3 构建产物约束

- [MUST] 构建产物目录为 `es/`、`lib/`、`types/`
- [MUST] npm 发布仅包含 `es`、`lib`、`types` 三个目录（`files` 字段指定）
- [MUST] bin 入口指向 `es/cli.mjs`，文件名格式为 `${organizationAbr}-${name}`
- [MUST NOT] 打包 Node.js 内置模块（`builtinModules` 全部 external）

### 5.4 发布约束

- [MUST] prebuild/predev 阶段自动执行 `dc-inject` 注入占位符
- [MUST] prepack 阶段执行 `pnpm build`

### 5.5 合规要求

- 许可证：MIT
- 无隐私/安全合规的硬性要求（组织内部工具链）
- `sideEffects: false` 声明，支持 tree-shaking

---

## 6. 成功指标与 KPI

| 指标 | 衡量方式 | 说明 |
|---|---|---|
| 模板可用性 | 初始化到可开发的时间 | 目标：开发者拿到模板后 5 分钟内可开始编写业务代码 |
| 质量一致性 | ESLint/Prettier/ls-lint 零违规 | 模板自身应通过所有 lint 检查 |
| 构建成功率 | `pnpm build` 退出码为 0 | 零配置构建 |
| 测试覆盖率 | vitest coverage 报告 | 模板自身应有基准测试覆盖率（待建立目标值） |
| 发布成功率 | `pnpm push` 退出码为 0 | 基于此模板产出的包应能正常发布到 npm |

---

## 7. 已知业务债务

| 债务项 | 影响 | 优先级 | 备注 |
|---|---|---|---|
| 占位符模板依赖 dc-inject 工具 | 模板无法独立使用，必须配合 Done Coding 工具链 | 低（属于设计意图） | dc-inject 是组织内部工具，模板仅为组织内部使用 |
| test 子命令仅为占位示例 | 开发者需自行替换或删除，无实际业务功能 | 低 | 示例模板的标准模式 |
| 无测试文件 | 当前项目中找不到实际测试用例，vitest 框架已配置但未编写测试 | 中 | `test/` 目录不存在，模板自身缺乏测试验证 |
| 业务功能极度简化 | src/ 中为极简示例代码，覆盖真实 CLI 场景的引导不足 | 中 | 需要评估是否添加更实际的示例（如文件读写、HTTP 请求等常见 CLI 模式） |
| 文档示例使用占位符 | README.md 中的包名、描述均为占位符，对外不可读 | 低 | dc-inject 注入后自动替换 |
| Node 最低版本要求（18）可能偏旧 | Node 18 的 LTS 生命周期有限 | 低 | 待评估是否需要升级到 Node 20+ |
