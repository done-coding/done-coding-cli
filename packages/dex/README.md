# @done-coding/cli-dex

```
done-coding智能体
```

## 使用

```bash
npm install @done-coding/cli-dex
```

## cc-switch 配置导入

首次授权导入同时支持 settings v1 / v2，校验和归一化复用 cc-switch。v1 和 v2 单 key 服务商保持服务商别名；v2 多账号展开成 `provider-alias-account-alias`，每个账号独立凭据。模型名去尾部 `[1m]` 并去重，仍仅导入 anthropic 协议；默认策略保持首个有 key 的服务商首模型。拼名冲突报错，不覆盖账号。已有 Dex 配置不自动重导入。
