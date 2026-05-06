---
任务等级: Moderate
日期: 2026-05-05
审核状态: 已通过
---

# 任务清单

## TASK-1: mrm index.ts 新增导出 + setProviderApiKey

- [x] 修改 `packages/mrm/src/index.ts`：新增 registry/client-config/presets 方法导出
- [x] 修改 `packages/mrm/src/services/registry.ts`：新增 `setProviderApiKey(protocol, alias, apiKey)` 方法
- [x] 构建：`cd packages/mrm && pnpm build` ✓

## TASK-2: mrm CLI 新增 --client option（7 个命令）

- [x] 修改 `packages/mrm/src/types/index.ts`：新增 `ClientOptions` 接口
- [x] 修改 7 个 handler：ls、model-use、provider-use、provider-add、provider-remove、model-add、model-remove
- [x] 构建：`cd packages/mrm && pnpm build` ✓

## TASK-3: ai 包依赖 + 删除 model-presets.ts

- [x] 修改 `packages/ai/package.json`：新增 8 个子包依赖（mrm/component/config/extract/inject/publish/template/create）
- [x] 删除 `packages/ai/src/services/model-presets.ts`
- [x] 安装依赖 + 构建所有子包（确保 bin 可用） ✓

## TASK-4: ai 包 chat.ts 重写

- [x] 重写 `/provider` 和 `/model` 处理逻辑（委托 mrm）
- [x] 新增 `/xxx` 子包帮助命令（bin 路径搜索 + execSyncHijack）
- [x] 输出格式：颜色提示语 + 版本号 + 帮助文本
- [x] 未知 `/xxx` → 发送给 AI（不静默忽略）
- [x] 保留 `/exit` 和 `/clear` 逻辑不变
- [x] 保留普通文本 AI 对话逻辑不变
- [x] 首次使用流程用 mrm registry 替代旧 presets
- [x] 构建 + lint ✓
