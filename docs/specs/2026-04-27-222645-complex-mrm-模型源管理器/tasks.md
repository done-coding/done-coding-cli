# 实施文档：模型源管理器（mrm）V2

> 状态：已完成
> 任务等级：Complex
> 日期：2026-04-28

## TASK-1: 重写类型 + 预设 + 注册表 [P0]

**Files:** types/index.ts, services/presets.ts, services/registry.ts

- [x] Step 1: 重写 types/index.ts（Provider, ClientState, Registry, SubcommandEnum 增加新命令）
- [x] Step 2: 重写 services/presets.ts（内置 Provider 按 protocol 分组，含 builtin 标记）
- [x] Step 3: 重写 services/registry.ts（新 Registry 结构，Provider CRUD，状态管理，级联回退）
- [x] Step 4: tsc --noEmit 无错误

## TASK-2: switch + ls handler [P0]

**Files:** handlers/switch.ts, handlers/ls.ts

- [x] Step 1: 重写 switch handler（ClientState 恢复/初始化，隐藏 help）
- [x] Step 2: 重写 ls handler（--view=model|provider，[内置] chalk.magenta，当前项 chalk.green，★ 标记，[1m] 上下文标记）

## TASK-3: provider handlers [P0]

**Files:** handlers/provider-add.ts, provider-use.ts, provider-remove.ts

- [x] Step 1: 创建 provider-add handler（前置校验 provider 存在性）
- [x] Step 2: 创建 provider-use handler
- [x] Step 3: 创建 provider-remove handler（前置校验 + 内置保护，级联回退）

## TASK-4: model handlers [P0]

**Files:** handlers/model-add.ts, model-remove.ts, model-use.ts

- [x] Step 1: 创建 model-add handler（前置校验 provider 存在）
- [x] Step 2: 创建 model-remove handler（前置校验 provider+model，级联回退）
- [x] Step 3: 创建 model-use handler（含 --provider 跨 provider 切模型）

## TASK-5: client-config + 整合 [P0]

**Files:** services/client-config.ts, handlers/index.ts

- [x] Step 1: 重写 client-config.ts（DeepSeek 第三方 env key 注入 / Anthropic 原生清除）
- [x] Step 2: 重写 handlers/index.ts（聚合新 handler，mrm use 双注册）
- [x] Step 3: 删除旧文件：handlers/add.ts, use.ts, remove.ts, test.ts

## TASK-6: 构建 + 验证 [P0]

- [x] Step 1: tsc --noEmit
- [x] Step 2: pnpm build
- [x] Step 3: eslint --fix
- [x] Step 4: CLI 功能验证

## 额外修复（超出原 spec）

- [x] Yargs 扁平 CommandModule[] 路由 bug：同一父级下多位置参数命令被错误路由 → addSubcommands 自动分组修复（packages/utils/src/cli.ts）
- [x] addModel/removeModel 静默丢失修改：findProvider 内部 re-read registry 导致修改在错误副本上 → 改用直接数组查找
