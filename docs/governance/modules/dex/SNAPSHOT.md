# SNAPSHOT — dex

> 文档定位：快照型 · 只写当前状态。用户说明见 `packages/dex/README.md`。

## 技术与业务快照

- 包版本字段仍为 0.2.0，依赖 cc-switch `workspace:0.4.0`；本批适配未发布。
- 首次启动：已有模型 / 凭据配置即跳过；发现有效 cc-switch settings 后询问授权，再一次性写入 coding-agent models.json / auth.json 和默认模型。
- 读取复用 cc-switch 的 parseSettings / normalizeSettings，支持 v1 / v2；单 key 保留 provider alias，多账号展开为 provider-account alias，每个账号各自凭据，展开冲突拒绝覆盖。
- 保留 anthropic-only、模型名去尾部 `[1m]` 后去重、首个有 key 的服务商首模型作为默认的旧策略；不消费 cc-switch 默认 UUID 引用或额外 env。
- 14 个测试通过，含 v1 / v2 实际文件导入、单 key / 多账号和冲突；包 build、eslint 通过。所有夹具在临时目录，不访问真实用户配置。

## 交付边界

批 oywqvv；不涉及账号自动切换、UI 或发布。generator 扩展未修改。
