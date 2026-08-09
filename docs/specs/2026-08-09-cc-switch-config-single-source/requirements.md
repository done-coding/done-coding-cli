# 需求文档：cc-switch 配置单源化（settings.json）+ 启动前 profile 输出 + 静默选项

> 状态：设计已确认，待实施
> 任务等级：Moderate
> 日期：2026-08-09
> 参与角色：老板（需求方）+ AI（实现）

## 背景

`@done-coding/cli-cc-switch` 0.2.0（2026-08-09 发布）采用 provider.json + model.json 分层源 + `--meta-generate` 生成 profile.json。本轮做**终态收敛**：

- 把 provider/model 两源**合并为单一 settings.json**（provider 内嵌 models），消除扁平 model.json 的 provider id 重复（DRY）与跨文件引用校验这类错误面；profile.json 保留为**编译快照**（运行时单源不变）。
- 新增**启动前输出当前选中 profile 名**（可配置、可静默），供人类确认当前会话路由；MCP/AI 调用可压制避免污染上下文。
- `defaultProfile` 迁入 settings.json 并变**可选**：无默认或 `disabledDefault=true` 时启动进入**交互选择**（与 `--meta-pick` 同逻辑）。

本 spec 是配置形态的**最后一次重排**（此前已拆分 → 加 settings → 合并），一次到位后不再改动。

## 功能需求

### REQ-1: 启动前输出当前选中 profile 名
WHEN `dc-cc-switch` 走 run 路径、层 2 env-guard 守卫全部通过、即将 spawn claude 之前
THE SYSTEM SHALL 向 stdout 输出一行当前选中 profile 名（纯名 + `\n`）
- 三来源统一覆盖：`--meta-profile=<name>` / pick（`--meta-pick` / `disabledDefault` / 无默认）结果 / `defaultProfile`
- 默认输出（`output.profileName` 缺省 = true）
- 守卫失败（settings.json 冲突 / ENOENT / 无可选 profile）**不输出**
- 验收标准：`dc-cc-switch --meta-profile=deepseek-pro` 输出 `deepseek-pro` 后启动 claude

### REQ-2: 新增 `--meta-silent` 压制输出
WHEN 调用带 `--meta-silent`
THE SYSTEM SHALL 压制 `output.*` 命名空间输出（本轮 = REQ-1 的启动前 profile 名 echo），且该选项**不透传**给 claude
- 其余 meta 动作（`--meta-generate` / `--meta-model-list` / `--meta-provider-list` / `setkey` / `addmodel`）的返回值**不受影响**（本就是 AI 请求的结果）
- 配置 `output.profileName=false` 等效压制
- 验收标准：MCP/AI 以 `--meta-silent` 唤起时 stdout 无 profile 名行，claude 参数透传不受影响

### REQ-3: settings.json 单源（provider 内嵌 models）
WHEN 管理 cc-switch 配置时
THE SYSTEM SHALL 以 `~/.done-coding/cc-switch/settings.json` 为**唯一源**
- 结构：`{ defaultProfile?, disabledDefault?, output?: { profileName? }, providers: { [id]: { name, url, apiKey, envExtraParams?, models: [{ id, name, envExtraParams? }] } } }`
- 含 apiKey → 写盘 `chmod 600`（沿用现 provider.json 权限策略）
- **provider.json / model.json 废弃**（文件不再读写）
- 验收标准：一份 settings.json 即可描述全部服务商、模型、默认与输出行为

### REQ-4: `--meta-generate` 编译 profile.json
WHEN 执行 `--meta-generate`
THE SYSTEM SHALL 读 settings.json → 构建 profile 配置（profile 名 = `${provider}-${id}`，env 合并序 `通用 ← provider.envExtraParams ← model.envExtraParams` 不变）→ 写 `profile.json`（600）
- 运行时**照旧读 profile.json**（编译快照，`loadOrInitConfig` 主路径不变）
- 验收标准：settings.json 变更后 `--meta-generate` 产出与手拼一致的 profile.json，语义等价

