# @done-coding/cli-utils

CLI 通用工具库 - 为 done-coding CLI 生态系统提供基础工具函数

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-utils.svg)](https://www.npmjs.com/package/@done-coding/cli-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

```bash
npm install @done-coding/cli-utils
# 或
pnpm add @done-coding/cli-utils
```

## 快速开始

```bash
# 作为依赖库使用，不提供独立的 CLI 命令
```

## 功能特性

- ✅ **基础工具**: 提供通用的 CLI 工具函数
- 🔧 **类型定义**: 统一的 TypeScript 类型定义
- 📝 **配置处理**: 配置文件读取和处理工具
- 🎨 **命令行美化**: 基于 chalk 的命令行输出美化
- 🔄 **数据处理**: 基于 lodash 的数据操作工具

## API 文档

本包是一个工具库，不提供独立的 CLI 命令，主要为其他 done-coding CLI 包提供基础功能。

### 主要依赖

- **chalk**: 命令行输出美化
- **json5**: JSON5 格式支持
- **lodash**: 数据操作工具函数
- **prompts**: 交互式命令行提示
- **semver**: 版本号处理
- **uuid**: UUID 生成
- **yargs**: 命令行参数解析

## 使用示例

### 作为依赖使用

```javascript
import {} from /* 具体导出内容 */ "@done-coding/cli-utils";

// 具体使用方法需要查看包的导出内容
```

## 编程接口

本包提供了编程接口，具体的导出内容请查看包的类型定义文件。

## 包依赖关系

### 被其他包依赖

`@done-coding/cli-utils` 是基础工具库，被以下包依赖：

- `@done-coding/cli` - 主 CLI 工具
- `@done-coding/cli-component` - 组件生成工具
- `@done-coding/cli-config` - 工程配置工具
- `@done-coding/cli-extract` - 信息提取工具
- `@done-coding/cli-git` - Git 操作工具
- `@done-coding/cli-inject` - 信息注入工具
- `@done-coding/cli-publish` - 项目发布工具
- `@done-coding/cli-template` - 模板处理工具
- `create-done-coding` - 项目创建工具

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
cd done-coding-cli/packages/utils

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build
```

## 许可证

MIT © [JustSoSu](https://gitee.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Gitee 仓库](https://gitee.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
