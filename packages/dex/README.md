# @done-coding/cli-dex

终端编码智能体，可交互处理编码任务，内置 done-coding 生成工具扩展。需要 Node.js >= 22.19.0。

## 使用

```bash
npm install -g @done-coding/cli-dex
dc-dex
# 只查看上游帮助
dc-dex --help
```

安装主包后可用 `done-coding dex` 进入交互会话；需要向上游传参数时使用独立入口 `dc-dex`（兼容 `dex`）。临时调用需明确 bin：`npx -p @done-coding/cli-dex@latest dc-dex --help`。

配置目录是 `~/.done-coding/dex/`，启动会维护 `~/.pi` 到该目录的软链。开始任务前请配置可用的模型账号；模型请求由你的服务商计费。

## cc-switch 配置导入

首次授权导入同时支持 settings v1 / v2，校验和归一化复用 cc-switch。v1 和 v2 单 key 服务商保持服务商别名；v2 多账号展开成 `provider-alias-account-alias`，每个账号独立凭据。模型名去尾部 `[1m]` 并去重，仍仅导入 anthropic 协议；默认策略保持首个有 key 的服务商首模型。拼名冲突报错，不覆盖账号。已有 Dex 配置不自动重导入。

MIT 许可证。
