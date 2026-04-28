# 实施文档：模型源管理器（mrm）V2

> 状态：进行中
> 任务等级：Complex
> 日期：2026-04-28

## 当前进度

- 当前任务：TASK-1
- 下一步：重写 types + presets + registry

## TASK-1: 重写类型 + 预设 + 注册表 [P0]

**Files:** types/index.ts, services/presets.ts, services/registry.ts

- [ ] Step 1: 重写 types/index.ts（Provider, ModelEntry, ClientState, Registry, SubcommandEnum 增加新命令）
- [ ] Step 2: 重写 services/presets.ts（内置 Provider 按 protocol 分组，含 builtin 标记）
- [ ] Step 3: 重写 services/registry.ts（新 Registry 结构，Provider CRUD，状态管理，级联回退）
- [ ] Step 4: tsc --noEmit 无错误

## TASK-2: switch + ls handler [P0]

**Files:** handlers/switch.ts, handlers/ls.ts

- [ ] Step 1: 重写 switch handler（ClientState 恢复/初始化）
- [ ] Step 2: 重写 ls handler（--view=model|provider，[内置] 标记，状态行）

## TASK-3: provider handlers [P0]

**Files:** handlers/provider-add.ts, provider-use.ts, provider-remove.ts

- [ ] Step 1: 创建 provider-add handler
- [ ] Step 2: 创建 provider-use handler
- [ ] Step 3: 创建 provider-remove handler（内置保护，级联回退）

## TASK-4: model handlers [P0]

**Files:** handlers/model-add.ts, model-remove.ts, model-use.ts

- [ ] Step 1: 创建 model-add handler
- [ ] Step 2: 创建 model-remove handler（内置保护，级联回退）
- [ ] Step 3: 创建 model-use handler（含 --provider 跨 provider 切模型）

## TASK-5: client-config + 整合 [P0]

**Files:** services/client-config.ts, handlers/index.ts

- [ ] Step 1: 重写 client-config.ts（适配新 Provider 模型）
- [ ] Step 2: 重写 handlers/index.ts（聚合新 handler，mrm use 双注册）
- [ ] Step 3: 删除旧文件：handlers/add.ts, use.ts, remove.ts, test.ts

## TASK-6: 构建 + 验证 [P0]

- [ ] Step 1: tsc --noEmit
- [ ] Step 2: pnpm build
- [ ] Step 3: eslint --fix
- [ ] Step 4: CLI 功能验证