### REQ-5: 默认可选 + 无默认/禁用默认 → 交互选择
WHEN `defaultProfile` 未配置，或 `disabledDefault=true`，或用户传 `--meta-pick`
THE SYSTEM SHALL 走交互 pick（复用 `pickProfile` 现有逻辑，TTY 弹选择器）；非 TTY → stderr 报错并提示改用 `--meta-profile=<name>`，exit(1)，不挂起
- 解析顺序：`--meta-profile`（显式）→ pick（`--meta-pick` / `disabledDefault`）→ `defaultProfile` → **无默认也 pick**
- `--meta-pick` 与 `--meta-profile` 并存时沿用既有 action 优先级（pick 高），不改变已发布行为
- 验收标准：无 defaultProfile 且未显式指定时 TTY 内弹选择器；`disabledDefault=true` 时即使已配默认也弹选择器

### REQ-6: 迁移与新装策略
WHEN settings.json 缺失但 profile.json 存在
THE SYSTEM SHALL 允许运行时继续用编译快照（源仅影响重编译）；`--meta-generate` / mutate 命令需 settings.json → fail-loud 提示创建/迁移
WHEN 纯新装（无 settings.json 且无 profile.json）
THE SYSTEM SHALL 写 starter settings.json（deepseek 源形态）+ 编译出 profile.json
- 存量 provider.json / model.json **不迁移、不读取**（消费方=1，一次性收敛）
- 验收标准：新装开箱即用；缺源时错误文案指向 settings.json

### REQ-7: mutate / list 命令落点改 settings.json
WHEN 执行 `--meta-apiKey=` / `--meta-model-name=` / `--meta-provider=` / `--meta-provider-list` / `--meta-model-list`
THE SYSTEM SHALL 读写 settings.json（列表从嵌套结构派生；setkey/addmodel 变更后自动重编译 profile.json）
- 语义与 0.2.0 一致，仅源文件从 provider/model.json 换成 settings.json
- 验收标准：`--meta-model-list` 输出 `name（provider）`；`--meta-apiKey=` 更新后 profile.json 同步重建

## 技术约束

- **无新依赖**（dependency gate：若实现需要新依赖，停止并请求授权）
- bin 名 `dc-cc-switch` / 包名 `@done-coding/cli-cc-switch`（当前 0.2.0 已发布；本轮为**破坏性配置变更**，版本升级策略发布时另行定）
- 用户可见输出与退出码稳定（规则 7）；REQ-1 新增输出行属新行为，`--meta-silent` 可关
- 单测框架 vitest；所有测试/回归走临时目录或 git-ignored sandbox，[MUST NOT] 污染工作树与真实 `~/.done-coding/`

## 边界情况和约束

- 非 TTY 触发 pick（无默认 / `--meta-pick` / `disabledDefault`）→ 报错提示 `--meta-profile`，exit(1)
- settings.json 非法 JSON / 缺字段 / 字段类型错 → fail-loud，携带绝对路径 + 失败原因，[MUST NOT] 覆盖/自愈用户文件
- profile.json 缺失 + settings.json 存在 → fail-loud 提示运行 `--meta-generate`
- env-guard 层 2（`~/.claude/settings.json` 的模型路由 key 冲突检测）**不受本轮影响**
- 注意命名：`env-guard.SETTINGS_PATH` 指 Claude Code 的 `~/.claude/settings.json`，与本仓 `~/.done-coding/cc-switch/settings.json` **同名不同物**，代码注释须点明避免混淆

## 需求确认记录

| REQ | 确认 |
|---|---|
| REQ-1 | ✅ 已确认（纯 profile 名一行，stdout，默认输出） |
| REQ-2 | ✅ 已确认（`--meta-silent`，仅压 output.*，不影响 meta 动作返回值） |
| REQ-3 | ✅ 已确认（settings.json 单源，文件名按老板定） |
| REQ-4 | ✅ 已确认（保留编译快照，运行时读 profile.json） |
| REQ-5 | ✅ 已确认（defaultProfile 可选；无默认/disabledDefault → pick；非 TTY 报错） |
| REQ-6 | ✅ 已确认（存量不迁移不读取；纯新装写 starter） |
| REQ-7 | ✅ 已确认（mutate/list 落 settings.json，语义不变） |
