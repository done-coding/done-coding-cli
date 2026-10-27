---
id: 5p64zz
title: cc-switch meta-ui
modules: [cc-switch]
created: 2026-10-27
parent: ""
after: "oywqvv"
---

# PROGRESS — 5p64zz

## 状态

实现、本地验收与批次归档已完成；Claude 验收后代提交（见文末）。2026-10-27 用户授权 Codex 实施、Claude 验收代提交；不写 .git、不 push、不发版。
已核实分支 `feat/cc-switch-settings-v2`、HEAD `8ed6ccd`，初始改动仅为本批依赖及 lockfile。
共享骨架独占：`pnpm-lock.yaml`（Claude 已添加 config-ui 0.1.0，本轮不重新安装或手改）。
实际安装点为 `packages/cc-switch/node_modules/@done-coding/config-ui`，精确版本 0.1.0，MIT。

## 实施与验收安排

- 沿用任务书与已有 DESIGN；进度记在本文件，按用户授权交 Claude 代提交，不运行技能的 git 工作区脚本。
- 实现：meta 参数与互斥 → 随包 Schema 表单视图 → 异步安全写回与自动重建 → 文档和收口。
- 契约裁决：config-ui 不支持 $ref / oneOf / readOnly；表单展开已知引用，隐藏 UUID、默认引用与自由键 env，未知字段由原值保留机制保存。apiKey / accounts 二选一仍由 v2 语义校验负责。
- 完成标准：临时 HOME + openBrowser:false 的真实 HTTP 提交证明删行 UUID 随行、新行补 UUID、改名默认引用有效，失败不改源；包 test/build、dex test、根 eslint、harness check/instructions 全通过。
- 环境预检：沙箱监听 127.0.0.1 返回 EPERM；仅回环监听豁免探针已通过（退出码 0）。后续涉及监听的验收申请同类豁免，其他检查仍走沙箱。
- Node v22.22.2，当前 pnpm 10.33.2；本轮不操作依赖，保留用户已用 CI 10.33.0 核验的 lockfile。

## 任务

- [x] 依赖已发布 @done-coding/config-ui 精确版本。
- [x] --meta-ui 读 settings → serveConfigUI → onSubmit assignMissingUuids + 校验 + 原子写回 → 自动 generate 与改名提示。
- [x] 非 TTY / 无浏览器打印 URL；用户可见启动、保存、失败提示及测试。
- [x] 门禁、快照与归档，串末收工。

## 进展与裁决

- 已实现参数、help、主命令注册、动态载入 UI；UI 的读取、写回和 profile 重建均使用 fs/promises，复用 v2 编译器及改名提示。
- 参数测试 RED：11 例因未知 --meta-ui 失败；GREEN：meta-v2 20 例通过。首次误在仓根启动了聚合测试，已中止且不作为验收；之后均按包内命令执行。
- HTTP 测试先因入口缺失失败；实现后 9 例通过。补充 config-ui 实际空 accounts 数组后出现 422，按前端 adapter 代码核实后修正表单视图。
- 表单空值裁决：accounts=[] 且有单 apiKey → 删除空 accounts；accounts 非空且 apiKey="" → 删除空 apiKey；非空双凭据仍拒绝。此转换仅用于 UI，原 v2 Schema/解析规则不变。
- 构建通过；真实构建产物冒烟通过：成功退出 0，语义失败与 v1 退出 1，profile 与再次执行 --meta-generate 的产物逐字节一致。
- 运行门禁时用 /tmp/cc-switch-metaui-commits/run-check.mjs 设置临时 HOME；首次临时 HOME 导致 Corepack 查 npm latest 被沙箱拒绝，随后固定使用已有 Corepack 缓存并关闭网络，未安装依赖。
- 限制：表单不修改默认引用/任意 env 键；二者及未知字段保留。两份文件分别原子替换，第二份失败会明确说明 settings 已保存；沿用 config-ui 超时不能撤回已开始回调的契约。


## 审查与修正

- 按 requesting-code-review 技能执行一次独立只读审查；无 Critical，发现缺省 profileName 开关显示关闭但运行默认开启。
- 将该发现按用户可见行为重判为本批必须修正：否则 UI 显示与保存后的运行行为不一致。先新增缺省/true/false 三例，缺省例 RED（false ≠ true），补 default:true 后完整 204 例 GREEN；无遗留 Minor。
- 另补第二份文件 rename 失败用例，确认 settings 已保存、profile 原字节保留、错误明确指向 --meta-generate、不输出成功提示且清理临时文件。
- 审查边界逐项裁决：身份/默认/env 隐藏维持既定视图，代价是这些字段需编辑 JSON；删除默认实体或切换其模式拒绝保存，代价是先手动调整默认引用；语义失败关闭会话遵守上游契约，代价是重新打开；双文件事务及超时撤回不扩展，部分成功明确提示；help/version 遇未知或缺值参数仍保持既有校验；本地恶意并发替换目录的竞态不扩展为本批安全模型，当前只保证受控目录检查与静态软链拒绝。

