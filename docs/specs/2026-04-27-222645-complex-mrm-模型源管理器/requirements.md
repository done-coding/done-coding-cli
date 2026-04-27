# 需求文档：模型源管理器（mrm）

> 状态：已审核通过
> 任务等级：Complex
> 日期：2026-04-27
> 参与角色：PM + 产品专家 + 架构师 + 全栈开发专家 + 测试专家

## 需求可行性评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 工作量 | Medium | 5+ handler 文件、数据持久化、配置读写，但遵循已有包模板 |
| 关联密度 | Medium | 所有 handler 共享 Source/Client 数据模型和注册表，不触发拆分规则 |

## 背景

nrm 是 npm registry 管理器，可快速查看/添加/删除/切换 npm 源。Claude Code 生态同样需要源管理能力——不同 API 服务商（Anthropic、DeepSeek、中转代理）提供相同或不同的模型，用户需要在不同源和模型之间切换。

`@done-coding/cli-mrm`（Model Registry Manager）对标 nrm，提供模型源的注册、浏览和切换功能。

## 核心概念

| 概念 | 说明 |
|------|------|
| **Client** | 使用 API 的客户端工具，内置 `claude-code`（protocol: anthropic）和 `done-coding-ai`（protocol: openai） |
| **Protocol** | API 协议方案，内置 `anthropic`（Anthropic Messages API）和 `openai`（OpenAI Chat Completions），由 client 决定，用户不可选 |
| **Source** | 模型 API 源 = 别名 + baseUrl + apiKey + 支持的模型列表 |
| **Model** | AI 模型标识，归属于某个 provider |

## 跨系统影响分析

| 受影响的系统/文件 | 影响边界 |
|------|------|
| `packages/mrm/` | 新包主体 |
| `~/.claude/settings.json` | mrm 写入 claude-code 的配置 |
| `~/.done-coding/config.json` | mrm 写入 done-coding-ai 的配置 |
| `~/.done-coding/mrm/` | mrm 自身注册表存储目录 |
| `packages/ai/` | 后续可消费 mrm 的 source registry（不在本次范围） |

## 功能需求

### REQ-1: Client 管理
WHEN 用户首次使用 mrm
THE SYSTEM SHALL 默认使用 `claude-code` 作为当前 client

**子需求：**

- **REQ-1a: 切换 client**
  WHEN 用户执行 `mrm switch <client>`
  THE SYSTEM SHALL 将当前 client 切换为指定值
  - 验收标准：合法值为 `claude-code` | `done-coding-ai`，切换后 `mrm ls` 等命令默认操作新 client

### REQ-2: 列出模型和源 (ls)
WHEN 用户执行 `mrm ls`
THE SYSTEM SHALL 按**模型维度**列出当前 client 下所有可用模型
每个模型下显示其提供商，以及该提供商下支持此模型的源列表
展示结构：模型名 → 提供商 → 源列表

WHEN 用户执行 `mrm ls --provider`
THE SYSTEM SHALL 按模型提供商分组，每个提供商下列出其模型及支持源

WHEN 用户执行 `mrm ls --client=<client>`
THE SYSTEM SHALL 显示指定 client 下的模型（覆盖当前默认 client）

WHEN 用户执行 `mrm ls --provider --client=<client>`
THE SYSTEM SHALL 按提供商分组展示指定 client 下的模型及支持源

- 验收标准：
  - 无源时显示提示信息
  - 有源时按 模型 → 提供商 → 源 的层级展示
  - `--provider` 按 提供商 → 模型 → 源 的层级展示
  - `--provider --client=<name>` 组合使用时两者同时生效

### REQ-3: 添加源 (add)
WHEN 用户执行 `mrm add <别名> <url>`
THE SYSTEM SHALL：
1. 接受源别名和 base URL
2. 交互式提示输入 apiKey（安全输入，不回显）
3. 交互式要求设置该源支持的模型列表（可多选预设模型，也可手动输入）
4. 保存源到当前 client 的注册表

WHEN 用户执行 `mrm add <别名> <url> --client=<client>`
THE SYSTEM SHALL 将源添加到指定 client 的注册表

- 验收标准：
  - 别名不能与已有源重复
  - URL 格式校验
  - apiKey 不能为空
  - 保存后 `mrm ls` 可见新源及其模型

### REQ-4: 使用模型/源 (use)
WHEN 用户执行 `mrm use <模型名>`
THE SYSTEM SHALL：
1. 查找当前 client 下支持该模型的所有源
2. IF 无源支持 → 报错提示
3. IF 唯一源支持 → 直接选中
4. IF 多个源支持 → 交互式让用户选择
5. 将选中的源配置（baseUrl + apiKey + model）写入对应 client 的配置文件

WHEN 用户执行 `mrm use <模型名> --client=<client>`
THE SYSTEM SHALL 写入指定 client 的配置文件

- 验收标准：
  - 选择来源后，Claude Code 或 done-coding-ai 的配置文件正确更新
  - 源不可用时给出明确提示

### REQ-5: 删除源 (remove)
WHEN 用户执行 `mrm remove <源别名>`
THE SYSTEM SHALL 从当前 client 注册表中删除该源（包含别名、baseUrl、apiKey、模型列表等全部信息）

WHEN 用户执行 `mrm remove <源别名> --client=<client>`
THE SYSTEM SHALL 从指定 client 注册表中删除

[MUST NOT] 删除源时回写或修改 client 的配置文件（如 ~/.claude/settings.json），remove 仅操作 mrm 自身注册表

- 验收标准：
  - 源不存在时给出提示
  - 删除前要求用户确认
  - 删除后注册表中不再存在该源的全部信息

## 内置数据

### 内置 Client

| client | protocol | 配置文件路径 |
|--------|----------|------|
| `claude-code` | anthropic | `~/.claude/settings.json` |
| `done-coding-ai` | openai | `~/.done-coding/config.json` |

### 内置 Source（claude-code client）

| 别名 | baseUrl | 模型 |
|------|---------|------|
| `anthropic` | `https://api.anthropic.com` | haiku, sonnet, opus |
| `n1n` | （用户配置） | haiku, sonnet, opus |
| `deepseek` | `https://api.deepseek.com` | deepseek-v4-pro |

### 内置 Source（done-coding-ai client）

| 别名 | baseUrl | 模型 |
|------|---------|------|
| `deepseek` | `https://api.deepseek.com` | deepseek-v4-pro, deepseek-v4-flash |

## 边界情况和约束

- apiKey 明文存储（与 nrm 一致），用户自行承担安全风险
- Client 枚举固定，不支持用户自定义 client
- Protocol 由 client 固定，用户不可修改
- 同一个 base URL + apiKey 可以在不同 client 下注册为不同名的源
- 源注册表存储位置：`~/.done-coding/mrm/sources.json`

## 非功能需求

- CLI 响应时间 < 500ms（不含交互输入）
- 所有命令遵循 monorepo 已有 yargs 封装模式
- ESM 输出，Node >= 18

## 需求确认记录

| REQ | 确认 |
|------|------|
| REQ-1: Client 管理 | ✅ |
| REQ-2: 列出模型和源 | ✅ |
| REQ-3: 添加源 | ✅ |
| REQ-4: 使用模型/源 | ✅ |
| REQ-5: 删除源 | ✅ |
