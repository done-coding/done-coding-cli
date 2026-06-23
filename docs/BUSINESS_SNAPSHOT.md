# 业务快照

> 最后更新：2026-06-22
> 关联任务：cli-generator 程序全程（gen 泛化 P1 + inject/marker P2 + MCP 接线 P3 + assemble 组装 P4a + modify 子命令 + 安全收尾硬化）；MCP 资源/提示词与隔离重构

## 1. 业务领域与背景

### 产品定位

done-coding-cli 是一个面向 **Node.js 前端/全栈开发者**的 CLI 工具集，通过单一二进制 `DC`（及等效别名 `dc-cli`、`done-coding`）覆盖**创建→开发→工程配置→发布→AI 辅助**全流程。

### 核心价值

| 痛点 | 替换方式 |
|---|---|
| 项目初始化：手动 git clone + 改 package.json + 改配置 | `DC create` / `npm create done-coding`，一次交互完成 |
| 工程配置：手动装 ESLint/Prettier/Husky/commitlint 并写配置文件 | `DC config add -m eslint prettier commitlint ls-lint` 一键拉取安装 |
| 组件创建：复制粘贴 + 改名称 + 改引用 | `DC component add <name>`（底层 = cli-generator 的 component 预设） |
| 任意「具名批次」生成（不止组件）：每种产物各写一套脚手架脚本 | `dc-gen add <type> <name>`：一套 content-free 引擎，批次差异全在 `.done-coding/<type>/config.json5` 声明 |
| 锚点插入的代码块后续要原位改值：手动找到块、改、保证不破坏 | `dc-gen modify <type> <name>`：按 marker 精确定位 inject 块，原位替换 |
| 把多个模板碎片「拼装/裁剪」成一份成品工程并防其漂移 | `dc-gen assemble build/diff/check`：配方→物化产物 + 逐字节漂移闸 |
| 分支保护：靠口头约定防止倒灌合并 | `DC git hooks` 在 git hook 层自动拦截 reverse-merge |
| 发布：手动改版本 + npm publish + git push + git tag | `DC publish -t patch -d latest` 一条命令 |
| AI/MCP 辅助 | `DC` 无子命令 → 进入 AI 对话；MCP server（`dc-mcp`）把 create / dc-gen 暴露为 Tools/Resources/Prompts 供 AI agent 调用 |
| 把 CLI 能力以 Agent Skill 形式装进 `.claude/skills/` | `dc-cli-skills install`（聚合 + 安装器，skill 内命令走 `npx <cli>@latest`） |

### 关键术语

