# cc-switch settings v2 设计

## 目标、边界与依据

2026-10-27 用户已确认：身份用 UUID、别名可改，一个服务商可有多个账号。批 A oywqvv 实施配置与命令、迁移、Schema 和 dex；批 B 5p64zz 接入 meta-ui。不开自动账号合并、额度切换或发布。

批 A 的实现依据是仓内 cc-switch 的 config.ts / meta.ts / handlers、dex 的 import/cc-switch.ts 及其回归测试（仓内 MIT 代码）。沿用 Node 内置 crypto.randomUUID 与 fs，不引入依赖或外部片段。v1 的旧编译器保留；独立 v2 解析归一化后共用 env 组合。一次性 CLI 路径保持 sync，纯函数导出供 UI 和 dex 复用；批 B 的 UI 异步 I/O 见下文。

## 数据契约

```ts
interface SettingsV2 {
  $schema?: string;
  version: 2;
  providers: Provider[];
  defaultProfile?: { provider: string; account?: string; model: string };
  disabledDefault?: boolean;
  output?: { profileName?: boolean };
}
// provider / account / model 引用均为 uuid。
// Provider = { uuid, alias, name, url, envExtraParams?, models: Model[] }
//            & ({ apiKey: string } | { accounts: Account[] });
// Account = { uuid, alias, apiKey };
// Model = { uuid, alias, name, envExtraParams? };
```

accounts、models、providers 非空；apiKey 可为空串（沿用初装补全语义）。alias 非空且匹配 `^[A-Za-z0-9][A-Za-z0-9._-]*$`。UUID 为标准 UUID 文本；同一 providers 数组、同一 provider 下 accounts / models 各自 UUID 与 alias 唯一。不同 provider 的局部 UUID 允许重复，默认引用按所属关系解析。

有账号的 profile 名为 `${provider.alias}-${account.alias}-${model.alias}`，否则 `${provider.alias}-${model.alias}`。即使分层 alias 各自唯一，拼名也可能碰撞，必须全局检测并报两个来源。env 按通用字段 ← provider.envExtraParams ← model.envExtraParams 合并，账号提供通用 AUTH_TOKEN，额外 env 仍按既有规则覆盖。

默认引用必须找到 provider、该 provider 下 model，以及 accounts 模式下的 account；单 key provider 不接受 account 引用。悬空时报「默认 profile 悬空」，列可用 profile、提示检查 settings 并重建；不得回退猜测。改 alias 不改 UUID，重新生成自动解析为新 profile 名。

## 读取、补 UUID 与写入

`parseSettings(unknown)` 按版本校验；v1 是无 version 且 providers 为对象，其他版本拒绝。`normalizeSettings` 展开为账号粒度的服务商（id 使用 provider alias 或 provider-account alias，含实际凭据与模型）；dex 消费同一解析器和归一化函数。v2 读取不补 UUID，缺失即错误；v1 读取/生成绝不改 settings，并在 CLI 源读取路径提示 `--meta-migrate`。

`assignMissingUuids(settings)` 返回副本，不修改输入；只对缺失 UUID 的实体使用 crypto.randomUUID，保留已有 UUID 与未声明字段，已有非法值交给校验拒绝。随机生成意味着不是确定性函数，但无文件/输入副作用，供后续 onSubmit 使用。凡 v2 写回先补 UUID 再校验；新增模型使用 alias（去尾部 `[1m]`）与 name（补 `[1m]`）。

settings 写回在同目录排他创建临时文件（600）、校验受控根与真实路径、rename 原子替换；失败清理本次临时文件，旧 settings 保持完整。拒绝符号链接逃逸与可疑根。profile 编译快照保持既有结构与序列化规则。

## v1 兼容与显式迁移

无 version 的旧文件继续按原规则编译，序列化逐字节一致（含字段顺序/env 顺序），不自动升级。旧 meta 修改继续支持 v1，不隐式迁移。

新增 `--meta-migrate`：读取并校验 v1 → 对象键转 provider.alias、model.id 转 alias → 补 UUID → 通过枚举旧 profile 完整名解析默认引用（不按连字符切分）→ v2 校验与编译 → 保存原文件逐字节备份 `settings.json.v1-<时间戳>.bak`（排他创建、600）→ 原子写回。默认无法解析则省略并提示。非法 alias / 重名导致迁移前校验失败，不改原文件、不静默改名。迁移不合并 provider；重复对 v2 迁移提示已是 v2，不备份不重写。迁移不自动重建，提示运行 generate；迁移前后 generate 的完整 profile 快照保持一致。

