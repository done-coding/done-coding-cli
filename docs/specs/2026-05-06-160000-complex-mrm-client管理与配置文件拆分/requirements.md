# 需求文档：mrm Client 管理与配置文件拆分

> 状态：已审核通过（老板授权跳过需求审核，最终验收把关）
> 任务等级：Complex
> 日期：2026-05-06
> 参与角色：PM + 产品专家 + 架构师 + 全栈开发专家 + 测试专家

## 需求可行性评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 工作量 | 8 | 涉及 3 个子包（ai/mrm/utils），约 15+ 文件变更，含配置迁移逻辑、新 CLI 命令、动态协议检测 |
| 关联密度 | 7 | utils 定义路径/类型供 ai 和 mrm 共同消费；mrm 写 ai config 目录、ai 读同目录；共享 AiConfig 类型和 Protocol 枚举 |

不触发拆分（关联密度较高，单期可执行）。

## 跨系统影响分析

| 受影响的系统/文件 | 影响边界 |
|------|------|
| `packages/utils/src/const.ts` | 新增 `ai/config.json` 和 `mrm/` 目录的路径常量；调整全局 config 路径含义 |
| `packages/utils/src/cli-config.ts` | 拆分 `AiConfig` 类型和 AI 配置读写方法；全局 config 不再包含 AI_CONFIG |
| `packages/mrm/src/services/presets.ts` | DONE_CODING_AI 不再硬编码 OPENAI 协议；新增 client 定义从文件读取 |
| `packages/mrm/src/services/registry.ts` | registry 从单文件 → 目录结构读写 |
| `packages/mrm/src/services/client-config.ts` | 写入路径从 `config.json` → `ai/config.json` |
| `packages/mrm/src/handlers/` | 新增 client add/remove/focus handler |
| `packages/mrm/src/types/index.ts` | Client 接口含 builtin 字段；新增 client 管理子命令枚举 |
| `packages/mrm/src/index.ts` | 导出新增的 client 管理方法 |
| `packages/ai/src/handlers/chat.ts` | config 读写路径从 `config.json` → `ai/config.json` |
| `~/.done-coding/config.json` | 不再包含 AI_CONFIG 字段 |
| `~/.done-coding/ai/config.json` | 新文件，ai 独立配置 |
| `~/.done-coding/mrm/` | 从单文件升级为目录 |

## 背景

当前 `~/.done-coding/config.json` 混合存放全局配置（ASSETS_CONFIG_REPO_URL）和 AI 专属配置（AI_CONFIG: model/apiKey/baseUrl/protocol），不符合关注点分离原则。mrm 注册表（`~/.done-coding/mrm/sources.json`）使用单文件存储，随着 client 管理能力增强需要更灵活的组织方式。同时，mrm 内置的 `done-coding-ai` client 被硬编码为 OPENAI 协议，未感知 ai 包的 `/protocol` 命令切换结果。

## 功能需求

### REQ-1: 配置文件目录化拆分

WHEN 系统初始化配置目录
THE SYSTEM SHALL 按以下路径组织配置文件：

```
~/.done-coding/
├── config.json              ← 仅全局配置（ASSETS_CONFIG_REPO_URL 等非 AI 字段）
├── ai/
│   └── config.json          ← AI 专属配置（model/apiKey/baseUrl/protocol）
└── mrm/                     ← mrm 数据目录（见 REQ-4）
```

- **REQ-1a: 全局 config.json 精简**
  THE SYSTEM SHALL 保留 `~/.done-coding/config.json` 仅存放全局配置项（ASSETS_CONFIG_REPO_URL），[MUST NOT] 再包含 AI_CONFIG 及其子字段。

- **REQ-1b: AI 配置独立**
  THE SYSTEM SHALL 创建 `~/.done-coding/ai/config.json` 存放 `{ model, apiKey, baseUrl, protocol }`。protocol 字段可选，缺失时默认 `"openai"`。

- **REQ-1c: 不复用旧文件**
  系统 [MUST NOT] 提供旧格式 → 新格式的自动迁移。用户手工迁移或删除后由系统按新格式重建。首次运行时若旧文件（`~/.done-coding/config.json`）包含 `AI_CONFIG` 字段：
  - 系统静默忽略该字段（不读取、不报错）
  - [MUST] 输出一条 warning 到 stderr：`[WARN] 检测到 ~/.done-coding/config.json 包含旧的 AI_CONFIG 字段，该字段已迁移到 ~/.done-coding/ai/config.json。请手动迁移后删除旧字段。`
  - warning 仅在新格式文件（`~/.done-coding/ai/config.json`）尚未存在时输出，避免每次启动重复提示

