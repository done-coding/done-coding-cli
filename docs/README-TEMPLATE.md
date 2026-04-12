# @done-coding/cli-{package-name}

{package-description} - {detailed-description}

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-{package-name}.svg)](https://www.npmjs.com/package/@done-coding/cli-{package-name})
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-{package-name}
# 或
pnpm add @done-coding/cli-{package-name}
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC {command-name} [options]
```

## 快速开始

```bash
# 独立使用
dc-{command-name} [action]

# 作为主 CLI 的子命令
DC {command-name} [action]

# 查看帮助
dc-{command-name} --help
```

{postinstall-section-start}

### 安装后提示

{postinstall-content}

{postinstall-section-end}

## 功能特性

- ✅ **特性1**: 描述主要功能
- 🚀 **特性2**: 描述性能优势
- 🔄 **特性3**: 描述工作流程改进
- 📝 **特性4**: 描述开发体验提升
- 🔍 **特性5**: 描述其他重要特性

## API 文档

### 基础命令

#### `dc-{command-name} action1`

描述基础命令的功能

```bash
dc-{command-name} action1 [options]
# 示例输出或说明
```

#### `dc-{command-name} action2`

描述另一个基础命令

```bash
# 基础用法
dc-{command-name} action2

# 带参数的用法
dc-{command-name} action2 --option value
```

### 高级功能

#### `dc-{command-name} advanced-action`

描述高级功能

```bash
# 高级用法示例
dc-{command-name} advanced-action --config ./config.json
```

## 使用示例

### 基础使用场景

```bash
# 1. 初始化
dc-{command-name} init

# 2. 执行主要操作
dc-{command-name} main-action

# 3. 查看结果
dc-{command-name} status
```

### 高级使用场景

```bash
# 复杂工作流程示例
dc-{command-name} complex-workflow --input ./src --output ./dist
```

## 配置

在项目根目录创建 `.done-coding-{package-name}.config.js`:

```javascript
export default {
  // 基础配置
  option1: "default-value",

  // 高级配置
  advanced: {
    feature1: true,
    feature2: {
      subOption: "value",
    },
  },

  // 自定义配置
  custom: {
    // 用户自定义选项
  },
};
```

## 编程接口

### 作为模块使用

```javascript
import { {MainClass} } from '@done-coding/cli-{package-name}/helpers';

const tool = new {MainClass}();

// 基础操作
const result = await tool.basicOperation();
console.log(result);

// 高级操作
await tool.advancedOperation(options);
```

### TypeScript 支持

```typescript
import type { {TypeName}, {OptionsType} } from '@done-coding/cli-{package-name}/helpers';

const options: {OptionsType} = {
  // 类型安全的配置
};
```

## 故障排除

### 常见问题

**Q: 问题描述**

```bash
# 解决方案命令
dc-{command-name} fix-command
```

**Q: 另一个常见问题**

```bash
# 检查命令
dc-{command-name} check

# 修复命令
dc-{command-name} repair
```

### 调试模式

```bash
# 启用详细输出
dc-{command-name} --verbose action

# 启用调试模式
DEBUG=done-coding:{package-name} dc-{command-name} action
```

## 性能建议

- 建议1：具体的性能优化建议
- 建议2：最佳实践
- 建议3：避免的常见问题

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
cd done-coding-cli/packages/{package-name}

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 运行测试
pnpm test
```

## 许可证

MIT © [JustSoSu](https://gitee.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Gitee 仓库](https://gitee.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
