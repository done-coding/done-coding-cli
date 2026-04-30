# 需求文档：模型源管理器（mrm）V2

> 状态：已审核通过
> 任务等级：Complex
> 日期：2026-04-28
> 参与角色：PM + 产品专家 + 架构师 + 全栈开发专家 + 测试专家

## 需求可行性评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 工作量 | Medium | 6+ handler、数据模型重构、配置读写 |
| 关联密度 | Medium | 所有 handler 共享三层模型（Protocol→Provider→Model），不触发拆分 |

## 背景

V1 版本以「Source」（源）为核心概念，将源混同于服务商。V2 重构为三层模型：

```
Protocol → Provider（服务商） → Model
```

Provider 按 Protocol 组织，Client 绑定 Protocol 后共享该协议下的所有 Provider。同一公司在不同协议下表现为独立 Provider（如 DeepSeek 在 anthropic 和 openai 各有一个）。

## 核心概念

| 概念 | 说明 |
|------|------|
| **Protocol** | API 协议，内置枚举 `anthropic` / `openai`，用户不可修改 |
| **Provider** | 服务商，归属于某个 Protocol，包含 alias + baseUrl + apiKey + models |
| **Model** | AI 模型名，归属于某个 Provider |
| **Client** | 使用 API 的工具，绑定一个 Protocol，共享该协议下的 Provider |
| **ClientState** | 每个 client 记住上次的 provider + model 选择，切换回来时恢复 |

## 跨系统影响分析

| 受影响的系统/文件 | 影响边界 |
|------|------|
| `packages/mrm/` | 完整重写 |
| `~/.claude/settings.json` | mrm 写入 claude-code 的配置 |
| `~/.done-coding/config.json` | mrm 写入 done-coding-ai 的配置 |
| `~/.done-coding/mrm/sources.json` | mrm 自身注册表（registry） |

## 功能需求

### REQ-1: Client 管理

WHEN 用户首次使用 mrm
THE SYSTEM SHALL 默认使用 `claude-code` 作为当前 client，并设默认 provider + model

- **REQ-1a: 切换 client**
  WHEN 用户执行 `mrm switch <client>`
  THE SYSTEM SHALL：
  1. 校验 client 名是否合法（`claude-code` / `done-coding-ai`），非法则报错
  2. 切换到目标 client，恢复该 client 上次的 (provider, model) 组合
  3. IF client 从未被使用过，则设为该 client 的默认 provider + 默认 model
  4. [MUST] 切换后 provider 和 model 不允许为空

### REQ-2: 列出 (ls)

WHEN 用户执行 `mrm ls`
THE SYSTEM SHALL 首先输出当前链路状态行（client → provider → model），再按模型扁平化列出

WHEN 用户执行 `mrm ls --view=model`（默认）
THE SYSTEM SHALL 扁平化列出当前 client 协议下的所有模型
每行：模型名 + 所属 provider + provider 协议 + provider 是否为内置，当前使用的模型标注 ★

WHEN 用户执行 `mrm ls --view=provider`
THE SYSTEM SHALL 树状展示：provider → 协议 + [内置]标注 → 模型列表，内置 provider 和内置模型均标记 [内置]

- 验收标准：
  - 顶部显示 `当前: <client> → <provider> → <model>`
  - `--view=model` 扁平化：模型名 + provider + 协议 + [内置]标注 + ★ 标注
  - `--view=provider` 树状：provider → 协议 + [内置]标注 → 模型 + [内置]标注

### REQ-3: Provider 管理

- **REQ-3a: 添加 provider**
  `mrm provider add <alias> <url>`
  1. [MUST] 别名与同一协议下已有 provider 不重名，重名则报错退出
  2. 交互式输入 apiKey
  3. 交互式设置模型列表（可多选预设，也可手动输入）
  4. 保存到当前 client 所绑定 protocol 的 provider 列表

- **REQ-3b: 切换 provider**
  `mrm provider use <alias>`
  1. alias 必须在当前 protocol 的 provider 列表中，否则报错
  2. 切换后自动设为该 provider 的默认模型
  3. provider 状态按 client 记忆

