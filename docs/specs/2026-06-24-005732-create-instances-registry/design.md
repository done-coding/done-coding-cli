# Design — `dc create` 中央实例注册表

> 关联 requirements.md（同目录）｜ 等级 Moderate

## 变更范围防火墙

**Direct Targets（计划修改 / 新增）**
- `packages/create/src/utils/instances-registry.ts`（**新增**）—— 注册表读写核心。
- `packages/create/src/handlers/instances.ts`（**新增**）—— `instances ls` / `instances prune` 子命令 handler。
- `packages/create/src/handlers/create.ts`（改）—— 两个成功收尾点挂 record；`CreateDraftState` 加 `templateName`。
- `packages/create/src/utils/templateSource.ts`（改）—— `TemplateSourceInfo` 加可选 `templateName`。
- `packages/create/src/utils/index.ts`（改）—— 导出 instances-registry。
- `packages/create/src/handlers/index.ts`（改）—— `commandCliInfo.subcommands` 注册 instances 子命令组。
- `packages/create/__tests__/instances-registry.test.ts`（**新增**）—— vitest 单测（沙盒 tmpdir）。
- `packages/create/__tests__/noninteractive.e2e.test.ts`（改）—— runCli 注入沙盒 env + 端到端留痕断言。

**Collateral Reads（仅参考，[MUST NOT] 改）**
- `packages/create/src/utils/local-config.ts`（`~/.done-coding/create/` 路径范式来源）。
- `packages/generator/src/handlers/index.ts`（子命令注册范式参考）。

**Out-of-Scope（[MUST NOT] 触碰）**
- `materializeTemplateToProject` / 模板编译 / git 优化等主创建逻辑——只在其成功后追加副作用。
- gen 批次层 `.done-coding/<type>/`、`local-config.ts` 指针解析。

**Self-Healing**：验证失败分析日志修一次；二次失败停下汇报。

## 数据结构

落点常量（复用 local-config 的 home 范式）：

```
~/.done-coding/create/instances.json
```

```ts
interface CreateInstanceRecord {
  path: string;            // 绝对路径，upsert 键
  template: string;        // 模板标识：choice.name 优先，无名回落 templateUrl
  templateVersion?: string;// best-effort，本轮恒缺省
  templateUrl?: string;
  templateBranch?: string;
  createdAt: string;       // ISO 8601
}
interface CreateInstancesRegistry { instances: CreateInstanceRecord[]; }
```

R6 合规：无业务字段，仅路径 + 模板标识 + 版本 + 时间。

## 模块 API（instances-registry.ts）

```ts
// baseDir 注入点：默认 homedir()，测试传 tmpdir → 不碰真实 ~/.done-coding
const getRegistryPath = (baseDir = homedir()) =>
  path.resolve(baseDir, ".done-coding/create/instances.json");

readRegistry(baseDir?): CreateInstancesRegistry        // 不存在/损坏 → { instances: [] }，不抛
recordCreateInstance(input, baseDir?): void            // upsert by path + 原子写；内部 try/catch 吞错告警
listInstances(baseDir?): (CreateInstanceRecord & { missing: boolean })[]
pruneInstances(baseDir?): { removed: number; kept: number }
```

- **upsert**：`instances.filter(r => r.path !== input.path)` 后 push 新条目（最新在尾）。
- **原子写**：`writeFileSync(tmp, json)` → `renameSync(tmp, target)`；`tmp` 同目录（`target + '.tmp-' + pid` 同分区保证 rename 原子）；先 `mkdirSync(dir,{recursive:true})`。与 create.ts 既有 renameSync 范式一致，不引依赖。
- **record 不阻塞主流程（R7）**：`recordCreateInstance` 整体 try/catch，失败 `outputConsole.warn` 后静默返回——这是「best-effort 副作用」的边界，调用方无需再包。
- **missing 判定**：`!existsSync(r.path)`。
- **路径安全**：写目标是固定常量路径（非用户可注入），仅 file 写、无目录 rm；prune 只改 JSON 数组、不碰 fs 项目。符合项目「运行时路径安全」约束（无无界 rm）。

## 模板名透传

`resolveTemplateSourceInfo`（create.ts）当前 `return resolveTemplateSourceFromUrl({...})`，丢弃 choice.name。改为：

