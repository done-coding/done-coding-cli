# Requirements Document

## Introduction

为 done-coding CLI monorepo 项目建立统一的文档标准，确保所有子包的文档结构一致、内容完整、链接准确，并提供自动化的文档生成和维护流程。

## Glossary

- **Monorepo**: 包含多个相关包的单一代码仓库
- **CLI_Package**: 主命令行工具包 (@done-coding/cli)
- **Sub_Package**: 各个功能子包 (如 @done-coding/cli-git, @done-coding/cli-component 等)
- **NPM_Registry**: npm 包注册中心，包的最终发布地址
- **Documentation_Template**: 标准化的文档模板
- **Cross_Reference**: 包之间的文档交叉引用链接

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望所有子包都有统一的文档结构，以便快速理解和使用各个工具。

#### Acceptance Criteria

1. THE Documentation_System SHALL 为每个 Sub_Package 提供统一的文档结构
2. WHEN 查看任何 Sub_Package 的文档 THEN THE Documentation_System SHALL 显示相同的章节布局
3. THE Documentation_System SHALL 包含安装、使用、API、示例和故障排除等标准章节
4. THE Documentation_System SHALL 使用一致的 Markdown 格式和样式约定

### Requirement 2

**User Story:** 作为 CLI 用户，我希望主 CLI 包的文档能清晰描述所有子命令，并能快速跳转到详细文档。

#### Acceptance Criteria

1. THE CLI_Package SHALL 在其文档中列出所有可用的子命令
2. WHEN 用户查看 CLI_Package 文档 THEN THE Documentation_System SHALL 显示每个子命令的简要描述
3. THE CLI_Package SHALL 为每个子命令提供指向对应 NPM_Registry 页面的链接
4. THE CLI_Package SHALL 包含完整的命令使用示例和参数说明
5. THE CLI_Package SHALL 提供快速开始指南和常见用法场景

### Requirement 3

**User Story:** 作为包维护者，我希望文档中的链接都指向正确的 npm 包地址，确保用户能找到最新的包信息。

#### Acceptance Criteria

1. THE Documentation_System SHALL 使用 NPM_Registry URL 格式进行 Cross_Reference
2. WHEN 生成包链接 THEN THE Documentation_System SHALL 使用格式 `https://www.npmjs.com/package/{package-name}`
3. THE Documentation_System SHALL 验证所有外部链接的有效性
4. THE Documentation_System SHALL 自动更新版本号和依赖关系信息

### Requirement 4

**User Story:** 作为新贡献者，我希望有清晰的文档编写指南，确保我的贡献符合项目标准。

#### Acceptance Criteria

1. THE Documentation_System SHALL 提供详细的文档编写指南
2. THE Documentation_System SHALL 包含 Documentation_Template 供新包使用
3. THE Documentation_System SHALL 定义代码示例的格式标准
4. THE Documentation_System SHALL 提供文档质量检查清单
5. THE Documentation_System SHALL 包含多语言支持指南（中英文）

### Requirement 5

**User Story:** 作为项目维护者，我希望能自动化生成和更新文档，减少手动维护工作。

#### Acceptance Criteria

1. THE Documentation_System SHALL 提供自动化文档生成脚本
2. WHEN 包信息发生变化 THEN THE Documentation_System SHALL 自动更新相关文档
3. THE Documentation_System SHALL 验证文档的完整性和一致性
4. THE Documentation_System SHALL 支持批量更新所有包的文档
5. THE Documentation_System SHALL 集成到 CI/CD 流程中

### Requirement 6

**User Story:** 作为用户，我希望文档内容准确反映当前版本的功能，基于实际代码实现编写，不包含虚构的功能。

#### Acceptance Criteria

1. THE Documentation_System SHALL 确保文档版本与包版本同步
2. THE Documentation_System SHALL 仅基于实际代码实现编写功能说明
3. THE Documentation_System SHALL 通过分析源代码提取真实的 API 和命令
4. THE Documentation_System SHALL 验证所有示例代码的可执行性
5. THE Documentation_System SHALL 禁止编造不存在的功能和选项
6. THE Documentation_System SHALL 基于实际的 bin 命令和导出接口编写使用说明

