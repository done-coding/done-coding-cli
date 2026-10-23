# 业务快照

> 最后更新：2026-10-23
> 关联任务：补齐 generator 挂载主命令与 bin 改名、create 实例注册表、shell 补全、cc-switch、Dex；接入 `docs/governance/` 治理视图；cli-harness 首发、create 模板清单指针、skill 改由插件分发

## 1. 业务领域与背景

### 产品定位

done-coding-cli 是一个面向 **Node.js 前端/全栈开发者**的 CLI 工具集，通过单一二进制 `DC`（及等效别名 `dc-cli`、`done-coding`）覆盖**创建→开发→工程配置→发布→AI 辅助**全流程。

需求池 / 批次 / 领域划分见 `docs/governance/`（治理视图，领域清单以 `MODULES.md` 为准）。

### 核心价值

| 痛点 | 替换方式 |
|---|---|
| 项目初始化：手动 git clone + 改 package.json + 改配置 | `DC create` / `npm create done-coding`，一次交互完成 |
| 忘了本机哪些项目基于模板创建 | `DC create instances ls/prune`：create 成功即留痕到本机中央注册表 |
| 工程配置：手动装 ESLint/Prettier/Husky/commitlint 并写配置文件 | `DC config add -m eslint prettier commitlint ls-lint` 一键拉取安装 |
| 组件创建：复制粘贴 + 改名称 + 改引用 | `DC component add <name>`（底层 = cli-generator 的 component 预设） |
| 任意「具名批次」生成（不止组件）：每种产物各写一套脚手架脚本 | `DC generator add <type> <name>`：一套 content-free 引擎，批次差异全在 `.done-coding/<type>/config.json5` 声明 |
| 锚点插入的代码块后续要原位改值：手动找到块、改、保证不破坏 | `DC generator modify <type> <name>`：按 marker 精确定位 inject 块，原位替换 |
| 把多个模板碎片「拼装/裁剪」成一份成品工程并防其漂移 | `DC generator assemble build/diff/check`：配方→物化产物 + 逐字节漂移闸 |
| 在已有项目里按团队范式生成一个模块（如后台列表页）并接上路由 / 菜单 | `DC generator tree build/check`：选模块模板、按其 schema 填参数 → 物化页面 + 经 marker 锚点注入现有文件；AI 侧走 MCP `list_module_templates → list_params → tree_build` 与 `module-generate` skill |
| 分支保护：靠口头约定防止倒灌合并 | `DC git hooks` 在 git hook 层自动拦截 reverse-merge |
| 发布：手动改版本 + npm publish + git push + git tag | `DC publish -t patch -d latest` 一条命令 |
| AI/MCP 辅助 | AI 对话走 `DC dex`；MCP server（`dc-mcp`）把 create / generator 暴露为 Tools/Resources/Prompts 供 AI agent 调用 |
| Claude Code 在多个模型服务商 / 模型间切换要手改环境变量 | `DC cc-switch`：按 profile 注入 env 后启动 `claude`，其余参数原样透传 |
| 想要一个自带 done-coding 能力的编码智能体 | `DC dex`：基于 pi-coding-agent 的交互式编码智能体，一次性导入 cc-switch 的模型配置，内置 generator 工具 |
| 让 Claude Code / Codex 会用 done-coding 命令 | 插件 `done-coding`（市场目录仓 done-coding-agent-plugins，内容 = npm `@done-coding/cli-skills`，随包带 Claude / Codex 插件清单）；不装插件时用 `dc-cli-skills install` 备用 |
| 多仓 harness-workspace 治理：清单要手工同步、闸依赖本机 Python 脚本、跨仓提 issue 易漏步骤 | `DC harness lists / check / issue`：清单生成、治理闸、跨仓提单一条命令完成 |
| 记不住子命令与选项 | `done-coding completion [zsh\|bash]` 输出补全脚本，source 一次后全命令 tab 补全 |

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
| 批次（batch）/ 批次类型（type） | cli-generator 的核心概念：一类可复用的「具名产物」（component / page / api…）。批次类型 = `.done-coding/<type>/` 目录，内含 `index.json` + `config.json5` + `template/`。generator 对所有批次共用一套 content-free 引擎，差异全在 config 声明 |
| content-free（无业务概念） | cli-generator 机制层只认 strategy / files / instanceDir，不认识 component / entry / index 等业务名词。业务语义（series 算法 / 扫子目录 / 命名派生）全下沉到各批次 `config.json5`，引擎零业务逻辑 |
| 落地策略（strategy） | FileEntry 的落地方式：`create`（新建文件）/ `append`（追加）/ `replace`（整体替换）/ `inject`（锚点插入 + marker 健壮回退）。strategy → 引擎 OutputMode 由 strategyRegistry 表驱动映射 |
| marker 块 | inject 策略在目标文件插入的成对标记块，形如 `<注释> === dc-generator:start:<markerKey> === <注释>` … `:end:`。add/modify/remove 按 markerKey 精确定位，免疫块内手改；markerNs 由各包自身 bin 派生（generator → `dc-generator`、template → `dc-template`）以隔离跨工具命名空间 |
| 批次发现（discover） | generator 解析批次类型时逐级向上查找 `.done-coding/<type>/`（项目 → 父链 → 全局 `~/.done-coding/<type>/`），近层遮蔽远层（shadowed），并标注非法批次（invalid + errors） |
| 配方（recipe） | assemble 的输入：`.done-coding/generator/assemble/recipes/*.json5`，声明 base（empty 拼装 / dir 裁剪）+ 有序 ops（addFragment / textPatch / jsonMerge / deleteFile / deleteField）+ output 落地目录 |
| 碎片（fragment） | assemble 的原料：`.done-coding/generator/assemble/fragments/` 下的模板片段，被 recipe 的 op 引用 |
| 模块模板（module template） | tree 的输入：`.done-coding/templates/<base>/<template>/`（`schema.json` + 碎片），就近向上 + 全局解析，目录即列表。admin-core 四模板（list / form / tabs / list-detail）由 template-hub `module-templates/` 提供 |
| 漂移闸（drift gate） | `DC generator assemble diff/check`：把配方 clean-regenerate 到临时目录，与已提交产物逐字节 diff，任意漂移 → exit 1（CI 防手改产物） |
| profile（cc-switch） | `${provider}-${id}` 形式的启动配置：一个模型服务商 + 一个模型 + 合并后的 env。源 = `~/.done-coding/cc-switch/settings.json`，经 `--meta-generate` 编译为 `profile.json` 供启动读取 |
| meta 选项（cc-switch） | `--meta-*` 前缀的 cc-switch 自身选项（选 profile / 改源 / 列表 / 静默），其余参数一律透传给 `claude` |
| 实例注册表（create） | `~/.done-coding/create/instances.json`，create 成功后 upsert 一条（路径 / 模板 / 版本 / url / 分支 / 时间），`instances ls` 标出已不存在的路径，`prune` 只删条目不删项目 |
| manifest（生成清单） | `.done-coding/generator/assemble/manifests/<recipeId>.json`，记录上次生成的文件清单（入版控），作为安全删除孤儿文件的依据与漂移闸基准 |

