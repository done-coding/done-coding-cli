# SNAPSHOT — cc-switch

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/cc-switch/README.md`；业务流程见 `docs/BUSINESS_SNAPSHOT.md`。

## 技术快照

- 包版本为 0.4.1，settings v2 与 meta-ui 已发布；命名空间软链修复尚未发布。设计契约见本目录 `DESIGN.md`。
- `settings.json` 支持 v1 对象 / v2 数组。v2 以 UUID 保持身份，alias 拼 profile 名；一个 provider 可用单 key 或多个账号。读取严格校验 UUID、alias、同层唯一、全局 profile 拼名和默认引用，导出 parseSettings / normalizeSettings / assignMissingUuids。
- `--meta-migrate` 显式升级：不合并 provider，保存原字节 600 备份、原子写入 v2 和带当前包版本的 `$schema`；v1 只读生成字节不变。两版本 settings 修改先构建验证，再原子写回。
- `--meta-provider` 按 alias，`--meta-account` 或交互选账号更新 key；新增模型补 UUID。generate 对比旧快照输出移除/新增名称，有移除时提醒同步外部脚本引用。发布文件包含 draft-07 `settings.schema.json`（UUID readOnly、apiKey secret）。
- 运行时仍只读 `profile.json` 编译快照；profile 缺失 / 默认悬空报错，不隐式生成。选择顺序和 env 合并顺序保持。env-guard 读取 Claude Code 的 `~/.claude/settings.json`，与本包源配置无关。
- `--meta-ui` 动态加载精确依赖 `@done-coding/config-ui@0.1.0`（MIT）；使用随包 Schema 的表单视图，隐藏 UUID / 默认引用 / envExtraParams 并保留原值。arrayOrigins 绑定行身份，新增行补 UUID，提交经过既有 v2 校验与编译器。
- UI 的文件 I/O 使用 fs/promises；settings 与 profile 分别以 600 临时文件原子替换，共享同步 CLI 的纯路径判定：允许命名空间软链，root 真实路径须位于命名空间真实路径内；拒绝目标文件软链、非普通文件、目录逃逸和可疑根。重建复用编译器和改名提示；第二份写入失败明确提示 settings 已保存及重建命令。
- 本次修复 vitest 207 例、包 build/eslint 和 CLI 冒烟通过（eslint 21 warning、0 error）；未重跑 dex 与仓根 eslint。新增临时 HOME 回归覆盖命名空间软链下迁移/UI 启动/保存/profile 存在与缺失重建、root 软链逃逸拒绝；真实 CLI HTTP 冒烟在命名空间软链下覆盖删除中间行 / 新增 / 改名、默认引用、600 权限及退出码，并与 --meta-generate 生成文件逐字节比对；测试使用临时 HOME、openBrowser:false。未做浏览器视觉验收。

## 业务与 UX 快照

- 消费方：直接使用者；dex 复用解析与归一化，一次授权导入每个账号。
- 列表显示服务商 / 模型与账号 alias，绝不输出 key。多账号非 TTY 缺选择器立即报错，不猜账号。
- `--meta-ui` 总会打印 URL，非 TTY 不打开浏览器，v1 必须先显式迁移；与其他 meta 动作互斥，help/version 优先。字段校验可页面重试；语义失败或 5 分钟超时退出非零，成功保存并重建后退出 0。
- UI 中单密钥对应空账号列表、多账号对应空服务商密钥；提交只转换这两种表单空值，非空双凭据仍拒绝。默认引用和自由键 env 如需修改仍编辑 settings.json；深层标签/按钮体验由上游 issue 7qrli4 跟进。
- UUID 引用按原文本匹配；自动生成值为小写，手工引用应保持原值（大小写规范化为审查暂缓项）。
