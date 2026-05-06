# 需求文档：AI 模型切换委托 mrm + 子包帮助命令

> 状态：已审核通过
> 任务等级：Moderate
> 日期：2026-05-05
> 参与角色：PM + 全栈开发专家
> 审核状态：已通过

## 背景

`ai` 子包内置 `model-presets.ts` 维护服务商/模型列表，与 `mrm`（模型源管理器）功能重复、数据不同步。需将 ai 的模型切换内部委托给 mrm 实现。同时新增 `/xxx` 快捷命令，允许用户在聊天窗口中通过 `/子包名` 查看其他子包的帮助信息。

## 功能需求

### REQ-1: 模型切换委托 mrm
WHEN 用户在聊天中输入 `/provider` 或 `/model`
THE SYSTEM SHALL 通过 mrm 的 registry API 列出服务商/模型并执行切换
- `/provider`：列出当前协议（OPENAI）下的服务商，选择后调用 mrm switchProvider
- `/model`：列出当前服务商下的模型，选择后调用 mrm switchModel
- 切换后 config 写入由 ai 包自己接管（保留已有 apiKey）
- 验收标准：`/provider` 和 `/model` 功能正常，模型列表来自 mrm registry

### REQ-2: 子包帮助命令
WHEN 用户在聊天中输入 `/<子包名>`
THE SYSTEM SHALL 展示该子包的帮助信息
- 支持 8 个子包：mrm、component、config、create、extract、inject、publish、template
- 排除：ai（自身）、cli（路由）、git（describe: false）
- 输出顺序：提示语 → 版本号 → 帮助文本
- 颜色区分：提示语（黄色）、"以下是其版本及使用帮助"（青色）、版本号（绿色）、帮助文本（默认色）
- 未知 `/xxx`（不在支持列表中）→ 视为普通文本发给 AI
- 验收标准：`/component` 输出颜色提示 + dc-component 版本号 + dc-component --help

### REQ-3: 保留现有 /exit 和 /clear
WHEN 用户输入 `/exit` 或 `/clear`
THE SYSTEM SHALL 行为与改造前完全一致

### REQ-4: 普通文本对话不受影响
WHEN 用户输入非 `/` 开头的普通文本
THE SYSTEM SHALL 正常发送 AI 请求并获得流式响应

### REQ-5: mrm CLI 支持 --client 选项
WHEN 用户执行 mrm CLI 命令（ls / model use / provider use / provider add / provider remove / model add / model remove）
THE SYSTEM SHALL 支持 `--client <clientName>` 指定目标 client
- `--client` 合法值：`claude-code` / `done-coding-ai`
- 不传 `--client` → 默认操作 `currentClient`（registry 中记录的当前 client）
- 传了 `--client` → 仅本次命令操作指定 client，不改变 `currentClient`
- `switch` 命令保持现有 `<client>` 位置参数，不新增 --client
- 验收标准：`dc-mrm ls --client done-coding-ai` 输出 done-coding-ai 的模型列表

## 技术约束

- `@done-coding/cli-mrm` 依赖版本锁定为 `workspace:0.0.2`
- mrm 通过 `index.ts` 统一导出 registry/client-config/presets 方法
- mrm CLI 所有命令（除 `switch`）新增 `--client` option
- ai 需依赖全部 8 个子包（确保 bin 可用）
- 删除 `packages/ai/src/services/model-presets.ts`
- apiKey 切换后检测为空则提示用户重新输入
- `/xxx` 提示语固定为："当前相关cli未完全ai工具化，敬请期待。\n以下是其版本及使用帮助："
- bin 查找策略：从 `process.cwd()` 向上搜索 `node_modules/.bin/<bin>`

## 边界情况和约束

- mrm 未初始化（registry 文件不存在）时，mrm 自动生成默认 registry
- 非 `/` 开头且非空白的输入一律视为 AI 对话内容
- 未知 `/xxx` 命令（不在支持列表中）→ 视为普通文本发给 AI
- `/` 后为空（仅输入 `/`）→ 视为普通文本发给 AI

## 需求确认记录
| REQ | 确认 |
|---|---|
| REQ-1 | ✅ 已确认 |
| REQ-2 | ✅ 已确认 |
| REQ-3 | ✅ 已确认 |
| REQ-4 | ✅ 已确认 |
| REQ-5 | ✅ 已确认 |