## 2. 用户画像

| 角色 | 目标 | 典型调用 |
|---|---|---|
| **新手开发者** | 一行创建项目，不想手动配 lint/format | `npm create done-coding` |
| **日常开发者** | 统一入口执行各项操作 | 全局装 `done-coding`，用 `DC <cmd>` |
| **Tech Lead** | 强制团队工程规范 + 分支合并规则 | `DC config add -g`（提交到 git）、`DC git hooks` 配合 husky |
| **AI Agent** | 通过 MCP server / hijack 无阻塞调用 CLI 能力 | `dc-mcp` 暴露 create / generator 为 Tools/Resources/Prompts；其余子命令走 hijack 模式 |
| **Claude Code 重度用户** | 在多个模型服务商 / 模型间快速切换 | `DC cc-switch --meta-pick`、`--meta-profile=<name>` |
| **智能体使用者** | 用自带 done-coding 工具的编码智能体干活 | `DC dex` / `dex` |
| **批次作者 / 工具搭建者** | 把团队反复手写的产物固化为可复用批次 / 组装配方 | `DC generator init <type>` 生成骨架，写 `config.json5`；assemble 写 recipe/fragment |
| **贡献者** | 修改源码或新增子包 | `pnpm dev`、Conventional Commits、PR |

## 3. 调用层架构

### 用户可达的命令入口

