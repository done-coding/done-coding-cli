# @done-coding/cli-harness

done-coding 工作区治理（harness-workspace）工具：治理清单生成、治理闸、跨仓提 issue、仓库注册表。各仓 `docs/governance/` 的清单与闸以本命令为唯一实现，规则语义见 harness-workspace skill。

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-harness.svg)](https://www.npmjs.com/package/@done-coding/cli-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- docs-site-link -->

完整文档：[使用文档](https://done-coding.github.io/cli/docs/packages/harness)。

<!-- /docs-site-link -->

## 安装

```bash
npm install -g @done-coding/cli-harness
# 或免安装
npx @done-coding/cli-harness <command>
# 或作为主 CLI 子命令
DC harness <command>
```

## 命令一览

| 命令                                                                                                 | 说明                                                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `dc-harness lists [-d <dir>] [-c]`                                                                   | 从条目 frontmatter 重生成 `BACKLOG` / `SCHEDULE` / `ARCHIVE-DONE` / `DROPPED` / `ISSUE` |
| `dc-harness instructions [--json]` | AGENTS.md 单文件 / 链路预算与 CLAUDE.md 兼容入口 |
| `dc-harness check [-d <dir>] [--strict]`                                                             | 治理闸：元闸 + 并行闸 + 收口形态 + 清单零 diff，及归属 / 引用 / 缺口表闸；任一不过退出码 1 |
| `dc-harness catalog [--json] [--installed] [--check] [--offline] [--registry <源>]` | 能力目录：done-coding 已发布包 + 注册表里本机仓的包，按仓分系列；`--installed` 查当前项目；`--check` 过期即红 |
| `dc-harness owners [文件…] [--unowned] [--json]`                                                     | 代码归属查询：各领域 / 共享骨架的代码文件数、无主文件清单、指定文件的归属               |
| `dc-harness issue <仓名或仓根> -t <标题> -s <slug> -b <正文文件>`                                    | 向另一仓的 issue 收件箱提单                                                             |
| `dc-harness scope list [--inbox] [--json]`                                                           | 列出仓库注册表里登记的仓                                                                |
| `dc-harness scope check`                                                                             | 校验注册表                                                                              |
| `dc-harness scope register [-n <名>] [-p <定位>] [-a <受理范围>] [--tier <档位>] [--dir <治理目录>]` | 把当前 git 仓登记进注册表                                                               |

所有命令在**项目根**执行（只认当前目录，不向上查找）。

## lists / check

- 治理目录缺省 `docs/governance`；`-d` 或项目配置可改。
- `lists -c` 只比对不写盘，清单与条目不一致即退出码 1。
- `check` 的检查项：
  - **元闸**：`backlog/` 与在途批次里的条目都有 `modules`，且只用领域表里登记的名字。
  - **并行闸**：在途批次（`schedule/` 下）的领域集合两两不相交；同一 `after` 链上的批次（同窗口串行）豁免。`after` 指向不存在的批次、分叉或成环即违规。
  - **收口形态**：在途批次有 `PROGRESS.md`；`archive/` 下批次只留 `PROGRESS.md`；`dropped/` 条目写明 `dropped` 理由或 `merged_into`；`issue/` 条目有 `from`。
  - **清单零 diff**：同 `lists -c`。
- 批次的领域 = 条目 `modules` ∪ 批次 `PROGRESS.md` 的 `modules`。

项目配置（可选）`<项目根>/.done-coding/harness/governance/config.json`：

```json
{
  "governanceDir": "docs/governance",
  "domains": { "file": "docs/governance/SNAPSHOT.md", "section": "领域模块" }
}
```

`domains` 指定领域表从哪个文件（可限定某个二级标题下）读取，缺省为治理目录下 `MODULES.md` 全文。

## 归属闸 / 引用闸 / 缺口表闸

`check` 在元闸等之后还有三项**代码类检查**，数据都取自结构化内容（表格、配置、固定标注词），不读正文描述；路径一律相对仓根，以 `git ls-files` 的跟踪文件为准，须在 git 项目根执行。

### 启用方式：不准恒绿

每项先判数据在不在，再按配置 `gates.<ownership|imports|seams>` 处理：

| 模式 | 有数据 | 缺数据 |
| --- | --- | --- |
| `auto`（缺省） | 执行，违规即失败 | 不失败，输出 `⚠️ <闸>未启用：<缺什么>` |
| `on` | 执行 | 失败 |
| `off` | 不执行，输出 `⚠️ <闸>已关闭` | 同左 |

成功行只列真正执行过的闸，未启用 / 关闭的另行逐条列出，不会和「通过」混在一起。`check --strict` 把三项都按 `on` 处理（验收、CI 用）。存量仓升级后：补齐数据前是「未启用」；数据一旦补上即生效，要防止日后被删又悄悄失效，在配置里写 `on`。

### 归属闸（数据：领域表 `paths` 列 + 共享骨架表）

`MODULES.md` 领域表（首列反引号领域名的表格行）按**表头列名**取列：`paths`（必需）、`status`（可选，缺省按 active）、`public`（引用闸用）。另建一张首列表头为 `共享骨架` 的表，登记不属任何领域的代码（应用壳、服务装配、工程配置等）：

```markdown
| 领域模块 | 一句能力 | status | paths | public |
| --- | --- | --- | --- | --- |
| `agent-run` | 决定下一步提议 | active | `frontend/apps/web/src/domains/agent-run/`、`backend/services/studio/src/app/agent_run/**` | `frontend/apps/web/src/domains/agent-run/public.ts`、`backend/services/studio/src/app/agent_run/__init__.py` |
| `order` | 订单与配额 | not_implemented | `frontend/apps/web/src/domains/order/` | |

| 共享骨架 | paths | public | 说明 |
| --- | --- | --- | --- |
| web 壳 | `frontend/apps/web/**` | `frontend/apps/web/src/{runtime,api}.ts` | 路由、身份会话、请求适配 |
| 工程配置 | `*.cjs`、`scripts/` | | 根配置与脚本 |
```

- 单元格里每个反引号片段是一个路径模式：无通配 = 文件或目录（目录覆盖其下全部）；`**` 跨目录、`*` / `?` 不跨 `/`、`{a,b}` 展开；模式命中某目录即覆盖其下全部文件（所以 `*` 等于全部，根目录文件请写 `*.cjs` 这类）。
- 判定：每份跟踪的**代码文件**（含测试）恰属一个领域；不属领域时恰属一个骨架件。**领域优先**：骨架可按容器整块登记（如整个应用目录），容器里落在领域 paths 的文件归领域。
- 违规：无主；同属多个领域；同属多个骨架件；`status` 不以 `active` / `not_implemented` / `retired` 开头；领域缺 paths；领域名只在别处登记、不在含 paths 的表里；`not_implemented` 领域路径下出现说明与占位（`*.md`、`.gitkeep`、`.keep`）以外的文件；active 领域没有任何代码文件；`public` 没有命中本领域的代码文件。
- 代码文件 = 按扩展名认定（ts / tsx / js / mjs / cjs / vue / svelte / py / go / rs / java / kt / swift / dart / rb / php / sh / sql 等）；文档、JSON / YAML、锁文件、图片不算。生成物、vendor 这类不算业务代码的，写进配置 `ownership.exclude`；扩展名清单可用 `ownership.extensions` 整体替换。
- 数据判定：领域表有 `paths` 列**且**有共享骨架表才算有数据。

### 引用闸（数据：领域表 `public` 列）

扫代码文件的静态引用，跨归属的引用只许落到被引方的公开入口：

- **进入领域**（来自别的领域、壳、壳测试、别的领域的测试）：目标须落在该领域 `public` 内；`public` 为空 = 不许被跨归属引用。同领域内（含本领域测试）不限。
- **领域进入壳**：骨架表有 `public` 列时，目标须落在该行 `public` 内（空格 = 不开放）；骨架表无 `public` 列则不设限，并在输出附注写明。骨架内部互引不限。
- 识别范围：TS / JS / Vue / Svelte 的 `import` / `export … from` / 字面量 `import()` / `require()`，按相对路径与最近 `tsconfig.json` / `jsconfig.json` 的 `paths`、`baseUrl`（含相对 `extends`）解析；Python 的 `import` / `from … import`（含相对导入），绝对导入从引用方目录逐级向上（含各级 `src/`）找首段包。落不到跟踪文件的（第三方包、标准库）跳过。
- 不覆盖：动态拼接的路径、`import.meta.glob`、只在 vite 配置里的别名（未写进 tsconfig）、Python 的 `importlib` / 字符串模块名。
- 过渡：`imports.include` 只查引用方落在这些模式内的引用（例如先只查前端），范围会写进输出附注。

### 缺口表闸（blueprint 0041ⓔ）

- 位置：治理目录 `SNAPSHOT.md` 里标题 `## done-coding 缺口表`（其后可加说明）下的第一张表。
- 列（按表头名）：`缺口` · `接缝件` · `issue` · `状态`，可另加 `#`、`备注` 等列。
- `接缝件`：只写反引号包裹的仓根相对路径（可用 glob，可多个）；没有接缝件写 `无`。位置说明（哪一行、哪个路由）写进「缺口」或「备注」列。
- `状态`：`等待` / `已可替换` / `已替换`。
- 文件标注：接缝件文件里写标注词 `@done-coding-seam`（建议在文件头注释，后跟 issue 标识与一句说明）；只在接缝件里写，引用接缝件的文件不写。
- 违规：缺列；缺口 / issue 为空；状态非法；接缝件路径不是仓根相对或未命中跟踪文件；等待 / 已可替换行的接缝件文件没带标注；带标注的文件不在等待 / 已可替换行。已替换行的路径仍须存在（接缝件保留，只换内部），标注应已去掉。
- 数据判定：有该标题即算有数据；没有标题但代码里已有标注，直接报错。Markdown 文件不扫标注。

### 配置

```json
{
  "gates": { "ownership": "on", "imports": "auto", "seams": "auto" },
  "ownership": { "exclude": ["backend/services/studio/sdk/src/generated/"] },
  "imports": { "include": ["frontend/"] }
}
```

`dc-harness owners` 帮助对齐：不带参数列各归属的代码文件数，`--unowned` 列出全部无主文件（不要求骨架表已建），给出文件则逐个答归属。

## catalog — 能力目录

回答「done-coding 有哪些系列、各系列有哪些包、done-creating 提供哪些包」，数据每次现取，不存清单：

- **npm 已发布包**：官方源（`--registry` 可换；镜像可能滞后）按维护者检索——维护者取自 `@done-coding/cli-harness` 自身的 maintainers，只收 repository 在同一 GitHub 组织下的包；逐包读 latest 清单拿描述、版本、依赖、弃用说明。
- **本机仓**：仓库注册表（`dc-harness scope`）登记的仓，按 `pnpm-workspace.yaml` / `workspaces` 读工作区里非 private 或带 `publishConfig` 的 npm 包，另读 `packages/` 目录下名字合法的 `pyproject.toml`（Python 包）。未上公共源的包（私有源、Python）从这里来；本机版本与 npm 比对。
- **系列** = 包所在仓。概述取注册表定位；仓未登记时取与系列同名的聚合包描述（仓名去掉组织前缀，如 `done-coding-forge` → `@done-coding/forge`）。
- **聚合关系**：一个包的 `dependencies` 含 ≥ 2 个同系列包即「聚合入口」；被聚合入口包含的标「已含在 … 里」；都不是的标「需单独安装」；同系列 `peerDependencies` 标「须搭配」。
- `--installed`：当前项目 `package.json` 声明与 `node_modules` 实装的目录内包；同系列各包同版本发布时（目录里版本一致），实装版本不一致即提示。
- `--check`（退出码 1）：本机仓版本落后 npm、包缺 description、系列缺概述、npm 清单读取失败或未比对。离线不会显示为通过。
- `--offline`：只读注册表里的本机仓。

项目模板与模块模板不在本命令里：分别用 `create-done-coding templates` 与 `dc-generator tree templates`（各自与创建 / 生成时同源）。

## instructions — 指令预算与兼容入口

```bash
dc-harness instructions
dc-harness instructions --json
```

项目根执行，必须是 Git 仓根；无需存在治理目录。枚举 Git 跟踪的 `AGENTS.md` / `CLAUDE.md`，读取工作树当前内容（包含未暂存修改），未跟踪的兼容入口不算已交付。命令只读，不修改文件或索引。

- 默认预算：根 `AGENTS.md` 16384 B，其他层 8192 B，根到各含指令目录的链路合计 32768 B；按 UTF-8 字节计，等于预算通过。链路违规列出各层字节与最大贡献者。
- 每个 `AGENTS.md` 须有同级跟踪的普通 `CLAUDE.md`，首个非空行是 `@AGENTS.md`，其后允许 Claude 专属增量；软链不通过。只有 `CLAUDE.md` 而无同级 `AGENTS.md` 时，单行纯 `@路径` 导入可保留，其他内容报「正文仍在 CLAUDE.md」。
- 逐条 `❌` 或单行 `✅`；通过退出码 0，违规退出码 1。`--json` 输出 `{ budget, files: [{ file, bytes }], errors }`，不混入文本日志，退出码不变。

在现有项目配置内追加可选段（预算支持逐项覆盖）：

```json
{
  "instructions": {
    "budget": { "root": 16384, "nested": 8192, "chain": 32768 },
    "exclude": [".done-coding/generator/assemble/fragments/**", ".claude/skills/**"],
    "gate": false
  }
}
```

`exclude` 使用 Git glob pathspec（相对仓根；`*` 不跨目录、`**` 跨目录，支持 `?` / 字符组），从文件枚举和链路中排除模板、第三方内容。默认不排除任何路径。`gate: true` 才把本检查并入 `check`，默认 false；独立 `instructions` 始终检查。

改动 `AGENTS.md` / `CLAUDE.md` 后及交付收口前运行；建议在仓内 pre-commit 检测到暂存指令文件时运行本命令。检查的是工作树内容，并非索引快照。

## issue：跨仓提单

```bash
dc-harness issue template-hub -t "模板缺少 apps/ 工作区配置" -s monorepo-apps-workspace -b ./body.md
```

- 目标可写仓根路径，或注册表里的仓名（已存在的目录优先按路径解析）。
- 在目标仓 `issue/` 写入 `<id>-<slug>.md`（frontmatter：`id` / `title` / `created` / `from`），重生成其 `ISSUE.md`，并在目标仓**只提交这两个文件**。
- 目标仓 `ISSUE.md` 有未提交改动、或注册表中该仓未开收件箱时拒绝。
- `-f` 指定来源仓名，缺省取当前 git 仓目录名。
- 写入前将标题与正文中的当前用户家目录（`os.homedir()`，其后为 `/` 或字符串结束）替换为 `~`；有替换时输出总处数，正文源文件不改。

## scope：仓库注册表

注册表位于 `~/.done-coding/harness/scope/<由仓路径转义的目录>/repo.json`（环境变量 `DC_HARNESS_SCOPE_DIR` 可改位置），每仓一份：

```json
{
  "name": "dotfiles",
  "path": "<全局配置仓的绝对路径>",
  "positioning": "一句话定位",
  "accepts": "受理哪些反馈",
  "governance": {
    "dir": "docs/governance",
    "tier": "medium",
    "issueInbox": "docs/governance/issue"
  }
}
```

- `register` 登记当前 git 仓；已登记则更新，目录键被别的仓占用时拒绝覆盖。收件箱按治理目录下是否有 `issue/` 推出，没有则为 `null`。
- `check` 校验字段、`path` 存在、目录名与 `path` 一致、收件箱存在、`name` 唯一。
- `list --inbox` 只列开了收件箱的仓，供「给某仓提 issue」时按名字找目标。

## 在 AI 编码工具里使用

插件 `done-coding` 内含 `cli-harness` skill（安装见 [done-coding-agent-plugins](https://github.com/done-coding/done-coding-agent-plugins)）：说「重生成治理清单」「跑治理闸」「给 <仓名> 提 issue」即可，skill 会调用本命令。

## 许可证

MIT