- **REQ-1d: 路径常量和类型集中注册**
  THE SYSTEM SHALL 在 `@done-coding/cli-utils` 中注册以下新常量和类型：
  - `const.ts`：新增 `DONE_CODING_AI_CONFIG_RELATIVE_PATH`（值为 `.done-coding/ai/config.json`）、`DONE_CODING_MRM_CONFIG_RELATIVE_DIR`（值为 `.done-coding/mrm`）
  - 已有常量 `DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH`（值为 `.done-coding/config.json`）[MUST] 保留，其路径不变，但用途收敛为仅读写全局配置（ASSETS_CONFIG_REPO_URL 等非 AI 字段）；[MUST NOT] 删除或标记 deprecated
  - `cli-config.ts`：新增 `getAiConfigFilePath()`、读取/写入 AI 配置的方法；`AiConfig` 类型保留但独立于 `DoneCodingCliGlobalConfig`；`DoneCodingCliGlobalConfig` 移除 `AI_CONFIG` 字段

- 验收标准：
  - `~/.done-coding/config.json` 不含 `AI_CONFIG` 字段
  - `~/.done-coding/ai/config.json` 独立存在且被 ai 包和 mrm 包正确读写
  - 不存在旧格式文件时无任何报错

### REQ-2: mrm Client 管理命令

WHEN 用户管理 mrm 中的 client 定义
THE SYSTEM SHALL 提供以下子命令：

- **REQ-2a: 添加 client**
  `dc-mrm client add <name> <protocol> <configPath>`

  1. name 为 client 标识名（如 `my-client`），[MUST] 是 kebab-case 格式，不与已有 client 重名
  2. protocol 为 `anthropic` 或 `openai`
  3. configPath 为该 client 的配置文件绝对路径（如 `/path/to/settings.json`），mrm 将在切换/应用模型时写入该文件
  4. 添加成功后 [MUST] 输出该 client 的配置文件绝对路径和绑定协议
  5. 新 client 自动归属于对应 protocol，共享该 protocol 下所有 provider
  6. 新 client 的初始状态设为该 protocol 的默认 provider + 默认 model：
     - `anthropic` 协议：默认 provider = `"anthropic"`，默认 model = `"haiku"`（取该协议第一个内置 provider 的第一个 model）
     - `openai` 协议：默认 provider = `"openai"`，默认 model = `"gpt-4o"`（取该协议第一个内置 provider 的第一个 model）
     > 默认值来源：各协议 `BUILTIN_PROVIDERS_BY_PROTOCOL` 中首个 provider 的 alias + 首个 model。架构师在设计时 [MUST] 确保新增 client 的初始 (provider, model) 与上述定义一致。
  7. 添加成功后 [MUST NOT] 自动切换当前 client

- **REQ-2b: 删除 client**
  `dc-mrm client remove <name>`

  1. [MUST NOT] 删除内置 client（`claude-code` / `done-coding-ai`），尝试删除时提示 "不能删除内置 client: <name>"
  2. 删除前要求用户确认（交互式 y/n）
  3. IF 删除的是当前 client → 自动回退到内置默认 client（`claude-code`），恢复其状态
  4. 删除后清理该 client 的状态记录

- **REQ-2c: 切换当前 client（focus）**
  `dc-mrm client focus <name>`

  1. name [MUST] 在已注册的 client 列表中，否则报错并列出可用 client
  2. 切换到目标 client，恢复其上次的 (provider, model) 组合
  3. IF client 从未被使用 → 设为该 client 的默认 provider + 默认 model
  4. 切换后状态行显示 `当前: <client> → <provider> → <model>`
  5. 保留旧命令 `dc-mrm switch <name>` 作为 `focus` 的别名（向后兼容），但 help 文本中不再列出

- **REQ-2d: Client 定义持久化**
  client 列表（含 name/protocol/configPath/builtin）[MUST] 持久化在 mrm 数据目录中，新增的 client 在重启后仍可用。

- 验收标准：
  - `dc-mrm client add test-client openai /tmp/test-config.json` 创建成功并输出配置路径
  - `dc-mrm client remove test-client` 删除成功（需 y 确认）
  - `dc-mrm client remove claude-code` 报错 "不能删除内置 client: claude-code"
  - `dc-mrm client focus done-coding-ai` 切换到 done-coding-ai 并恢复其状态

### REQ-3: done-coding-ai 协议动态检测

WHEN mrm 需要获取 `done-coding-ai` 的协议
THE SYSTEM SHALL 从 `~/.done-coding/ai/config.json` 读取 `protocol` 字段，而非硬编码。

