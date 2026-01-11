# @done-coding/cli-component

组件生成命令行工具 - 快速创建和管理项目组件

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-component.svg)](https://www.npmjs.com/package/@done-coding/cli-component)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装
```bash
npm install @done-coding/cli-component
# 或
pnpm add @done-coding/cli-component
```

### 作为 done-coding CLI 的一部分
```bash
npm install -g @done-coding/cli
# 然后使用
DC component [command]
```

## 快速开始

```bash
# 独立使用
dc-component [command]

# 作为主 CLI 的子命令
DC component [command]

# 查看帮助
dc-component --help
```

## 功能特性

- ✅ **组件创建**: 使用 `add` 命令创建新组件
- 🗂️ **组件管理**: 使用 `list` 命令查看已创建的组件
- 🗑️ **组件删除**: 使用 `remove` 命令删除不需要的组件
- 🔧 **智能命名**: 自动处理组件名称的格式转换

## API 文档

### 基础命令

#### `dc-component add <name>`
新增一个组件

```bash
# 创建一个名为 Button 的组件
dc-component add Button

# 创建一个名为 UserCard 的组件
dc-component add UserCard
```

**参数说明**:
- `name`: 组件名称（必需）

#### `dc-component remove [name]`
删除一个组件

```bash
# 删除指定组件
dc-component remove Button

# 不指定名称时可能提供交互式选择
dc-component remove
```

**参数说明**:
- `name`: 组件名称（可选）

#### `dc-component list`
展示组件列表

```bash
# 显示所有已创建的组件
dc-component list
```

## 使用示例

### 基础使用场景

```bash
# 1. 查看当前组件列表
dc-component list

# 2. 创建新组件
dc-component add MyButton

# 3. 再次查看组件列表确认创建
dc-component list

# 4. 删除不需要的组件
dc-component remove MyButton
```

### 作为主 CLI 的一部分

```bash
# 使用主 CLI 命令
DC component add Button
DC component list
DC component remove Button

# 使用替代命令
dc-cli component add Button
done-coding component list
```

## 故障排除

### 常见问题

**Q: 组件创建失败**
```bash
# 检查当前目录
pwd

# 查看详细错误信息
dc-component add MyButton
```

**Q: 组件列表为空**
```bash
# 确认是否在正确的项目目录
ls -la

# 检查是否已创建过组件
dc-component list
```

**Q: 删除组件失败**
```bash
# 确认组件名称正确
dc-component list

# 检查文件权限
ls -la src/components/
```

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
cd done-coding-cli/packages/component

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
- [模板处理工具](https://www.npmjs.com/package/@done-coding/cli-template) - 本包依赖的模板引擎
- [Gitee 仓库](https://gitee.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