| 术语 | 含义 |
|---|---|
| `DC` | 主二进制命令，全局安装后的入口。同义别名：`dc-cli`、`done-coding`。macOS/Linux 上不能用小写 `dc`（与系统 dc 命令冲突），Windows 可以 |
| `npm create` 约定 | `npm create <foo>` = 执行 `create-<foo>` 包的 bin；`npm create done-coding` 等价于直接执行 `create-done-coding` 的主命令 |
| 子包 | `packages/` 下每个目录是一个独立 npm 包，可被单独安装使用，也可经主 `DC` 命令统一调用 |
| `DC <subcommand>` | 主命令下按 yargs 注册的子命令路由，如 `DC git` 映射到 `@done-coding/cli-git` |
| `injectInfo.json` | 每个子包在 `src/` 下的元数据 JSON（含 name/version/description/bin/cliConfig），构建时由 `@done-coding/cli-inject` 写入，运行时被 `import` 使用 |
| MCP / hijack 模式 | 父进程通过 `DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON` 环境变量驱动子 CLI 进程：跳过 `prompts` 交互、结果写到日志、子进程完成后退出——使 AI agent 可无阻塞调用任何子命令 |
| xPrompts | `@done-coding/cli-utils` 对 `prompts` 库的封装，内置 hijack 感知（检测到 hijack 模式时自动跳过交互） |
| reverse-merge | 将分支等级高的分支（如 `main`）合并到等级低的分支（如 `feature`），属于 Git Flow 违规。`DC git check reverse-merge` 通过 reflog/提交记录检测并拦截 |
| 批次（batch）/ 批次类型（type） | cli-generator 的核心概念：一类可复用的「具名产物」（component / page / api…）。批次类型 = `.done-coding/<type>/` 目录，内含 `index.json` + `config.json5` + `template/`。`dc-gen` 对所有批次共用一套 content-free 引擎，差异全在 config 声明 |
| content-free（无业务概念） | cli-generator 机制层只认 strategy / files / instanceDir，不认识 component / entry / index 等业务名词。业务语义（series 算法 / 扫子目录 / 命名派生）全下沉到各批次 `config.json5`，引擎零业务逻辑 |
| 落地策略（strategy） | FileEntry 的落地方式：`create`（新建文件）/ `append`（追加）/ `replace`（整体替换）/ `inject`（锚点插入 + marker 健壮回退）。strategy → 引擎 OutputMode 由 strategyRegistry 表驱动映射 |
| marker 块 | inject 策略在目标文件插入的成对标记块，形如 `<注释> === dc-gen:start:<markerKey> === <注释>` … `:end:`。add/modify/remove 按 markerKey 精确定位，免疫块内手改；markerNs（`dc-gen`）参数化以隔离跨工具命名空间 |
| 批次发现（discover） | `dc-gen` 解析批次类型时逐级向上查找 `.done-coding/<type>/`（项目 → 父链 → 全局 `~/.done-coding/<type>/`），近层遮蔽远层（shadowed），并标注非法批次（invalid + errors） |
| 配方（recipe） | assemble 的输入：`.done-coding/generator/assemble/recipes/*.json5`，声明 base（empty 拼装 / dir 裁剪）+ 有序 ops（addFragment / textPatch / jsonMerge / deleteFile / deleteField）+ output 落地目录 |
| 碎片（fragment） | assemble 的原料：`.done-coding/generator/assemble/fragments/` 下的模板片段，被 recipe 的 op 引用 |
| 漂移闸（drift gate） | `dc-gen assemble diff/check`：把配方 clean-regenerate 到临时目录，与已提交产物逐字节 diff，任意漂移 → exit 1（CI 防手改产物） |
| manifest（生成清单） | `.done-coding/generator/assemble/manifests/<recipeId>.json`，记录上次生成的文件清单（入版控），作为安全删除孤儿文件的依据与漂移闸基准 |

## 2. 用户画像

| 角色 | 目标 | 典型调用 |
|---|---|---|
| **新手开发者** | 一行创建项目，不想手动配 lint/format | `npm create done-coding` |
| **日常开发者** | 统一入口执行各项操作 | 全局装 `done-coding`，用 `DC <cmd>` |
| **Tech Lead** | 强制团队工程规范 + 分支合并规则 | `DC config add -g`（提交到 git）、`DC git hooks` 配合 husky |
| **AI Agent** | 通过 MCP server / hijack 无阻塞调用 CLI 能力 | `dc-mcp` 暴露 create / dc-gen 为 Tools/Resources/Prompts；其余子命令走 hijack 模式 |
| **批次作者 / 工具搭建者** | 把团队反复手写的产物固化为可复用批次 / 组装配方 | `dc-gen init <type>` 生成骨架，写 `config.json5`；assemble 写 recipe/fragment |
| **贡献者** | 修改源码或新增子包 | `pnpm dev`、Conventional Commits、PR |

## 3. 调用层架构

### 用户可达的命令入口

| 入口 | 示例 | 适用场景 |
|---|---|---|
| 主全局 CLI | `npm i -g done-coding` → `DC <subcommand>` | 日常使用 |
| 子包独立 bin | `dc-component add Button`、`dc-git clone github user`、`dc-gen add <type> <name>` | 只装单个子包时 |
| npm create 约定 | `npm create done-coding`、`pnpm create done-coding` | 零安装创建项目 |
| MCP server bin | `dc-mcp`（stdio MCP server，注册 create + dc-gen 的 Tools/Resources/Prompts） | AI agent / MCP 客户端调用 |
| Agent Skill 安装器 | `dc-cli-skills install [-g] [-a] [-s <name>] [-f]` | 把内置 SKILL.md 拷进 `.claude/skills/` |

> **`dc-gen` 注**：当前 `dc-gen` / `dc-mcp` / `dc-cli-skills` 为**独立 bin**，尚未并入主 `DC` 子命令树（`DC` 注册的是 `component`，其底层已切换为 cli-generator 的 component 预设薄包装）。

### 子命令路由表

