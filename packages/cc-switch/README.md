# @done-coding/cli-cc-switch

```
模型路由
```

## 使用

```bash
npm install @done-coding/cli-cc-switch
```

安装后提供两个命令入口（指向同一 `es/cli.mjs`）：

- `dc-cc-switch` — 正式命令名
- `cc-router` — 兼容入口（迁移自 `@ccsuite/cli-router` 保留）

```bash
dc-cc-switch [command] [options]   # 正式
cc-router [command] [options]      # 兼容
```

除 `--meta-*` 外的所有参数**原样透传**给 claude。

## meta 选项（cc-switch 自身命令面，不透传）

| 选项 | 行为 |
| ---- | ---- |
| `--meta-profile=<name>` | 显式指定 profile 启动 |
| `--meta-pick` | 终端交互选择 profile 启动（需 TTY） |
| `--meta-help` | 显示自身帮助 |
| `--meta-version` | 显示自身版本 |

优先级：`--meta-help` > `--meta-version` > `--meta-pick` > `--meta-profile=`。

<!-- repo-map:start -->

## 目录导航（自动维护，勿手改段内 — 由项目初始化脚本重跑刷新）

- `.done-coding/` — 注入配置
- `src/` — 源码
  - `__tests__/` — 单元测试
    - `config.test.ts`
    - `deepseek-template.test.ts`
    - `env-guard.test.ts`
    - `parse-argv.test.ts`
    - `prompt-interactive.test.ts`
    - `prompt.test.ts`
    - `run-router.test.ts`
    - `select-profile.test.ts`
  - `handlers/` — 子命令处理器
  - `types/` — 类型定义
  - `utils/` — 工具函数
  - `cli.ts` — CLI 入口
  - `index.ts` — 库出口
  - `main.ts` — 路由主流程

> 用途：供协作者/AI 按图定位，免遍历目录树。结构变更后重跑初始化刷新。
> （模块根的本段展开该模块**内部**结构；深层大目录 ≥8 项或继续分叉则嵌套列出，叶子小目录不展。）

<!-- repo-map:end -->
