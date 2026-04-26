# @done-coding/cli-git

git 跨平台操作命令行工具 - 提供 git 平台克隆、钩子管理和检查功能

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-git.svg)](https://www.npmjs.com/package/@done-coding/cli-git)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-git
# 或
pnpm add @done-coding/cli-git
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC git [command]  # macOS/Linux
dc git [command]  # Windows
```

## 快速开始

```bash
# 独立使用
dc-git --help

# 作为主 CLI 的子命令
DC git --help     # macOS/Linux
dc git --help     # Windows
```

## 功能特性

- ✅ **平台克隆**: 支持从 GitHub、GitLab 等平台快速克隆用户仓库
- 🔧 **配置管理**: 初始化和管理 git 相关配置文件
- 🪝 **钩子支持**: 提供 git 钩子的回调和管理功能
- 🔍 **状态检查**: 检查 git 操作和仓库状态

## API 文档

### 基础命令

#### `dc-git init`

初始化配置文件

```bash
dc-git init
# 创建 git 相关的配置文件
```

#### `dc-git clone <platform> <username>`

从指定的 git 平台克隆用户的代码仓库

```bash
# 从 GitHub 克隆用户仓库
dc-git clone github username

# 从 GitLab 克隆用户仓库
dc-git clone gitlab username

# 从其他平台克隆
dc-git clone bitbucket username
```

**参数说明**:

- `platform`: git 平台名称 (github, gitlab, bitbucket 等)
- `username`: 用户名

#### `dc-git hooks <name> [args...]`

执行 git 钩子回调

```bash
# 执行 pre-commit 钩子
dc-git hooks pre-commit

# 执行 post-commit 钩子
dc-git hooks post-commit

# 带参数执行钩子
dc-git hooks pre-push origin main
```

**参数说明**:

- `name`: 钩子名称
- `args`: 传递给钩子的参数

#### `dc-git check <type>`

检查 git 操作和状态，主要为工程化配置提供支持

```bash
# 检测反向合并（为 dc-config 的 merge-lint 模块提供支持）
dc-git check reverse-merge
```

**参数说明**:

- `type`: 检查类型
  - `reverse-merge`: 检测反向合并，防止高级分支被合并到低级分支

**功能说明**:
此命令主要为 `@done-coding/cli-config` 包的 `merge-lint` 模块提供 git 合并规范检测功能，确保团队遵循正确的分支合并方向。

## 使用示例

### 基础使用场景

```bash
# 1. 初始化配置
dc-git init

# 2. 从 Gitee 克隆用户的所有仓库
dc-git clone gitee username

# 3. 检查反向合并（通常由 dc-config 自动调用）
dc-git check reverse-merge

# 4. 执行 git 钩子
dc-git hooks pre-commit
```

### 集成到工程化配置

```bash
# dc-config 包会自动调用 git 检测功能
dc-config check

# 如果启用了 merge-lint 模块，会自动执行：
# dc-git check reverse-merge
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc git init
dc git clone gitee username
dc git hooks pre-commit
dc git check reverse-merge

# macOS/Linux 系统
DC git init
DC git clone gitee username
DC git hooks pre-commit
DC git check reverse-merge
```

## 配置

在项目根目录创建 `.done-coding-git.config.js`:

```javascript
export default {
  // 默认平台
  defaultPlatform: "github",

  // 克隆配置
  clone: {
    // 默认克隆协议
    protocol: "https", // 或 'ssh'
    // 目标目录
    targetDir: "./repos",
  },

  // 钩子配置
  hooks: {
    // 启用的钩子
    enabled: ["pre-commit", "post-commit", "pre-push"],
    // 钩子脚本路径
    scriptsPath: "./.git/hooks",
  },

  // 检查配置
  check: {
    // 默认检查项
    defaultChecks: ["status", "branch", "remote"],
  },
};
```

## 编程接口

### 作为模块使用

```javascript
import { GitHelper } from "@done-coding/cli-git/helpers";

const git = new GitHelper();

// 克隆仓库
await git.cloneFromPlatform("github", "username");

// 执行钩子
await git.executeHook("pre-commit", []);

// 检查状态
const status = await git.checkStatus("status");
console.log(status);
```

### TypeScript 支持

```typescript
import type {
  PlatformType,
  HookType,
  CheckType,
} from "@done-coding/cli-git/helpers";

const platform: PlatformType = "github";
const hook: HookType = "pre-commit";
const checkType: CheckType = "status";
```

## 故障排除

### 常见问题

**Q: 克隆失败**

```bash
# 检查网络连接
ping github.com

# 检查 git 配置
git config --list

# 使用详细模式查看错误
dc-git clone github username --verbose
```

**Q: 钩子执行失败**

```bash
# 检查钩子文件权限
ls -la .git/hooks/

# 手动执行钩子测试
.git/hooks/pre-commit

# 重新初始化钩子
dc-git init
```

**Q: 检查命令无响应**

```bash
# 确保在 git 仓库中
git status

# 检查仓库完整性
git fsck
```

### 调试模式

```bash
# 启用详细输出
dc-git --verbose check status

# 启用调试模式
DEBUG=done-coding:git dc-git clone github username
```

## 性能建议

- 对于大量仓库克隆，建议分批进行
- 使用 SSH 协议可以提高克隆速度
- 定期清理无用的配置文件

## 贡献指南

我们欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m "feat: add amazing feature"`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/done-coding/done-coding-cli.git
cd done-coding-cli/packages/git

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 本地开发测试
node es/cli.mjs --help

# 注意：本地使用 node + 入口文件，发布后使用 bin 命令名
# 功能完全一致，只是调用方式不同
```

## 许可证

MIT © [done-coding](https://github.com/done-coding)

## 包依赖关系

### 为其他包提供服务

`@done-coding/cli-git` 的 `check` 命令专门为 `@done-coding/cli-config` 包提供 git 合并检测功能：

- **merge-lint 模块**: `dc-config` 包的 `merge-lint` 配置模块依赖 `dc-git check reverse-merge` 命令
- **反向合并检测**: 防止将高级分支（如 main/master）合并到低级分支（如 feature/develop）
- **集成使用**: 当 `dc-config` 检测工程化配置时，会调用 `dc-git check` 来验证 git 合并规范

### 检测功能详解

#### `dc-git check reverse-merge`

专为工程化配置提供的 git 合并规范检测：

```bash
# 检测当前分支是否存在反向合并
dc-git check reverse-merge

# 该命令会检测：
# 1. 通过 git reflog 检测合并操作
# 2. 通过提交信息检测合并记录
# 3. 通过提交记录检测历史合并
# 4. 检测 rebase 操作的合规性
```

**检测场景**:

- 防止 `main` 分支被合并到 `feature` 分支
- 防止 `develop` 分支被合并到个人开发分支
- 确保分支合并方向符合 Git Flow 规范

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [配置工具包](https://www.npmjs.com/package/@done-coding/cli-config) - 使用本包的检测功能
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