| 入口 | 示例 | 适用场景 |
|---|---|---|
| 主全局 CLI | `npm i -g done-coding` → `DC <subcommand>` | 日常使用 |
| 子包独立 bin | `dc-component add Button`、`dc-git clone github user`、`dc-generator add <type> <name>`、`dc-cc-switch`（兼容名 `cc-router`）、`dex` | 只装单个子包时 |
| npm create 约定 | `npm create done-coding`、`pnpm create done-coding` | 零安装创建项目 |
| MCP server bin | `dc-mcp`（stdio MCP server，注册 create + generator 的 Tools/Resources/Prompts） | AI agent / MCP 客户端调用 |
| AI 编码工具插件 | Claude `/plugin marketplace add done-coding/done-coding-agent-plugins` + `/plugin install done-coding@done-coding`；Codex `codex plugin marketplace add …` + `codex plugin add done-coding@done-coding` | skill 以 `done-coding:<名>` 出现，宿主管理版本与更新 |
| Agent Skill 安装器（备用） | `dc-cli-skills install [-g] [-t claude\|codex\|agents] [-l] [-a \| -s <name>] [-f]` | 把内置 SKILL.md 复制或软链进宿主 skills 目录；[MUST NOT] 与插件同时装 |
| shell 补全 | `echo 'source <(done-coding completion zsh)' >> ~/.zshrc`（bash 同理；脚本默认只注册 `DC`，别名需补 compdef，见 `packages/cli/README.md`） | 全命令 / 已声明选项 tab 补全，候选运行时自省，新增命令自动进补全 |

> 当前只有 `dc-mcp` / `dc-cli-skills` 是**独立 bin**，未并入主 `DC` 子命令树；其余子包均已挂载。

### 子命令路由表

> **路由规则：** 当用户在 `DC <subcommand>` 之后未继续指定二级命令时（例如只输入 `DC create`），yargs 会自动路由到该子包设定的默认命令。下表中标注"默认"的即为未指明时的兜底路由目标。

| 用户输入 | 映射子包 | 可用二级命令 |
|---|---|---|
| `DC create` | `create-done-coding` | `create`（未指明时默认执行）、`instances ls\|prune`、`template-config [path]`（`--unset`） |
| `DC component` | `@done-coding/cli-component`（= cli-generator 的 component 预设薄包装） | `add`、`modify`、`remove`、`list` |
| `DC config` | `@done-coding/cli-config` | `check`、`add` |
| `DC extract` | `@done-coding/cli-extract` | `init`、`generate`（未指明时默认执行） |
| `DC inject` | `@done-coding/cli-inject` | `init`、`generate`（未指明时默认执行） |
| `DC publish` | `@done-coding/cli-publish` | `init`、`exec`（未指明时默认执行）、`alias` |
| `DC template` | `@done-coding/cli-template` | `init`、`compile`（未指明时默认执行）、`batch` |
| `DC git` | `@done-coding/cli-git` | `init`、`clone`、`hooks`、`check` |
| `DC generator` | `@done-coding/cli-generator` | `add <type> <name>`、`modify <type> <name>`、`remove <type> <name>`、`list [type]`、`init <type> [--global]`、`assemble plan\|build\|diff\|check`、`tree build\|check` |
| `DC cc-switch` | `@done-coding/cli-cc-switch` | 无二级命令：`--meta-*` 自身选项，其余参数透传 `claude` |
| `DC dex` | `@done-coding/cli-dex` | 无二级命令：直接进入 Dex 交互对话 |
| `DC harness` | `@done-coding/cli-harness` | `lists [--check]`、`check`、`issue <仓名或仓根>`、`scope list\|check\|register` |
| `DC`（无子命令） | `done-coding` 自身 | 输出 --help |

### 独立 bin（未并入 `DC` 子命令树）

| 命令 | 包名 | 可用子命令 |
|---|---|---|
| `dc-mcp` | `@done-coding/cli-mcp` | stdio MCP server（无子命令）：注册 create + generator 的 Tools/Resources/Prompts |
| `dc-cli-skills` | `@done-coding/cli-skills` | `install`（`-g` 全局 / `-t` 目标宿主 / `-l` 软链 / `-a` 全部 / `-s <name>` / `-f` 覆盖） |

## 4. 功能清单

各子包详情见对应 docs 目录。以下为根级概览。

