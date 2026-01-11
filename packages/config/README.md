# @done-coding/cli-config

工程化配置命令行工具 - 检测和管理项目工程化配置

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-config.svg)](https://www.npmjs.com/package/@done-coding/cli-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装
```bash
npm install @done-coding/cli-config
# 或
pnpm add @done-coding/cli-config
```

### 作为 done-coding CLI 的一部分
```bash
npm install -g @done-coding/cli
# 然后使用
DC config [command]
```

## 快速开始

```bash
# 独立使用
dc-config [command]

# 作为主 CLI 的子命令
DC config [command]

# 查看帮助
dc-config --help
```

## 功能特性

- ✅ **配置检测**: 自动检测项目的工程化配置状态
- 🔧 **配置添加**: 快速添加常用的工程化配置
- 🔍 **Git 集成**: 集成 git 包的合并检测功能
- 📋 **规范检查**: 检查代码规范和项目结构
- 🚀 **一键配置**: 提供常用工程化工具的快速配置

## API 文档

### 基础命令

#### `dc-config check`
检测工程化配置

```bash
# 检测当前项目的工程化配置
dc-config check
```

#### `dc-config add`
添加工程化配置

```bash
# 添加工程化配置
dc-config add
```

## 使用示例

### 基础使用场景

```bash
# 1. 检测当前项目配置状态
dc-config check

# 2. 添加工程化配置
dc-config add
```

### 作为主 CLI 的一部分

```bash
# Windows 系统
dc config check
dc config add

# macOS/Linux 系统
DC config check
DC config add
```

## 配置

本包支持配置文件，具体的配置选项需要查看包的实际实现。

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## Git 合并检测集成

本包集成了 `@done-coding/cli-git` 包的合并检测功能：

### merge-lint 模块

当执行 `dc-config check` 时，会自动调用 `dc-git check reverse-merge` 命令：

```bash
# 自动执行的检测流程
dc-config check
├── 检测 ESLint 配置
├── 检测 Prettier 配置  
├── 检测 TypeScript 配置
├── 检测 Git 钩子配置
└── 调用 dc-git check reverse-merge  # 检测反向合并
```

### 反向合并检测

防止将高级分支合并到低级分支：

- 防止 `main` 分支被合并到 `feature` 分支
- 防止 `develop` 分支被合并到个人开发分支
- 确保分支合并方向符合 Git Flow 规范

## 故障排除

### 常见问题

**Q: 配置检测失败**
```bash
# 检查项目根目录
pwd

# 检查是否为 Git 仓库
git status

# 使用详细模式查看错误
dc-config check --verbose
```

**Q: Git 合并检测报错**
```bash
# 确保 git 包已安装
dc-git --version

# 手动执行 git 检测
dc-git check reverse-merge

# 检查 Git 仓库状态
git log --oneline -10
```

**Q: 配置添加失败**
```bash
# 检查写入权限
ls -la .

# 检查 npm/pnpm 可用性
npm --version
pnpm --version

# 清理缓存重试
npm cache clean --force
```

### 调试模式

```bash
# 启用详细输出
dc-config --verbose check

# 启用调试模式
DEBUG=done-coding:config dc-config check
```

## 性能建议

- 定期运行配置检测确保项目规范性
- 使用 Git 钩子自动执行配置检测
- 团队协作时统一工程化配置标准

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
git clone https://gitee.com/done-coding/done-coding-cli.git
cd done-coding-cli/packages/config

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

MIT © [JustSoSu](https://gitee.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Git 操作工具](https://www.npmjs.com/package/@done-coding/cli-git) - 本包调用的 Git 检测功能
- [Gitee 仓库](https://gitee.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)