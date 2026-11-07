# CLI 文档内容导出

私有 workspace app，使用根 README 与 `packages/*/README.md` 作为文档源，只构建 Markdown / JSON 内容产物，不构建网站。

## 使用

在仓库根目录执行：

```bash
pnpm --filter @done-coding/showcase build
```

也可不安装依赖直接执行 `node apps/showcase/export.mjs`。运行位置不影响输入与输出路径，命令不接受输出目录参数。

产物固定落在本仓：

```text
test-results/showcase/content/
  current.json
  <主 CLI 版本>/
    nav.json
    docs/
      index.md
      packages/<包目录名>.md
```

格式依据站点仓 `AGENTS.md` 的「内容产物契约」。`current.json` 包含 version 与 `done-coding-cli@<HEAD>` 来源。导航是 `{ text, link }` 数组，link 相对 `docs/`，例如 `index.md`。版本取 `packages/cli/package.json`，不使用本私有 app 的版本。

这是当前工作树的本地验收产物；来源提交只记录当前 HEAD，未提交的 README 改动不在该提交中。正式交接前先提交，再使用下方显式命令写入站点仓。

## 显式写入组织站内容

在本仓根目录执行（站点根必填且只接受一个位置参数）：

```bash
pnpm --filter @done-coding/showcase publish:content /path/to/site-repo
# 无运行时依赖，也可直接执行
node apps/showcase/publish.mjs /path/to/site-repo
```

相对路径以本产品仓根目录解析，与运行位置无关。没有默认站点路径，也不从环境变量推测。该命令只写内容文件，不执行站点构建、提交、推送或上线；使用前需有写入站点仓的授权。

- 来源必须是干净的 Git 工作区（含暂存、已跟踪和未跟踪改动；Git 忽略的本地验收产物与依赖不计入）。版本取主 CLI，source 固定为 `done-coding-cli@<HEAD>`。
- 站点根必须是 Git 仓根目录，根 `AGENTS.md` 含「内容产物契约」，且 `apps/cli-site/content/` 已存在。content 内任何暂存、未暂存、未跟踪或被忽略的未跟踪文件均阻止写入；content 外的改动允许保留。
- 输入路径含 `..` 或任一路径段为软链即拒绝；content 内现有软链也拒绝。产物先经共用扫描，再在 content 内暂存和原子改名，同版本整体替换，其他版本保留，`current.json` 最后原子替换；失败还原旧版本并清理临时目录。
- 写入前再次扫描，拒绝白名单之外的文件（包括源码和 source map）、source map 引用及常见本机绝对路径。文档的 `~/` 和 `/abs/` 等明确占位示例可保留；扫描是规则检查，不能代替人工脱敏审阅。
- 成功后打印版本、文件数（含 current.json）和目标 content 路径。首次写入后目标会有未提交改动，须由协调方处理后才能再次运行。
- 请串行运行，并确保运行期间两仓没有其他写入者；版本目录和 current 分别原子替换，不是整个 content 的单次事务。

## 文档与路径约束

- 每个包含 package.json 的包目录必须有 README，缺页即失败；不读取源码或构建输出。
- 支持 Markdown 行内链接、引用式链接及代码围栏；本地链接只能指向被导出的 README 或其目录。未纳入导出的本地资源会报错，HTTPS / HTTP / mailto 与页内锚点保留。
- 路径输入和输出逐段拒绝软链，家目录和文件系统根不能作为项目根。删除与整体替换前核对受控根及真实路径。
- 完整校验文档后才写盘；同版本重建清理旧页并保留其他版本；current 更新失败时还原旧版本内容。请串行运行导出。
- 不包含 demo（可选项）、产品源码或 source map；本地导出和发布共用扫描，验收目录被 Git 忽略。

## 本 app 检查

```bash
pnpm --filter @done-coding/showcase test
pnpm --filter @done-coding/showcase lint
pnpm --filter @done-coding/showcase build
```

测试使用 Vitest 1.6.1（MIT，与项目既有框架一致），夹具放系统临时目录且自动清理；无运行时依赖。app 声明 private，且在 lerna 的 `packages/*` 发布范围之外。