- **REQ-3a: 移除硬编码**
  `BUILTIN_CLIENTS` 中 `done-coding-ai` 的 `protocol` 字段 [MUST NOT] 硬编码为 `Protocol.OPENAI`。该 client 的协议应由运行时读取 AI 配置文件决定。

- **REQ-3b: 默认回退**
  IF `~/.done-coding/ai/config.json` 不存在或其中无 `protocol` 字段 → 默认协议为 `openai`。

- **REQ-3c: 协议变更联动**
  WHEN 用户在 ai 包中通过 `/protocol` 切换协议 → `~/.done-coding/ai/config.json` 的 `protocol` 字段更新 → mrm 下次读取时自动感知新协议 → `ls` 和 `model use` 等命令基于新协议展示 provider 和 model。

- **REQ-3d: 保持 client-config 写入兼容**
  `writeClientConfig` 在写入 `~/.done-coding/ai/config.json` 时：
  - 协议为 `anthropic` 时，[MUST] 写入 `protocol: "anthropic"` 字段
  - 协议为 `openai` 时，可省略 `protocol` 字段（`openai` 为默认值，读取时缺失即视为 `openai`），亦可显式写入 `"openai"`
  - [MUST NOT] 覆盖目标文件中已有的非 mrm 字段（浅合并）

- 验收标准：
  - 用户通过 `/protocol` 切换到 anthropic → `dc-mrm ls` 列出 anthropic 协议下的 provider
  - 用户通过 `/protocol` 切换到 openai → `dc-mrm ls` 列出 openai 协议下的 provider
  - `~/.done-coding/ai/config.json` 无 protocol 字段 → mrm 默认按 openai 处理

### REQ-4: mrm 数据目录化

WHEN mrm 读写注册表数据
THE SYSTEM SHALL 使用 `~/.done-coding/mrm/` 目录替代单文件 `sources.json`。

- **REQ-4a: 目录结构（[MUST]）**

  系统 [MUST] 按以下确定结构组织 mrm 数据目录，按协议拆分 provider 数据、按文件分离关注点：

  ```
  ~/.done-coding/mrm/
  ├── clients.json            ← [MUST] client 定义列表 [{ name, protocol, configPath, builtin }]
  ├── registry.json           ← [MUST] { currentClient, clientState: { <name>: { provider, model } } }
  └── providers/
      ├── anthropic.json      ← [MUST] anthropic 协议 provider 列表
      └── openai.json         ← [MUST] openai 协议 provider 列表
  ```

  文件职责不可合并或调整：
  - `clients.json` 与 `registry.json` [MUST] 为独立文件，[MUST NOT] 合并为单文件
  - provider 文件 [MUST] 按协议拆分（一个 protocol 一个文件），[MUST NOT] 合并所有协议到一个文件
  - provider 文件名 [MUST] 为 `<protocol>.json`（小写协议名）

  > 拆分理由：provider 数据天然按协议隔离（启动时只需加载当前 client 所属协议）；client 定义与 provider 列表解耦（client 增删不触碰 provider 文件）；registry 状态独立于 provider 定义（用户切换 client 只写 registry.json）。

- **REQ-4b: 初始化和容错**
  - 首次使用时，若 `~/.done-coding/mrm/` 目录不存在 → 自动创建完整目录结构，写入内置 client 和内置 provider
  - 若目录存在但部分文件缺失 → 补齐缺失文件（如新增 protocol 时自动创建对应的 provider 文件），不覆盖已有文件
  - `clients.json` 读取时若发现新增了内置 client（升级场景）→ 自动补齐到文件

- **REQ-4c: 不再使用旧文件**
  [MUST NOT] 读取 `~/.done-coding/mrm/sources.json`。旧文件不作迁移，用户可手工删除。

- 验收标准：
  - 删除 `~/.done-coding/mrm/` 后运行 `dc-mrm ls` → 自动创建完整目录结构，列出内置数据
  - 新增 client 后检查 `~/.done-coding/mrm/clients.json` 包含新条目
  - 新增 provider 后检查 `~/.done-coding/mrm/providers/openai.json` 包含新条目

## 技术约束

- [MUST NOT] 提供旧配置文件到新格式的自动迁移逻辑
- ai 包和 mrm 包 [MUST] 通过 `@done-coding/cli-utils` 的统一方法读写各自的配置文件，[MUST NOT] 各自实现路径拼接
- mrm 的 `writeClientConfig` 在写入 `done-coding-ai` client 时 [MUST] 保留目标文件中已有的非 mrm 字段（浅合并，不覆盖未知 key）
- 新增 client 和其状态在 `clients.json` / `registry.json` 中持久化
- `done-coding-ai` 的 `configPath` 指向 `~/.done-coding/ai/config.json`（移除旧的 `~/.done-coding/config.json` 引用）
- 保持现有 provider 和 model 管理命令（add/use/remove）行为不变，仅内部读写路径和协议检测逻辑调整
- `dc-mrm switch` 命令保留但标记为 deprecated alias，help 文本不再列出

