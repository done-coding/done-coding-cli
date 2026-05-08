# 同行评审记录

## 评审概要

整体覆盖 boss 六项需求（目录化拆分 / client add-remove-focus / 协议动态检测 / 数据目录化 / 无后向兼容 / 路径类型注册 utils），REQ 结构清晰，边界情况覆盖较全。以下列出 5 个问题。

## 问题清单

### 问题 #1: REQ-2a.6 "默认 provider + 默认 model" 未具体定义
- 严重度: 严重
- 描述: REQ-2a.6 规定新增 client "初始状态设为该 protocol 的默认 provider + 默认 model"，但未说明各 protocol 的默认值是什么。例如 anthropic 协议下默认 provider 是 "anthropic" 还是 "deepseek"？默认 model 是哪个？架构师无法据此设计初始化逻辑。
- 建议: 明确各协议默认 (provider, model) 组合。可复用 `presets.ts` 中 `DEFAULT_CLIENT_STATE` 模式——或为新增 client 独立定义默认值。

### 问题 #2: REQ-4a 目录结构标记为"推荐"而非确定性描述
- 严重度: 严重
- 描述: REQ-4a 标题写"推荐按协议拆分 provider 数据"，后续也以推荐语气描述。需求文档应对架构师输出确定性结构，而非可选的建议。
- 建议: 移除"推荐"措辞，明确为 [MUST] 级约束；若确有弹性空间，标注哪些字段可调整、哪些不可调整。

### 问题 #3: REQ-3d 仅覆盖 anthropic 协议写入，openai 场景漏缺
- 严重度: 一般
- 描述: REQ-3d 仅规定"当协议为 anthropic 时"写入 protocol 字段。若协议为 openai 时，是否需要同样写入？当前表述隐含 openai 为默认值可省略，但未明确声明。
- 建议: 补充 openai 场景的处理说明，或声明"openai 为默认值，写入时可省略 protocol 字段"。

### 问题 #4: REQ-1d 未提及旧常量生命周期
- 严重度: 建议
- 描述: `const.ts` 中现有 `DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH`（值为 `.done-coding/config.json`）。REQ-1d 新增了两个常量但未说明旧常量是保留、废弃还是删除。架构师需知道旧常量的处理策略。
- 建议: 补充说明旧常量的处理方式（保留用于非 AI 全局配置读取 / 标记 deprecated / 直接删除）。

### 问题 #5: REQ-1c "静默忽略"可能造成用户困惑
- 严重度: 建议
- 描述: 旧 config.json 含 AI_CONFIG 时系统静默忽略，用户无法感知配置未被读取。虽然 boss 要求无迁移，但静默与透明原则有轻微冲突。
- 建议: 评估是否在首次检测到旧格式时输出一条 warning（不阻塞，不迁移），告知用户配置已拆分，需手动迁移。不强制——若 boss 坚持静默，当前表述可接受。
