# @done-coding/cli-generator

通用具名批次生成器（content-free 机制层）—— 把"按一份配置批量生成/管理具名实例"抽象成与具体内容无关的引擎，并提供模板组装（assemble）能力。`dc-component` 即本包的 component 预设薄包装。

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-generator.svg)](https://www.npmjs.com/package/@done-coding/cli-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-generator
# 或
pnpm add @done-coding/cli-generator
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g done-coding
# 然后使用
DC generator [command]
```

## 快速开始

```bash
# 独立使用（bin）
dc-gen <command> [<type>] [<name>] [options]

# 作为主 CLI 的子命令
DC generator <command> [<type>] [<name>] [options]
done-coding generator <command> ...

# 查看帮助
dc-gen --help
```

## 核心概念

- **content-free 机制层**：本包不内置任何业务内容；"生成什么"由项目本地的**批次配置**（`<projectRoot>/.done-coding/<type>/`）描述，引擎只负责发现配置、收集变量、按策略物化/注入/回滚。
- **批次（type）**：一类可复用的具名生成能力（如 `component`、`page`、`store`…），运行时以 positional `<type>` 指定，可就近向上 + 全局解析。
- **实例（name）**：某批次下的一个具名产物。
- **marker 块**：注入式产物用 `dc-gen:start:<key>` / `dc-gen:end:<key>` 哨兵包裹，支持原位幂等替换与健壮回退。
- **assemble**：以**配方（recipe）+ 碎片（fragment）**物化一棵产物树，内置 VFS 原子写盘、冲突检测与**漂移闸**（clean regenerate → diff，任意漂移即 fail）。

## 命令一览

| 命令                                       | 说明                                             |
| ------------------------------------------ | ------------------------------------------------ |
| `dc-gen add <type> <name>`                 | 添加实例                                         |
| `dc-gen add <type> --list-questions`       | 列出该批次的问题清单                             |
| `dc-gen modify <type> <name>`              | 原位修改 insert 块的值                           |
| `dc-gen remove <type> <name>`              | 移除实例                                         |
| `dc-gen list [type]`                       | 列出批次（无 `type`）/ 某批次的实例（带 `type`） |
| `dc-gen init <type>`                       | 初始化一个批次骨架                               |
| `dc-gen assemble plan\|build\|diff\|check` | 模板组装：计划 / 物化 / 比对 / 漂移闸            |

> 用法为 **verb-first**（动词在前、`<type>` 在后），子命令形式同理：`done-coding generator add <type> <name>`。

## 配置目录布局

项目本地配置统一落项目根 `.done-coding` 命名空间：

```
<projectRoot>/.done-coding/
  <type>/...                       # 批次配置（如 component），就近向上 + 全局解析
  generator/assemble/
    recipes/*.json5                # 配方
    fragments/...                  # 碎片（越界基准 = fragmentRoot）
    manifests/<recipeId>.json      # 生成清单（漂移闸基准，入版控）
```

- 批次层（`.done-coding/<type>/`）：具名可复用能力，**就近向上 + 全局**解析。
- assemble 层（`.done-coding/generator/assemble/`）：项目本地构建配置，**cwd-only**（在项目根执行）。

## 运行时安全

涉文件系统的操作内置三道守卫：

- **可疑根拒绝**：destructive 入口拒绝家目录本体 / 文件系统根，逃逸需显式 `--allow-dangerous` opt-in。
- **塌路径防护**：删除 / 整体写盘前校验目标在受控根内且 ≠ 受控根。
- **realpath 双解**：涉 symlink 可逃逸路径先 `realpath` 双解再比较，杜绝字面前缀放行。

## 编程式复用

本包导出机制层原语供上层（如 `dc-component` 预设、`cli-mcp` 的 dc-gen 工具）直接 import：

```ts
import {
  addHandler,
  modifyHandler,
  removeHandler,
  listHandler,
  initHandler,
  assembleHandler,
  // assemble 契约
  loadRecipe,
  runBuild,
  runDiff,
  createVfs,
  readManifest,
  // 核心原语
  discoverBatch,
  operate,
  createEnvContext,
} from "@done-coding/cli-generator";
```

## 使用示例

```bash
# 1. 看有哪些批次
dc-gen list

# 2. 初始化一个批次骨架
dc-gen init page

# 3. 添加实例（先看问题清单）
dc-gen add page --list-questions
dc-gen add page Home

# 4. 原位改某实例 insert 块
dc-gen modify page Home

# 5. assemble：物化配方 + 漂移闸
dc-gen assemble build
dc-gen assemble check     # CI 漂移闸：与已提交 manifest diff，任意漂移 fail
```

## 故障排除

**Q: `list` 找不到批次** —— 确认在项目根执行，且 `.done-coding/<type>/` 存在（批次就近向上 + 全局解析）。

**Q: assemble 报漂移** —— `assemble diff` 看具体漂移项；产物应由 `assemble build` 生成并随 manifest 入版控，[MUST NOT] 手改物化产物。

**Q: 拒绝在某目录执行 destructive 操作** —— 命中可疑根守卫；确属预期才显式 `--allow-dangerous`。

## 开发环境设置

```bash
git clone https://github.com/done-coding/done-coding-cli.git
cd done-coding-cli/packages/generator

pnpm install
pnpm dev          # 开发模式
pnpm build        # 构建
pnpm test         # 单测（vitest）
node es/cli.mjs --help   # 本地测试（发布后用 dc-gen）
```

## 许可证

MIT © [done-coding](https://github.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/done-coding) - `done-coding generator` 子命令
- [组件命令行工具](https://www.npmjs.com/package/@done-coding/cli-component) - 本包的 component 预设薄包装
- [模板处理工具](https://www.npmjs.com/package/@done-coding/cli-template) - 注入 / marker 引擎
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
