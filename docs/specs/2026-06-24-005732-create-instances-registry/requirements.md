# Requirements — `dc create` 脚手架实例留痕（中央本机注册表）

> 来源需求单：template-hub 侧《done-coding-cli 需求单 — `dc create` 脚手架实例留痕》（2026-06-23）
> 受理：done-coding-cli（`packages/create` owner）｜ 等级：Moderate（三阶段）
> 日期：2026-06-24

## 背景痛点

回答「本机有哪些项目基于我们模板创建」时无任何留痕，只能挨个扫本机目录猜。`dc create` 当前仅写 `.done-coding/default/tmp/create` 临时草稿（落位即清），无持久记录。免扫描的解法 = **中央本机注册表**（不是项目内留痕——项目内仍要挨个扫）。

## 已锁定决策（受理方拍板，2026-06-24）

| 决策点 | 选定 | 依据 |
|---|---|---|
| 命令面 | **子命令** `dc create instances ls` / `dc create instances prune` | 用户确认；可扩展、与 prune 动词同构 |
| 本轮范围 | **只做 ⓐ 中央注册表**；ⓑ 项目内 `created-from.json` 不做 | 用户确认；ⓑ 非免扫描关键，可后续单加 |
| 存储格式 | 单文件 `instances.json`（非 `.jsonl`） | upsert-by-path 本需全量重写，jsonl append 优势用不上；单 JSON + temp-rename 原子写最简 |
| `template` 字段取值 | choice.name 优先；自定义 URL / 公共仓无名时回落 `templateUrl` | 现状 `resolveTemplateSourceInfo` 解析后丢弃 name，需透传 |
| `templateVersion` | best-effort：当前无版本来源 → 缺则省略该字段 | 需求单 §3 标「若有」；R6 仅要求 path/标识/版本/时间 |

## 验收线

- **R1** [MUST] `dc create` **成功**脚手架后向中央注册表 **upsert 一条实例记录**；失败 / 中断 [MUST NOT] 写。
  - 可观察：两条成功路径（非交互 `completeCreateProject` 落位成功、交互 `interactiveCreateHandler` 收尾成功）均留痕；非交互失败（缺必填 fast-fail）后注册表无新条目。
- **R2** [MUST] 注册表落 `~/.done-coding/create/instances.json`（复用已有目录），[MUST NOT] 写入任何 git 仓 / 项目目录，不需 gitignore。
- **R3** [MUST] `dc create instances ls` 读**单文件**即列出全部本机实例，**零项目扫描**；逐条输出 path / template / createdAt；对 `path` 已不存在的标 `(missing)`。
- **R4** [SHOULD] `dc create instances prune` 移除 `path` 已不存在的条目；输出清理条数；仅删注册表 JSON 条目，[MUST NOT] 删任何项目文件。
- **R5** [SHOULD] 并发 / 重复创建安全：同 `path` 重建 = **upsert**（覆盖该条、不堆重复）；写入**原子**（temp 文件 + rename，避免并发 / 中断损坏）。
- **R6** [MUST NOT] 记录任何业务敏感信息——条目仅含 `path` / `template`（模板标识）/ `templateVersion?` / `templateUrl?` / `templateBranch?` / `createdAt`。
- **R7（受理方追加）** [MUST] 留痕为**副作用、不影响主流程**：record 失败（IO / 权限）仅告警，[MUST NOT] 中断或回滚已成功的创建（需求单 §4「失败不影响主流程」）。

## Out-of-Scope（本轮 [MUST NOT] 触碰）

- ⓑ 项目内 `created-from.json` 溯源（延后）。
- 跨机器汇总 / 上报服务端。
- 项目后续生命周期追踪（改名 / 迁移仅由 prune 被动清理）。
- 改 `dc create` 现有脚手架行为 / 产物（仅追加留痕副作用）。
- `templateVersion` 的主动探测（读模板仓 package.json 等）——本轮缺则省略。

## §5 验收清单（出自需求单，逐条可跑）

1. 跑 `dc create` 建项目 → `instances.json` 出现对应条目，path / template / createdAt 正确。
2. `instances ls` 读单文件列全部、零扫描；删掉某项目后该条标 `(missing)`，`prune` 可清。
3. 创建失败 / 中断 → 注册表无脏条目。
</invoke>