| 子命令 | 包名 | 核心能力 | 状态 | 详情 |
|---|---|---|---|---|
| `DC create` | `create-done-coding` | 从 Git 模板创建项目，交互式问答，git clone + Lodash 模板编译 + git 细节优化；无 TTY（CI / AI / 管道）走非交互：`--env` / `--env-file` 单发供答、`--list-questions` 机读问题清单、缺必填快速失败并列出缺项；成功后留痕到本机实例注册表（`instances ls/prune`），完成提示按模板 `usageSteps`；`template-config` 登记本机默认模板清单（`~/.done-coding/create/index.json`），登记后无需每次传 `--templateConfig` | `活跃` | `packages/create/docs/BUSINESS.md`（待创建） |
| `DC component` | `@done-coding/cli-component` | 组件增删改查（add/modify/remove/list），命名自动转换。**底层已切换为 cli-generator 的 component 预设薄包装**，本包零业务 JS（业务全在 `.done-coding/component/config.json5`） | `活跃` | `packages/component/docs/BUSINESS.md`（待创建） |
| `DC generator` | `@done-coding/cli-generator` | 通用具名批次生成器（content-free 机制层）：add/modify/remove/list/init + assemble 模板组装 + tree 模块生成；inject 锚点插入 + marker 健壮回退；批次发现（项目→父链→全局） | `活跃` | `packages/generator/docs/BUSINESS.md`（待创建） |
| `dc-mcp` | `@done-coding/cli-mcp` | done-coding MCP server：把 create / generator 暴露为 Tools/Resources/Prompts 供 AI agent 非交互调用（rootDir 必填、本地不联网、隔离重构后由 zod schema 强制边界） | `活跃` | `packages/mcp/docs/BUSINESS.md`（待创建） |
| `dc-cli-skills` | `@done-coding/cli-skills` | 各 CLI 命令对应 Agent Skill 的聚合包，同时是插件 `done-coding` 的内容（随包带 `.claude-plugin` / `.codex-plugin` 清单，版本随包）；install 为不装插件时的备用安装器（skill 内命令走已装 bin 或 `npx`，对各 CLI 零运行时依赖） | `活跃` | `packages/cli-skills/docs/BUSINESS_SNAPSHOT.md` |
| `DC config` | `@done-coding/cli-config` | 工程配置检测与安装（eslint/prettier/commitlint/ls-lint/merge-lint） | `活跃` | `packages/config/docs/BUSINESS.md`（待创建） |
| `DC extract` | `@done-coding/cli-extract` | 从源码提取信息生成文件（正则/json-inject/fixed 三种提取方式） | `活跃` | `packages/extract/docs/BUSINESS.md`（待创建） |
| `DC inject` | `@done-coding/cli-inject` | JSON 数据注入目标文件（reg/fixed/read 三种注入方式） | `活跃` | `packages/inject/docs/BUSINESS.md`（待创建） |
| `DC template` | `@done-coding/cli-template` | Lodash 模板编译引擎，支持 4 种输出模式 + 回滚 + Markdown 处理，被 create/component/extract 内部调用 | `活跃` | `packages/template/docs/BUSINESS.md`（待创建） |
| `DC git` | `@done-coding/cli-git` | 跨平台 Git 操作（init/clone/hooks/check），含 reverse-merge 检测 | `活跃` | `packages/git/docs/BUSINESS.md`（待创建） |
| `DC publish` | `@done-coding/cli-publish` | 语义化版本管理 + npm/web 发布 + 别名发布 | `活跃` | `packages/publish/docs/BUSINESS.md`（待创建） |
| `DC cc-switch` | `@done-coding/cli-cc-switch` | Claude Code 模型路由：settings.json 单源（服务商内嵌模型）→ 编译 profile.json；启动时按 profile 注入 env 并 spawn `claude`，参数原样透传；`--meta-*` 管理 profile / apiKey / 模型 / 列表 | `活跃` | `packages/cc-switch/README.md` |
| `DC harness` | `@done-coding/cli-harness` | harness-workspace 治理工具：`lists` 从条目 frontmatter 重生成清单（治理清单唯一实现，格式与 harness-workspace skill 对齐）、`check` 元闸 / 并行闸 / 收口形态 / 清单零 diff、`issue` 向兄弟仓收件箱提单并只提交两文件（目标可写仓名，按注册表寻址）、`scope` 仓库注册表 list / check / register；0.1.0（2026-10-23 首发） | `活跃` | `docs/governance/modules/harness/SNAPSHOT.md` |
| `DC dex` | `@done-coding/cli-dex` | Dex 编码智能体：基于 `@earendil-works/pi-coding-agent`（锁版本、不改源码），首次启动一次性导入 cc-switch 配置，注入 generator 工具（list_batches / list_questions / add） | `活跃` | `packages/dex/README.md` |
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