`$schema` 写为 `https://cdn.jsdelivr.net/npm/@done-coding/cli-cc-switch@<当前包版本>/settings.schema.json`，版本读取包元数据，非硬编码。

## 命令与改名影响

`--meta-provider=<alias>` 选 provider；`--meta-apiKey` 在 accounts 模式需要 `--meta-account=<alias>` 或 TTY 选择，非 TTY 缺参报错，不自动选第一个；单 key provider 收到 account 参数也报错。`--meta-account` 仅用于 apiKey。新增 `--meta-migrate` 与 generate / 修改源动作互斥，help/version 继续优先。

provider/model 列表显示账号 alias（不显示 key）。新增模型为 provider 共享，生成全部账号组合。所有源修改先验证能构建再落盘，避免非法模型污染源。

generate 重建前读取旧 profile 名，成功写入后输出移除/新增名称；存在移除则提示外部 `--meta-profile=` 与脚本按名引用需同步。无变化不输出。旧 profile 不存在视为空；旧 JSON 损坏时提示无法比较，仍允许显式重建修复。不输出任何 env 或凭据。

## JSON Schema 与 UI

随包发布 `settings.schema.json`，draft-07；package.json files 包含它。apiKey 标 `x-dc-ui: { secret: true }`；所有 UUID 字段（含默认引用）标 `readOnly: true`。选择 readOnly 而非隐藏 schema 字段，是为了保留完整结构约束与编辑器提示；后续 config-ui 需原样保留未编辑/未声明字段，onSubmit 为新实体补 UUID 再校验。Schema 负责结构；同层唯一、profile 冲突、默认引用由运行时语义校验负责。仓内若能解析现有 Ajv 就使用其验证，不加依赖；否则用结构断言。

批 B 使用已安装发布版 `@done-coding/config-ui@0.1.0`（MIT），依据其 README、types 及 editor DESIGN 契约。因其 Schema 子集不支持引用、组合和 readOnly，从随包 Schema 选取服务商/账号/模型的可编辑字段组成表单视图；UUID、默认引用、任意 env 键与版本字段不声明，靠原值保留和 arrayOrigins 维持行身份。非空双凭据、唯一性与默认引用仍交原 v2 校验。

config-ui 前端将缺失对象数组初始化为 []。UI 提交先把有单密钥的空 accounts 移除、把非空 accounts 下的空字符串 apiKey 移除，再 assignMissingUuids → 校验/编译 → 原子写 settings → 重建 profile。两份文件使用 fs/promises、600 临时文件和 rename，写前拒绝软链与越界；重建共享现有编译器和改名提示。第二份写入失败时报告 settings 已保存并提示 --meta-generate，不承诺双文件事务。

--meta-ui 与其他 meta 动作和 provider/account 选择器互斥，help/version 仍优先。v1 启动拒绝并提示 --meta-migrate，不隐式迁移。每次打印 URL，非 TTY openBrowser:false；字段校验在页面可重试，语义/保存失败或默认 5 分钟超时由 CLI 非零退出，成功保存并重建后退出 0。沿用上游超时不能撤回已开始回调副作用的限制。

## dex 消费

保留 v1 的 provider id 和模型去 `[1m]` / 去重语义。v2 accounts 展开成 `${provider.alias}-${account.alias}` 的 dex provider，每个账号各自写 auth，不丢账号或覆盖凭据。归一化需检测展开 id 冲突。dex 默认策略保持原有「首个有 key 的服务商首模型」，不在本批改变默认选择政策。使用纯 parse/normalize 处理显式路径读取的文件，避免 cc-switch 默认路径与 dex 测试 HOME 绑定差异。

## 验收与执行顺序

先用临时目录构造 v1 固定基准及 v2 反例并看到失败，再实现。依次交付配置编译/迁移/meta/Schema 的完整 cc-switch 变更、dex 适配、治理收口。检查 v1 字节相同、迁移等价、多账号、alias/UUID/profile 冲突、默认悬空、补 UUID、原子写失败、改名输出、dex 两版本与账号不覆盖。执行两包 test/build、根 test 和 `pnpm exec eslint .`、harness check/instructions；日志与退出码写 PROGRESS。无真实配置、真实凭据或外部服务参与。
