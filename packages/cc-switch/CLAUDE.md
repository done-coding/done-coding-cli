<!-- repo-setup:v2 -->

# AI 指令 — @done-coding/cli-cc-switch（node-cli）

## 包管理器

`pnpm`

## 环境健康检查

```
node -v && pnpm -v
```

## 项目命令

| 命令 | 脚本                       |
| ---- | -------------------------- |
| 测试 | `pnpm test`                |
| Lint | `pnpm exec eslint --fix .` |
| 构建 | `pnpm build`               |
| 清理 | `rm -rf es lib types`      |

## 项目专属规则（从 6 开始）

6. [MUST] `bin` 入口薄、只做参数解析与子命令分发，业务逻辑下沉到可测函数。
7. [MUST] 用户可见输出与退出码稳定（脚本会依赖），破坏性变更需说明。
8. [MUST] 发布走既有命令（如 `npm publish` / 项目发布脚本），[MUST NOT] 手工拷贝产物。