### Requirement 7

**User Story:** 作为国际用户，我希望文档支持多语言，特别是中英文双语支持。

#### Acceptance Criteria

1. THE Documentation_System SHALL 支持中文和英文双语文档
2. THE Documentation_System SHALL 保持不同语言版本的内容同步
3. THE Documentation_System SHALL 提供语言切换机制
4. THE Documentation_System SHALL 使用统一的术语翻译标准

### Requirement 8

**User Story:** 作为开发者，我希望文档能清晰展示包之间的依赖关系和集成方式。

#### Acceptance Criteria

1. THE Documentation_System SHALL 显示包的依赖关系图
2. THE Documentation_System SHALL 说明包之间的集成和协作方式
3. THE Documentation_System SHALL 提供组合使用多个包的示例
4. THE Documentation_System SHALL 包含架构概览和设计理念说明

### Requirement 10

**User Story:** 作为文档维护者，我希望 CLI 包的文档结构符合标准模板格式，依赖图能正确显示，确保文档的一致性和可读性。

#### Acceptance Criteria

1. THE CLI_Package SHALL 遵循标准的文档结构模板格式
2. THE CLI_Package SHALL 包含正确的 Mermaid 依赖关系图语法
3. THE CLI_Package SHALL 避免重复的章节内容
4. THE CLI_Package SHALL 使用正确的徽章格式和链接
5. THE CLI_Package SHALL 确保所有示例使用正确的仓库地址（Gitee）
6. THE CLI_Package SHALL 保持与其他子包文档的结构一致性

### Requirement 11

**User Story:** 作为用户，我希望文档使用中文编写，CLI 包文档能基于 postinstall 钩子提供系统差异提示，模板文档能根据包的实际情况灵活选择内容。

#### Acceptance Criteria

1. THE Documentation_System SHALL 使用中文作为主要文档语言
2. THE CLI_Package SHALL 基于 postinstall.ts 文件内容在文档中提供系统差异说明
3. THE Documentation_Template SHALL 为 postinstall 相关内容预留可选区域
4. THE Documentation_System SHALL 根据包的实际情况选择是否包含 postinstall 相关内容
5. THE Documentation_System SHALL 简化依赖关系图，避免过于复杂的多层级展示
6. THE Documentation_System SHALL 将用户语言偏好持久化记录到用户规则中

### Requirement 12

**User Story:** 作为文档读者，我希望包间协作关系的描述准确反映实际的调用方向，避免误导性的双向箭头表示。

#### Acceptance Criteria

1. THE Documentation_System SHALL 使用单向箭头（→）表示包间的实际调用关系
2. THE Documentation_System SHALL 避免使用双向箭头（↔）误导读者
3. THE Documentation_System SHALL 确保 Mermaid 图表语法正确，能够正常渲染
4. THE Documentation_System SHALL 明确标识调用方和被调用方的关系
5. THE Documentation_System SHALL 在根目录和 CLI 包文档中保持一致的协作关系描述

### Requirement 13

**User Story:** 作为开发者，我希望所有子包都有完整、标准化的文档，遵循统一的模板格式，提供详细的使用说明和示例。

#### Acceptance Criteria

1. THE Documentation_System SHALL 为所有子包提供完整的文档结构
2. THE Sub_Package SHALL 遵循标准文档模板格式
3. THE Sub_Package SHALL 包含安装、快速开始、功能特性、API 文档、使用示例等标准章节
4. THE Sub_Package SHALL 基于实际代码实现编写功能说明
5. THE Sub_Package SHALL 提供正确的 npm 包链接和徽章
6. THE Sub_Package SHALL 使用中文作为主要文档语言

### Requirement 14

**User Story:** 作为文档读者，我希望文档内容完全基于实际代码实现，绝对不包含任何编造的功能、类名、配置或示例。

#### Acceptance Criteria

1. THE Documentation_System SHALL 绝对禁止编造不存在的功能、选项、命令或 API
2. THE Documentation_System SHALL 绝对禁止编造不存在的类、接口、函数名称
3. THE Documentation_System SHALL 绝对禁止编造不存在的配置选项或参数
4. THE Documentation_System SHALL 在编写文档前使用实际命令验证功能存在性
5. THE Documentation_System SHALL 基于源代码确认所有类名、函数名、配置选项的真实性
6. THE Documentation_System SHALL 提供可执行的真实代码示例
### Requirement 15