> **路由规则：** 当用户在 `DC <subcommand>` 之后未继续指定二级命令时（例如只输入 `DC create`），yargs 会自动路由到该子包设定的默认命令。下表中标注"默认"的即为未指明时的兜底路由目标。

| 用户输入 | 映射子包 | 可用二级命令 |
|---|---|---|
| `DC create` | `create-done-coding` | `create`（未指明时默认执行） |
| `DC component` | `@done-coding/cli-component`（= cli-generator 的 component 预设薄包装） | `add`、`modify`、`remove`、`list` |
| `DC config` | `@done-coding/cli-config` | `check`、`add` |
| `DC extract` | `@done-coding/cli-extract` | `init`、`generate`（未指明时默认执行） |
| `DC inject` | `@done-coding/cli-inject` | `init`、`generate`（未指明时默认执行） |
| `DC publish` | `@done-coding/cli-publish` | `init`、`exec`（未指明时默认执行）、`alias` |
| `DC template` | `@done-coding/cli-template` | `init`、`compile`（未指明时默认执行）、`batch` |
| `DC git` | `@done-coding/cli-git` | `init`、`clone`、`hooks`、`check` |
| `DC ai` | `@done-coding/cli-ai` | `chat`（默认） |
| `DC mrm` | `@done-coding/cli-mrm` | `ls`、`use`、`switch`、`model add/use/remove`、`provider add/use/remove` |
| `DC`（无子命令） | `done-coding` 自身 | 交互式提问 → AI 对话或 --help |

### 独立 bin（未并入 `DC` 子命令树）

| 命令 | 包名 | 可用子命令 |
|---|---|---|
| `dc-gen` | `@done-coding/cli-generator` | `add <type> <name>`、`modify <type> <name>`、`remove <type> <name>`、`list [type]`、`init <type> [--global]`、`assemble plan\|build\|diff\|check` |
| `dc-mcp` | `@done-coding/cli-mcp` | stdio MCP server（无子命令）：注册 create + dc-gen 的 Tools/Resources/Prompts |
| `dc-cli-skills` | `@done-coding/cli-skills` | `install`（`-g` 全局 / `-a` 全部 / `-s <name>` / `-f` 覆盖） |

## 4. 功能清单

各子包详情见对应 docs 目录。以下为根级概览。

| 子命令 | 包名 | 核心能力 | 状态 | 详情 |
|---|---|---|---|---|
| `DC create` | `create-done-coding` | 从 Git 模板创建项目，交互式问答，git clone + Lodash 模板编译 + git 细节优化 | `活跃` | `packages/create/docs/BUSINESS.md`（待创建） |
| `DC component` | `@done-coding/cli-component` | 组件增删改查（add/modify/remove/list），命名自动转换。**底层已切换为 cli-generator 的 component 预设薄包装**，本包零业务 JS（业务全在 `.done-coding/component/config.json5`） | `活跃` | `packages/component/docs/BUSINESS.md`（待创建） |
| `dc-gen <type>` | `@done-coding/cli-generator` | 通用具名批次生成器（content-free 机制层）：add/modify/remove/list/init + assemble 模板组装；inject 锚点插入 + marker 健壮回退；批次发现（项目→父链→全局） | `活跃` | `packages/generator/docs/BUSINESS.md`（待创建） |
| `dc-mcp` | `@done-coding/cli-mcp` | done-coding MCP server：把 create / dc-gen 暴露为 Tools/Resources/Prompts 供 AI agent 非交互调用（rootDir 必填、本地不联网、隔离重构后由 zod schema 强制边界） | `活跃` | `packages/mcp/docs/BUSINESS.md`（待创建） |
| `dc-cli-skills` | `@done-coding/cli-skills` | 各 CLI 命令对应 Agent Skill 的聚合包 + 安装器，install 把内置 SKILL.md 拷进 `.claude/skills/`（skill 内命令走 `npx <cli>@latest`，对各 CLI 零运行时依赖） | `活跃` | `packages/cli-skills/CLAUDE.md` |
| `DC config` | `@done-coding/cli-config` | 工程配置检测与安装（eslint/prettier/commitlint/ls-lint/merge-lint） | `活跃` | `packages/config/docs/BUSINESS.md`（待创建） |
| `DC extract` | `@done-coding/cli-extract` | 从源码提取信息生成文件（正则/json-inject/fixed 三种提取方式） | `活跃` | `packages/extract/docs/BUSINESS.md`（待创建） |
| `DC inject` | `@done-coding/cli-inject` | JSON 数据注入目标文件（reg/fixed/read 三种注入方式） | `活跃` | `packages/inject/docs/BUSINESS.md`（待创建） |
| `DC template` | `@done-coding/cli-template` | Lodash 模板编译引擎，支持 4 种输出模式 + 回滚 + Markdown 处理，被 create/component/extract 内部调用 | `活跃` | `packages/template/docs/BUSINESS.md`（待创建） |
| `DC git` | `@done-coding/cli-git` | 跨平台 Git 操作（init/clone/hooks/check），含 reverse-merge 检测 | `活跃` | `packages/git/docs/BUSINESS.md`（待创建） |
| `DC publish` | `@done-coding/cli-publish` | 语义化版本管理 + npm/web 发布 + 别名发布 | `活跃` | `packages/publish/docs/BUSINESS.md`（待创建） |
| `DC ai` | `@done-coding/cli-ai` | AI 交互式对话，模型切换委托 mrm 管理；支持 `/子包名` 查看其他 CLI 帮助 | `活跃` | `packages/ai/docs/BUSINESS.md`（待创建） |
| `DC mrm` | `@done-coding/cli-mrm` | 模型源管理器，管理多 client（claude-code / done-coding-ai）的服务商和模型 | `活跃` | `packages/mrm/docs/BUSINESS.md`（待创建） |
| — | `@done-coding/cli-utils` | 共享工具库（yargs 封装、xPrompts、配置管理、Git 工具、AES 加密等） | `活跃` | 无独立 CLI |

