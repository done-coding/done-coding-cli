# 领域模块 — create

## 职责

从模板创建项目：模板来源解析（列表 / 自定义 url / 本地目录）、预设问题采集（交互 / 非交互供答）、模板编译、git 细节优化、实例注册表留痕、完成提示。

## 落点

| 落点                                             | 说明                                   |
| ------------------------------------------------ | -------------------------------------- |
| `packages/create`                                | `create-done-coding`                   |
| `packages/mcp/src/handlers/create.ts`            | prepare / complete + 模板列表 Resource |
| `packages/cli-skills/skills/create-done-coding/` | 创建项目 skill（切片）                 |

## 领域边界

- 模板内容属 template-hub / 各模板仓；本领域只读模板的 `.done-coding/template.json`（`collectEnvDataForm` / `globalEnvData` / `list` / `usageSteps`）。
- 模板编译引擎属 `template` 领域。
