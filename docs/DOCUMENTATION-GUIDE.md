# done-coding CLI 文档编写指南

本指南定义了 done-coding CLI monorepo 项目中所有包的文档标准，确保文档的一致性和完整性。

## 文档结构标准

### 主 CLI 包 (@done-coding/cli)

主 CLI 包的 README 应包含以下章节：

1. **标题和描述** - 项目名称和简短描述
2. **安装** - 全局安装说明
3. **快速开始** - 基本使用方法
4. **子命令概览** - 所有子包的详细列表
5. **完整命令列表** - 命令速查表
6. **使用示例** - 常见使用场景
7. **配置** - 配置文件说明
8. **架构设计** - 包依赖关系图
9. **故障排除** - 常见问题解答
10. **贡献指南** - 如何参与贡献
11. **许可证** - MIT 许可证信息
12. **相关链接** - 重要链接集合

### 子包文档

每个子包的 README 应包含以下标准章节：

1. **标题和描述** - 包名和功能描述
2. **徽章** - npm 版本和许可证徽章
3. **安装** - 独立安装和集成安装
4. **快速开始** - 基本使用示例
5. **功能特性** - 主要功能列表（使用 emoji）
6. **API 文档** - 详细的命令和选项说明
7. **使用示例** - 实际使用场景
8. **配置** - 配置文件和选项
9. **编程接口** - 作为模块使用的方法
10. **故障排除** - 常见问题和解决方案
11. **性能建议** - 最佳实践
12. **贡献指南** - 开发环境设置
13. **许可证** - MIT 许可证
14. **相关链接** - 相关资源链接

## 内容编写规范

### 标题规范

- 使用 `#` 作为主标题
- 使用 `##` 作为章节标题
- 使用 `###` 作为子章节标题
- 使用 `####` 作为具体功能标题

### 代码块规范

```bash
# 命令行示例使用 bash
command --option value
```

```javascript
// JavaScript 代码示例
const example = 'value';
```

```typescript
// TypeScript 代码示例
interface Example {
  property: string;
}
```

### 链接规范

#### npm 包链接格式
```markdown
[包名](https://www.npmjs.com/package/包名)
```

#### 内部链接格式
```markdown
[相对路径链接](./path/to/file.md)
```

#### 外部链接格式
```markdown
[链接文本](https://example.com)
```

### 徽章规范

每个子包都应包含以下徽章：

```markdown
[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-{package-name}.svg)](https://www.npmjs.com/package/@done-coding/cli-{package-name})
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

### 功能特性列表规范

使用 emoji 和简洁描述：

```markdown
- ✅ **主要功能**: 功能描述
- 🚀 **性能优势**: 性能相关特性
- 🔄 **工作流程**: 流程改进特性
- 📝 **开发体验**: 开发者体验改进
- 🔍 **其他特性**: 其他重要功能
```

## 模板使用指南

### 使用 README 模板

1. 复制 `docs/README-TEMPLATE.md`
2. 替换所有 `{placeholder}` 占位符：
   - `{package-name}`: 包名（不含前缀）
   - `{package-description}`: 包的简短描述
   - `{detailed-description}`: 详细功能描述
   - `{command-name}`: 命令名称
   - `{MainClass}`: 主要类名
   - `{TypeName}`: 类型名称
   - `{OptionsType}`: 选项类型名称

### 占位符替换示例

对于 `@done-coding/cli-git` 包：

```markdown
# 替换前
# @done-coding/cli-{package-name}

# 替换后
# @done-coding/cli-git
```

## 内容质量标准

### 必需内容

每个文档必须包含：

- [ ] 清晰的安装说明
- [ ] 至少 3 个使用示例
- [ ] 完整的 API 文档
- [ ] 故障排除章节
- [ ] 正确的 npm 包链接

### 可选内容

根据包的复杂程度可选择包含：

- [ ] 配置文件示例
- [ ] TypeScript 类型定义
- [ ] 性能建议
- [ ] 高级使用场景
- [ ] 架构说明

### 内容质量检查

- [ ] 所有代码示例都可执行
- [ ] 所有链接都有效
- [ ] 语法和拼写正确
- [ ] 格式一致
- [ ] 信息准确且最新

## 多语言支持

### 中英文对照

| 中文 | English |
|------|---------|
| 安装 | Installation |
| 快速开始 | Quick Start |
| 功能特性 | Features |
| 使用示例 | Examples |
| 配置 | Configuration |
| 故障排除 | Troubleshooting |
| 贡献指南 | Contributing |
| 许可证 | License |

### 术语统一

| 术语 | 统一翻译 |
|------|----------|
| CLI | 命令行工具 |
| Package | 包 |
| Subcommand | 子命令 |
| Template | 模板 |
| Configuration | 配置 |
| Workflow | 工作流程 |

## 维护流程

### 文档更新时机

- 包版本发布时
- 新功能添加时
- API 变更时
- 用户反馈问题时

### 更新检查清单

- [ ] 版本号是否最新
- [ ] 新功能是否已文档化
- [ ] 示例代码是否可用
- [ ] 链接是否有效
- [ ] 格式是否一致

### 质量保证

1. **自检**: 作者自行检查内容完整性
2. **同行评审**: 团队成员交叉检查
3. **用户测试**: 根据文档进行实际操作测试

## 工具和资源

### 推荐工具

- **Markdown 编辑器**: Typora, Mark Text
- **链接检查**: markdown-link-check
- **拼写检查**: cspell
- **格式化**: prettier

### 参考资源

- [Markdown 语法指南](https://www.markdownguide.org/)
- [npm 包文档最佳实践](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [开源项目文档指南](https://opensource.guide/best-practices/)

## 示例文档

- [主 CLI 包示例](../packages/cli/README.md)
- [子包示例](../packages/git/README.md)
- [模板文件](./README-TEMPLATE.md)

---

遵循本指南可以确保 done-coding CLI 项目的文档保持高质量和一致性，为用户提供最佳的使用体验。