## 边界情况和约束

### 配置文件边界情况

- `~/.done-coding/ai/config.json` 不存在时 → `readAiConfig()` 返回 `{ protocol: "openai" }`（model/apiKey/baseUrl 为 undefined），不报错
- `~/.done-coding/ai/config.json` 存在但 `protocol` 字段缺失 → 按 `"openai"` 处理
- `~/.done-coding/config.json` 仍包含旧的 `AI_CONFIG` 字段 → 系统静默忽略（不读取、不报错）
- 用户通过 ai 包 `/protocol` 切换协议后，ai config 中的旧 `model` 和 `baseUrl` 被清除 → mrm 重新加载时检测到协议变更，需提示用户重新选择 provider 和 model
- `writeClientConfig` 写入 ai config 时，若目标文件已有非 AI_CONFIG 的顶层字段 [MUST] 保留

### mrm 目录边界情况

- `~/.done-coding/mrm/` 目录不存在 → 自动创建
- 目录下某 protocol 的 provider 文件缺失 → 自动补齐内置 provider
- 两个文件出现不一致（如 clients.json 中存在某 client 但 registry.json 无其状态）→ 自动补齐默认状态
- 并发写入 mrm 文件（极低概率）→ 不保证原子性，最后写者胜出

### Client 管理边界情况

- `client add` 时 name 为 kebab-case 非空字符串，非法字符（空格、大写字母、特殊符号）→ 拒绝并提示格式要求
- `client add` 时 configPath 指向不存在的目录 → 接受注册，首次 `writeClientConfig` 时自动创建目录
- `client add` 重复添加同名 client → 报错 "client: <name> 已存在"
- `client remove` 删除内置 client → 报错 "不能删除内置 client: <name>"
- `client remove` 删除当前 client → 自动回退到 `claude-code`
- `client remove` 仅剩 1 个 client（且是内置的）→ 允许删除（因为必定是某个内置 client，被保护），实际效果为报错
- `client remove` 仅剩 1 个自定义 client + 无其他 client → 允许删除，删除后回退到默认内置 client
- `client focus` 切换到不存在的 client → 报错并列出全部可用 client 名
- `client focus` 在已注册 client 间切换，每次恢复其各自的 (provider, model) 状态

### 协议检测边界情况

- `done-coding-ai` 的 protocol 在 ai config 中设为非法值（非 `openai`/`anthropic`）→ 默认 `openai` 并静默处理
- 用户在 ai 聊天中 `/protocol` 切换到 anthropic → 再 `dc-mrm ls --client done-coding-ai` → 应基于 anthropic 协议展示

## 需求确认记录

| REQ | 确认 |
|---|---|

## PO-B 反馈处理记录

| # | 严重度 | 问题 | 处理 |
|---|---|---|---|
| 1 | 严重 | REQ-2a.6 默认 provider/model 未具体定义 | 已补充：anthropic 协议默认 provider=`"anthropic"` + model=`"haiku"`；openai 协议默认 provider=`"openai"` + model=`"gpt-4o"`。均取自各协议首个内置 provider 的 alias + 首个 model，并标注来源为 `BUILTIN_PROVIDERS_BY_PROTOCOL` |
| 2 | 严重 | REQ-4a 目录结构标记为"推荐"而非确定性 | 已改为 [MUST] 级约束：标题改为"目录结构（[MUST]）"，每个文件标注 [MUST]，新增"文件职责不可合并或调整"小节明确禁止合并文件、禁止跨协议合并 provider 文件、规定文件命名格式 |
| 3 | 一般 | REQ-3d 仅覆盖 anthropic 写入，openai 场景漏缺 | 已补充：拆分为两条规则——anthropic 时 [MUST] 写入 `protocol: "anthropic"`；openai 时可省略（默认值）或显式写入，均不覆盖非 mrm 字段 |
| 4 | 建议 | REQ-1d 未提及旧常量 `DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH` 生命周期 | 已补充：旧常量 [MUST] 保留，路径不变，用途收敛为仅读写全局配置（非 AI 字段），[MUST NOT] 删除或标记 deprecated |
| 5 | 建议 | REQ-1c "静默忽略"旧 AI_CONFIG 可能造成用户困惑 | 已改进：保留静默忽略行为（不读取、不报错），但 [MUST] 输出一条 stderr warning 告知用户配置已拆分并引导手动迁移；warning 仅在新格式文件不存在时输出一次，避免重复提示 |