- **REQ-3c: 删除 provider**
  `mrm provider remove <alias>`
  1. [MUST NOT] 删除内置 provider
  2. 删除前要求用户确认
  3. IF 删除的是当前使用的 provider → 自动回退到该 protocol 的默认 provider，并设为默认 model
  4. 仅操作 mrm 注册表，不回写 client 配置文件

### REQ-4: Model 管理

- **REQ-4a: 添加模型**
  `mrm model add <providerAlias> <modelName>`
  1. providerAlias 必须在当前 protocol 的 provider 列表中
  2. [MUST] modelName 与该 provider 已有模型不重名，重名则报错退出
  3. 支持批量输入（空格分隔多个模型名）

- **REQ-4b: 删除模型**
  `mrm model remove <providerAlias> <modelName>`
  1. [MUST NOT] 删除内置 provider 的内置模型
  2. IF 删除的是当前使用的模型 → 自动回退到该 provider 的默认模型
  3. 删除前要求用户确认

- **REQ-4c: 切换模型**
  `mrm model use <modelName> [--provider=<alias>]`
  别名：`mrm use <modelName> [--provider=<alias>]`（同一 handler 注册两个命令，方便快捷）

  1. modelName 必须在目标 provider 的模型列表中，否则报错
  2. IF `--provider` 指定 → 先切 provider（内部调用 provider use 逻辑），再切 model
  3. IF 无 `--provider` → 在当前 provider 下查找模型
  4. 将最终选中的 (provider.baseUrl, provider.apiKey, model) 写入对应 client 配置文件

### REQ-5: 删除保护规则

- 内置 provider 不可删除（`mrm provider remove` 报错提示）
- 内置 provider 的内置模型不可删除（`mrm model remove` 报错提示）
- 额外添加的 provider 和模型可自由删除
- 删除后级联回退到默认值，不悬空

## 内置数据

### 内置 Client

| client | protocol | 默认 provider | 配置文件 |
|--------|----------|-------------|------|
| claude-code | anthropic | anthropic | ~/.claude/settings.json |
| done-coding-ai | openai | deepseek | ~/.done-coding/config.json |

### 内置 Provider（按 Protocol 组织）

**Anthropic 协议：**

| alias | baseUrl | 内置模型 | 可删除 |
|-------|---------|---------|:--:|
| anthropic | https://api.anthropic.com | haiku, sonnet, opus | 否 |
| deepseek | https://api.deepseek.com/anthropic | deepseek-v4-pro, deepseek-v4-flash, deepseek-chat, deepseek-reasoner | 否 |

**OpenAI 协议：**

| alias | baseUrl | 内置模型 | 可删除 |
|-------|---------|---------|:--:|
| openai | https://api.openai.com | gpt-4o, gpt-4o-mini | 否 |
| deepseek | https://api.deepseek.com | deepseek-v4-pro, deepseek-v4-flash, deepseek-chat, deepseek-reasoner | 否 |
| qwen | https://dashscope.aliyuncs.com/compatible-mode | qwen-turbo, qwen-plus, qwen-max | 否 |
| kimi | https://api.moonshot.cn | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k | 否 |

## 边界情况和约束

- apiKey 明文存储，用户自行承担安全风险
- Client 枚举固定，Protocol 枚举固定，用户不可扩展
- Provider 按 Protocol 共享——新增 openai 协议的 client 自动复用所有 openai provider
- 切换 client/provider 时有状态记忆，切回时恢复上次选择
- 注册表存储位置：`~/.done-coding/mrm/sources.json`

## 需求确认记录

| REQ | 确认 |
|------|------|
| REQ-1: Client 管理 | ✅ |
| REQ-2: 列出 (ls) | ✅ |
| REQ-3: Provider 管理 | ✅ |
| REQ-4: Model 管理 | ✅ |
| REQ-5: 删除保护规则 | ✅ |