## 最终验收

所有正式门禁通过临时 HOME 运行，Corepack 使用已有缓存并禁网；Node v22.22.2 / pnpm 10.33.2。
HTTP 用例与冒烟因沙箱回环监听 EPERM，经明确豁免运行；未连接外部服务。
完整日志与机器可读退出码位于 `/tmp/cc-switch-metaui-commits/`。

| 目录 | 命令 | 退出码 | 证据 |
| --- | --- | --- | --- |
| packages/cc-switch | pnpm test | 0 | 16 文件，204 例；cc-test.log |
| packages/cc-switch | pnpm build | 0 | cc-build.log；构建器 API Extractor 版本提示保留 |
| packages/cc-switch | pnpm exec eslint . | 0 | 21 条既有 warning、0 error；cc-lint.log |
| packages/dex | pnpm test | 0 | 3 文件，14 例；dex-test.log |
| 仓根 | pnpm exec eslint . | 0 | 23 条既有 warning、0 error；root-lint.log |
| packages/cc-switch | node scripts/smoke-meta-ui.mjs | 0 | 临时 HOME + 构建 CLI + HTTP；成功退出 0，语义失败/v1 退出 1；smoke.log |
| 仓根 | done-coding harness instructions | 0 | instructions.log；归档后通过 |
| 仓根 | done-coding harness check | 0 | harness-check.log；归档后通过 |

| 仓根 | done-coding harness lists | 0 | harness-lists.log；清单按归档状态重生成 |
| 仓根 | pnpm gov:check | 0 | gov-check.log |

## 替换了什么

- meta-ui 未识别入口替换为可等待会话结果的配置编辑动作；独立入口与主 CLI 注册一致，参数/help/README 同步。
- 手改 v2 源后再 generate 的工作增加了表单保存入口：复用原编译器/校验/改名提示，身份随数组行保留，新实体补 UUID。
- UI 写盘使用异步的受控路径检查和 600 原子替换，settings 与 profile 的成功/失败分别明确报告；既有一次性 CLI 写盘路径未全链迁移。
- 新增精确 config-ui 0.1.0 依赖（用户事先已安装），不自行改 lockfile 或新增其它依赖；完整 JSON Schema 保留，UI 采用其表单视图。

## 交付与提交

按本轮要求 Codex 未尝试写 .git；无新 sha，不声称已提交。Claude 验收代提交，材料在 `/tmp/cc-switch-metaui-commits/`。

| 条目 | 交付分组 | sha |
| --- | --- | --- |
| w3oddp | ⓐ meta-ui 实现、依赖、测试、冒烟与 README | `eb9ea3c` |
| 收口 | ⓑ 快照、设计契约、归档与清单 | 归档提交（不自引用） |

## 未验证项

- 未做真实浏览器点击/视觉验收，深层嵌套标签和按钮文案继续由上游 issue 7qrli4 处理；HTTP 冒烟不冒充浏览器验收。
- 未使用用户真实配置或凭据，也未调用 Claude/服务商 API；所有夹具位于临时目录。
- 本轮包门禁使用本机已缓存 pnpm 10.33.2，未重跑 CI 10.33.0；lockfile 沿用用户已用 10.33.0 核对的依赖改动，没有 install。
- 不 push、不发版；未进行发布后的安装/CDN 验证。Git 提交与最终 Claude 验收待接手。

## Claude 复核与代提交（2026-10-27）

- 独立重跑：cc-switch 204 例、dex 14 例、build、`scripts/smoke-meta-ui.mjs`、`dc-harness check` 均 exit 0。
- 真实配置副本端到端（临时 HOME，非 TTY 不弹浏览器）：迁移 + 手工合并 ark-agent-plan 为 157 / 199 两账号后起 `--meta-ui`，
  经 HTTP 模拟页面：deepseek 改别名 ds、删 kimi-k3、新增 glm、账号 157 改 157a → 200；服务商 uuid 集合不变，
  保留行 uuid 与 apiKey / 账号不变，glm 获新 uuid，deepseek-pro 行 envExtraParams 保留，settings 600，改名提示正确，进程 exit 0。
- 实现提交 `eb9ea3c` 由 Claude 代提交，本归档另提一笔。未验证：真实浏览器点击（headless 截图本轮卡住未取得）。
