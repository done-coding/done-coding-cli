# 领域模块 — generator

## 职责

通用具名批次生成（add / modify / remove / list / init）+ assemble 模板组装（配方 → 物化产物 + 漂移闸）+ tree 模块生成（模块模板 + schema 参数 → Recipe.ops）。content-free 机制层，不认业务名词。

## 落点

| 落点                                          | 说明                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `packages/generator`                          | `@done-coding/cli-generator`，bin `dc-generator` |
| `packages/mcp/src/handlers/generator.ts`      | 批次类 MCP 工具（聚合容器内切片）                |
| `packages/mcp/src/handlers/templates.ts`      | 模块模板 / tree 类 MCP 工具（切片）              |
| `packages/cli-skills/skills/cli-generator/`   | 批次生成 skill（切片）                           |
| `packages/cli-skills/skills/module-generate/` | 模块生成 skill（切片）                           |
| `packages/dex/src/extensions/generator.ts`    | Dex 内置 generator 工具（切片）                  |

## 领域边界

- 只提供机制；批次语义在 `.done-coding/<type>/config.json5`，模块模板在 `.done-coding/templates/<base>/`（admin-core 模板由 template-hub 提供）。
- `component` 是本领域的预设薄包装，归 `component` 领域。
