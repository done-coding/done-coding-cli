# showcase 现状

- `apps/showcase` 为私有 workspace app，无 bin、无运行时依赖，不在 lerna `packages/*` 发布范围中。
- 本地导出入口 `node apps/showcase/export.mjs`，固定输出到本仓 `test-results/showcase/content/`；允许工作树文档，source 只记录 HEAD，不能据此认定来源已提交。
- 显式写入命令 `pnpm --filter @done-coding/showcase publish:content <站点仓根>`（或 `node apps/showcase/publish.mjs <站点仓根>`），无默认路径或环境变量回退；相对路径按本产品仓根解析，不提交、不推送、不上线。
- 发布要求本仓干净，站点为 Git 仓根、AGENTS 含内容契约、content 已存在且无未提交改动（含未跟踪/被忽略文件）；写入仅限 `apps/cli-site/content/`。拒绝穿越及软链；收集后重查来源 HEAD、两端状态与目标路径。
- 产物遵循 current.json、版本目录 docs/nav.json；nav 的 link 相对 docs/（不带 docs/ 前缀），source 为 `done-coding-cli@<HEAD>`，省略可选 demo。
- 导出和发布共用 README 白名单收集、扫描和原子安装；扫描拒绝源码文件、source map/引用及常见本机绝对路径。明确占位示例保留，规则扫描不替代人工脱敏。
- 同版本整体替换，保留其他版本，current 最后原子替换；失败还原旧版并清理临时目录。需串行运行且两仓无并发写入者，版本目录与 current 不是一个原子事务。
- 根 README 与全部包 README 是使用者文档；harness 的本机路径示例改为绝对路径占位说明，避免输出机器路径。
- README 文档站引导段：根与各包 README 在首个二级标题前有 `<!-- docs-site-link -->` … `<!-- /docs-site-link -->` 包住的一行链接（根指 `https://done-coding.github.io/cli/`，包指 `/cli/docs/packages/<包目录名>`）；导出按标记整段剔除（代码围栏内不处理），标记不成对即失败，站点页不自指。新增包 README 照此加段。
- 验证现状：showcase 测试 55/55、lint 通过，本地导出 17 篇且与加段前逐字节一致；真实跨仓写入、组织站构建与线上发布不在本仓验证范围。