## 5. 核心业务流程

### 流程 1：开发者首次创建项目

```
npm create done-coding        ← 零安装，npm 自动映射到 create-done-coding
  → 交互式输入项目名
  → 从远程模板列表选择模板
  → git clone --depth=1（浅克隆）
  → 模板有 .done-coding config？→ batchCompileHandler 编译 Lodash 模板
  → git 细节优化：分支重命名 / HTTP→SSH URL / 保存或重建 git history
  → git init && git commit -m "feat: init project"
  → 输出：cd my-project && pnpm install && pnpm run dev
```

### 流程 2：日常开发完整链路

```
DC component add UserCard     ← 生成组件
  → 名称处理（camelCase/kebab-case/PascalCase）
  → 模板生成文件 + 注入环境数据

DC config check -m eslint prettier commitlint ls-lint merge-lint
  → 检测各模块配置状态
  → merge-lint 调用 DC git check reverse-merge

...编码...

DC publish -t patch -d latest
  → 读取 publish config → 升级版本号 → npm publish → git push
```

### 流程 3：MCP/Hijack（AI Agent 驱动）

```
AI Agent 调用 CLI
  → 父进程设 env: DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON
  → 子进程 processIsHijacked() = true
  → xPrompts 检测到 hijack，跳过交互，用预设值/CLI 参数填充
  → console 输出 → 日志文件（非 stdout）
  → 子进程结束
```

### 流程 4：通用批次生成（dc-gen）

```
dc-gen list                       ← 发现所有可达批次（项目 → 父链 → 全局），标 shadowed/invalid
dc-gen add page UserProfile       ← 生成一个 page 批次实例
  → 批次发现：解析 .done-coding/page/{index.json,config.json5,template/}
  → 命名合法校验 → 内建 canonical 派生（name/nameKebab/nameCamel…）+ helper（_.camelCase…）
  → 采集答案（交互 / --env / --envFile）+ 批次声明式派生（globalEnvData）
  → 逐 FileEntry 按 strategy 落地：create/append/replace/inject（content-free 引擎）
     · inject：锚点插入成对 marker 块（=== dc-gen:start:<key> ===）

dc-gen modify page UserProfile    ← 原位改 inject 块的值
  → 过滤 INSERT 子集 → marker 配对预检（缺块默认原子中止；--skip-missing 块级跳过）
  → 命中块原位替换（免疫块内手改）

dc-gen remove page UserProfile    ← 反配方移除
  → dry-run 事务预检（append 命中 / inject marker 配对 / replace 不可回退）全过才删（不留半回滚）
```

