# 领域模块 — cc-switch

## 职责

Claude Code 模型路由：按 profile 注入 env 后 spawn `claude`，其余参数原样透传；`--meta-*` 管理 profile / 服务商 / 模型 / apiKey。原 `mrm`（模型源管理）职责已并入本领域。

## 落点

| 落点                 | 说明                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `packages/cc-switch` | `@done-coding/cli-cc-switch`，bin `dc-cc-switch`（兼容名 `cc-router`） |

`packages/cli` 的 `DC cc-switch` 挂载属共享骨架；`dex` 对其配置的一次性导入归 `dex` 领域。

## 领域边界

- 只管 Claude Code 的路由与配置；对话能力在 `dex`。