**User Story:** 作为文档维护者，我希望准确区分和记录每个包的独立命令和主CLI子命令，确保文档正确反映包的实际使用方式。

#### Acceptance Criteria

1. THE Documentation_System SHALL 通过检查 package.json 的 bin 字段确认独立命令的存在性
2. THE Documentation_System SHALL 区分独立命令（如 dc-component）和主CLI子命令（如 DC component）的使用方式
3. THE Documentation_System SHALL 为有独立命令的包提供两种使用方式的完整说明
4. THE Documentation_System SHALL 为没有独立命令的包（如 @done-coding/cli-utils）明确说明其使用方式
5. THE Documentation_System SHALL 在文档中正确展示独立命令的语法和参数
6. THE Documentation_System SHALL 避免错误地声称包"只能通过主CLI使用"当它实际有独立命令时
7. THE Documentation_System SHALL 记录以下包的独立命令状态：
   - create-done-coding: 有独立命令 `create-done-coding`
   - @done-coding/cli-component: 有独立命令 `dc-component`
   - @done-coding/cli-config: 有独立命令 `dc-config`
   - @done-coding/cli-extract: 有独立命令 `dc-extract`
   - @done-coding/cli-git: 有独立命令 `dc-git`
   - @done-coding/cli-inject: 有独立命令 `dc-inject`
   - @done-coding/cli-publish: 有独立命令 `dc-publish`
   - @done-coding/cli-template: 有独立命令 `dc-template`
### Requirement 16

**User Story:** 作为文档维护者，我希望准确记录和解释跨平台命令使用的差异，特别是 Windows 和 macOS/Linux 系统中 `dc` 命令的可用性差异。

#### Acceptance Criteria

1. THE Documentation_System SHALL 检查每个包是否存在 postinstall 钩子脚本
2. THE Documentation_System SHALL 基于 postinstall 脚本内容在文档中提供系统差异说明
3. THE Documentation_System SHALL 解释 Windows 系统中 `dc` 命令可用的技术原因：
   - Windows 系统对命令大小写不敏感
   - Windows 系统不存在 `dc` 系统命令
   - 因此用户可以使用 `dc` 命令（实际调用 bin 配置中的大写 `DC`）
4. THE Documentation_System SHALL 解释 macOS/Linux 系统中避免使用 `dc` 命令的原因：
   - macOS/Linux 系统存在 `dc` 系统命令（桌面计算器/desk calculator）
   - 为避免与系统命令冲突，用户应使用大写 `DC` 或完整命令名
   - bin 配置使用大写 `DC` 正是为了避免系统命令冲突
5. THE Documentation_System SHALL 在 CLI 包文档中基于 postinstall.ts 文件内容提供准确的安装后提示信息
6. THE Documentation_System SHALL 为其他包检查是否存在类似的 postinstall 脚本并相应更新文档
7. THE Documentation_System SHALL 在文档中明确标注这种系统差异，避免用户混淆
8. THE Documentation_System SHALL 修正 CLI 包 README.md 第54行的错误描述"不存在小写的 dc 命令"
### Requirement 17

**User Story:** 作为文档维护者，我希望准确说明本地开发测试和发布后命令的关系，避免误导开发者认为测试命令就是实际使用命令。

#### Acceptance Criteria

1. THE Documentation_System SHALL 明确区分本地开发测试命令和发布后使用命令
2. THE Documentation_System SHALL 说明本地测试使用 `node` + bin对应的入口文件格式
3. THE Documentation_System SHALL 说明发布后使用 bin 配置中定义的命令名
4. THE Documentation_System SHALL 强调两者功能完全一致，只是调用方式不同
5. THE Documentation_System SHALL 避免绝对化地说"使用 node es/cli.mjs --help 测试功能"
6. THE Documentation_System SHALL 明确 `node es/cli.mjs --help` 只能测试帮助命令是否正常
7. THE Documentation_System SHALL 在开发环境设置部分提供准确的本地测试说明