### 流程 4：通用批次生成（DC generator）

```
DC generator list                 ← 发现所有可达批次（项目 → 父链 → 全局），标 shadowed/invalid
DC generator add page UserProfile ← 生成一个 page 批次实例
  → 批次发现：解析 .done-coding/page/{index.json,config.json5,template/}
  → 命名合法校验 → 内建 canonical 派生（name/nameKebab/nameCamel…）+ helper（_.camelCase…）
  → 采集答案（交互 / --env / --envFile）+ 批次声明式派生（globalEnvData）
  → 逐 FileEntry 按 strategy 落地：create/append/replace/inject（content-free 引擎）
     · inject：锚点插入成对 marker 块（=== dc-generator:start:<key> ===）

DC generator modify page UserProfile ← 原位改 inject 块的值
  → 过滤 INSERT 子集 → marker 配对预检（缺块默认原子中止；--skip-missing 块级跳过）
  → 命中块原位替换（免疫块内手改）

DC generator remove page UserProfile ← 反配方移除
  → dry-run 事务预检（append 命中 / inject marker 配对 / replace 不可回退）全过才删（不留半回滚）
```

### 流程 5：模板组装与漂移闸（DC generator assemble）

```
DC generator assemble plan        ← 解析配方 → 有序 op 计划 + 模拟落地预检（dry-run，不写盘）
DC generator assemble build       ← 组装：base（empty/dir）+ 有序 ops → VFS → 原子 flush 到 output
  → ops：addFragment / textPatch / jsonMerge / deleteFile / deleteField
  → manifest 驱动孤儿删除（仅删上次生成、本次不再产出者）
  → 可选 syncCreateTemplate：把产物 upsert 进 create 的 templateList

DC generator assemble diff/check  ← clean-regenerate 到临时目录 → 与基准逐字节 diff（含 mode/symlink/孤儿）
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

### 流程 7：切换模型启动 Claude Code（DC cc-switch）

```
首次：编辑 ~/.done-coding/cc-switch/settings.json（服务商 + 模型 + apiKey）→ DC cc-switch --meta-generate
DC cc-switch [claude 参数...]
  → 选 profile：--meta-profile=<name> > 交互 pick（--meta-pick / disabledDefault）> defaultProfile > 无默认也交互 pick（非 TTY 报错）
  → 启动前输出 profile 名（--meta-silent 压制，AI/MCP 调用建议带上）
  → 注入 profile env → spawn claude，非 --meta-* 参数原样透传
```

### 流程 8：Dex 智能体对话（DC dex）

```
DC dex
  → 软链 ~/.pi → ~/.done-coding/dex（幂等）
  → 剥离 ANTHROPIC_* env（防 cc-switch 残留污染默认模型）
  → 未配置时检测并经授权导入 cc-switch settings.json（只转 anthropic 协议，剥 [1m] 标记）
  → 进入 coding-agent 交互 REPL（内置斜杠命令 / 会话树 / compact + done-coding generator 工具）
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

- Node.js >= 18.0.0（`@done-coding/cli-dex` 要求 >= 22.19.0）
- pnpm（`preinstall` 脚本强制 `npx only-allow pnpm`）
- 跨平台：Windows / macOS / Linux

### 许可证

MIT

## 7. 已知业务债务

| 债务 | 影响 | 优先级 |
|---|---|---|
| `dc-mcp` / `dc-cli-skills` 未并入主 `DC` 子命令树 | 用户需记独立 bin 名 | 低 |
| 部分子包 README 未列出 `DC <subcommand>` 能用的具体选项，用户需靠 `--help` 反推 | 独立使用子包的用户可能因文档不全而放弃 | 中 |
| create-done-coding 的远程模板列表依赖 Gitee 外部仓库 | Gitee 不可用时 `DC create` 无法获取模板列表 | 低 |
| CHANGELOG.md 已删除但部分 README 仍含链接 | README 404 链接 | 低 |
