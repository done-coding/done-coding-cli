# 领域模块 — dex

## 职责与落点

`packages/dex` 是 Dex 编码智能体的 CLI 集成层，管理初始化软链和已授权的 cc-switch 配置导入。`src/extensions/generator.ts` 工具扩展切片仍归 generator 领域。

当前状态见 `SNAPSHOT.md`，用户说明见 `packages/dex/README.md`。cc-switch 源格式由 cc-switch 导出的解析与归一化函数负责，dex 只翻译为 coding-agent 的 models/auth/default 配置。