```ts
const sourceInfo = resolveTemplateSourceFromUrl({...});
sourceInfo.templateName = chosenName; // 列表分支 = target.name；自定义/公共仓分支 = undefined
return sourceInfo;
```

- `TemplateSourceInfo` 加 `templateName?: string`（仅在 create 包内消费，materialize 不读、不变换）。
- 非交互：`prepareCreateProject` 内 `state.templateName = templateSource.templateName`（在 materialize 前从 templateSource 直接取，绕开 materialize 返回体）。
- 交互：`interactiveCreateHandler` 已有 `templateSource`，record 时取 `templateSource.templateName`。
- `template` 字段最终值 = `templateName ?? templateUrl`（templateUrl 恒在）。

## 两个成功收尾挂点

| 路径 | 挂点 | 入参来源 |
|---|---|---|
| 非交互 | `completeCreateProject` 内 `moveDraftProjectToTarget(state)` 成功之后、return 之前 | `state.targetProjectPath` / `state.templateName` / `state.templateUrl` / `state.templateBranch` |
| 交互 | `interactiveCreateHandler` 末尾 `outputConsole.success` 之后 | `projectNamePath` / `templateSource.*` |

两处均在「项目已落位成功」之后，故 R1（失败/中断不写）天然成立：非交互失败在 complete 内抛出、走不到 record；交互失败 `process.exit(1)` 早退。

## 子命令注册（handlers/index.ts + instances.ts）

比照 generator `commandCliInfo.subcommands: [...].map(createSubcommand)`。用**单命令 + action positional** 承载（CLI 上仍是 `dc create instances ls` / `instances prune`，避开 yargs 双字面 token 歧义）：

```ts
// instances.ts —— ls/prune 纯函数 + 分发器
export const instancesLsHandler = () => { /* listInstances → 逐行打印；missing 标 (missing) */ };
export const instancesPruneHandler = () => { /* pruneInstances → 打印 removed 条数 */ };
export const instancesCommandCliInfo: SubCliInfo = {
  command: "instances <action>",   // action ∈ ls | prune；未知动作 → error + exit 1
  describe: "本机创建实例：ls 枚举 / prune 清理失效条目",
  handler,                          // 内部 switch(argv.action) 分发
};

// handlers/index.ts：commandCliInfo.subcommands 增 instancesCommandCliInfo（保留 $0=create 默认命令）
subcommands: [createCommandCliInfo, instancesCommandCliInfo].map(createSubcommand)
```

- `ls` 输出对齐需求单示例：`<path>  <template>  <createdAt|(missing)>`，零项目扫描（只读单文件）。
- 注册表 baseDir 用 homedir（与 cwd 无关）；新增 env seam `DC_CREATE_INSTANCES_BASE_DIR` 供 e2e 子进程重定向到沙盒，避免污染真实 `~/.done-coding`。

## 产物读写闭环

| 维度 | 回答 |
|---|---|
| 生产者 | `recordCreateInstance`（create 成功收尾）写 `instances.json` |
| 写入时机 | 两个成功收尾点 + `prune`（重写） |
| 消费者 | `lsHandler` / `pruneHandler`；用户 `instances ls` |
| 读取时机 | 用户跑子命令时 |
| 消费行为 | ls 打印枚举；prune 重写去除失效条目 |

## 测试计划（vitest，沙盒 tmpdir）

`instances-registry.test.ts`，每例 `os.tmpdir()` 建临时 baseDir，[MUST NOT] 碰真实 `~/.done-coding`，afterEach 清理：

1. record → readRegistry 出现该条，字段正确（path/template/createdAt）。
2. 同 path 二次 record → upsert，instances 长度仍 1（R5 不堆重复）。
3. record 两个不同 path → listInstances 长度 2。
4. 删掉某 path 对应目录 → listInstances 该条 `missing: true`。
5. prune → 移除 missing 条目，返回 `removed` 计数；存在的条目保留。
6. 原子写：注册表中途已有内容，record 后内容完整可解析（无半写）。
7. record 写入失败（baseDir 指向不可写/被文件占位的路径）→ 不抛异常（R7）。

ls/prune handler 走纯函数复用（lsHandler 内部调 listInstances），核心逻辑单测覆盖即可；handler 层 stdout 不强测。

## 验收映射

R1→测 1+挂点分析；R2→路径常量；R3→test 3+4+ls；R4→test 5；R5→test 2+6；R6→数据结构字段封闭；R7→test 7。