### 流程 5：模板组装与漂移闸（dc-gen assemble）

```
dc-gen assemble plan              ← 解析配方 → 有序 op 计划 + 模拟落地预检（dry-run，不写盘）
dc-gen assemble build             ← 组装：base（empty/dir）+ 有序 ops → VFS → 原子 flush 到 output
  → ops：addFragment / textPatch / jsonMerge / deleteFile / deleteField
  → manifest 驱动孤儿删除（仅删上次生成、本次不再产出者）
  → 可选 syncCreateTemplate：把产物 upsert 进 create 的 templateList

dc-gen assemble diff / check      ← clean-regenerate 到临时目录 → 与基准逐字节 diff（含 mode/symlink/孤儿）
  → against = worktree / head / index；任意漂移 → exit 1（CI 防手改产物）
```

### 流程 6：AI Agent 经 MCP 生成（dc-mcp）

```
AI 客户端连 dc-mcp（stdio MCP server）
  → done-coding-generate Prompt 引导：确认 rootDir（必填，勿用 server cwd）→ list_batches → list_questions → add
  → Tools：gen_list_batches / gen_list_questions / gen_add / gen_remove / gen_init
  → create：prepare/complete Tools + 模板列表 Resource（参数化 URI，取资源时传本地 configPath，不联网）
  → 单发 + 探针（无 prepare/complete 两段式草稿机）
```

## 6. 业务规则与约束

### 编码与提交

- [MUST] **Conventional Commits**：`feat`/`fix`/`chore`/`docs`/`refactor`/`test`，commitlint 校验
- [MUST] **ESLint + Prettier**：统一代码风格
- [MUST] **ls-lint**：文件命名规范（kebab-case）
- [MUST] **husky + lint-staged**：提交前自动检查

### 版本管理

- **Independent versioning**：每个子包独立 SemVer 版本号，Lerna 管理
- 发布类型用 `-t` 指定或交互选择，支持 major / minor / patch / premajor / preminor / prepatch / prerelease
- dist-tag：latest / next / alpha / beta / rc

### Git 分支保护

- [MUST NOT] reverse-merge：将高等级分支合并到低等级分支
- 等级：main > develop > feature/hotfix > personal
- 检测方式：husky hooks（pre-merge-commit、prepare-commit-msg、post-merge、pre-push、pre-rebase）+ `DC git check reverse-merge`

### 运行时路径安全（destructive 入口）

- [MUST] destructive 入口（assemble `build` 整目录替换 + 孤儿删除 / gen `remove` 的 rmdir）拒在**可疑根**（家目录本体 / 文件系统根）运行；逃逸须显式 `--allow-dangerous`
- [MUST] 删除 / 整体写盘前 `isInside(受控根, 目标)` 边界校验；涉 symlink 先 `fs.realpathSync` 双解再比较
- assemble `build` 全量清空 output（含 untracked）须工作树 git clean 或显式 `--allow-untracked-delete`
- 大小写折叠 VFS 冲突（macOS/Windows 大小写不敏感路径塌缩）在 flush 前确定性 fail-loud

### 环境

- Node.js >= 18.0.0
- pnpm（`preinstall` 脚本强制 `npx only-allow pnpm`）
- 跨平台：Windows / macOS / Linux

### 许可证

MIT

## 7. 已知业务债务

| 债务 | 影响 | 优先级 |
|---|---|---|
| cli-generator / cli-mcp / cli-skills 等新批次能力**未发布**（version 0.0.0），`npx`/全局安装尚不可用 | 外部消费者暂时只能源码内使用，能力对外不可见 | 中 |
| `dc-gen` / `dc-mcp` / `dc-cli-skills` 未并入主 `DC` 子命令树（仅 `DC component` 经薄包装接通 generator） | 用户需记独立 bin 名，主入口能力不完整 | 中 |
| 部分子包 README 未列出 `DC <subcommand>` 能用的具体选项，用户需靠 `--help` 反推 | 独立使用子包的用户可能因文档不全而放弃 | 中 |
| create-done-coding 的远程模板列表依赖 Gitee 外部仓库 | Gitee 不可用时 `DC create` 无法获取模板列表 | 低 |
| CHANGELOG.md 已删除但部分 README 仍含链接 | README 404 链接 | 低 |
