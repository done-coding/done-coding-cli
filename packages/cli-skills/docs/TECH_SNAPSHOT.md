# 技术快照 — @done-coding/cli-skills

> 文档定位：快照型 · 覆盖更新、只写当前状态。业务面见同目录 `BUSINESS_SNAPSHOT.md`。

## 1. 形态

- 本仓 monorepo 成员包（`packages/cli-skills`），ESM only，Vite 构建到 `es/`，类型到 `types/`；Node ≥ 18。
- bin：`dc-cli-skills`（`es/cli.mjs`）；库导出 `handler` / `createAsSubcommand` / 类型（未挂进主命令 `DC`）。
- 构建注入：开发依赖 `@done-coding/cli-inject` 使用 `workspace:0.6.6`，在 `vite.config.ts` 直接调用 `generateFile` + `doneCodingCliConfig` 生成 `src/injectInfo.json`（moduleName = `cli-skills`），build / dev 不依赖 install 时可能尚未生成的 `dc-inject` bin；prebuild 只清理 types。注入仅在 Vite build 阶段执行（含 dev watch），Vitest 加载配置时不写 src。
- 运行时依赖仅 `@done-coding/cli-utils`（命令构建、`safeCwd`、`safeRemoveDirSync`、交互、输出）。
- 发布内容 `package.files` = `es` · `lib` · `types` · `skills` · `.claude-plugin` · `.codex-plugin`：skill 源目录原样随包发布，Vite 不处理它；两份插件清单构建时生成。
- **插件清单**：`build` = `vite build && node scripts/plugin-manifests.mjs`，由 `package.json` 生成 `.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`（插件名 `done-coding`、版本 / 作者 / 许可取自 package.json；Codex 另含 `skills: ./skills/` 与 `interface` 展示信息），生成物 gitignore。版本只有 package.json 一个来源：lerna publish 在改版本后打包、打包时 prepack 重新构建，发出的清单版本与包一致。
- 发版判定：根 `lerna.json` 的 `ignoreChanges` 只忽略 `README.md` 与 `docs/**`，`skills/**/SKILL.md` 改动计入 changed，只改 skill 正文也会触发本包发版。

## 2. 结构

```
skills/<name>/SKILL.md      # 内置 skill 源（frontmatter name / description）
scripts/plugin-manifests.mjs # 构建时生成两份插件清单（buildPluginManifests / writePluginManifests）
src/
├── handlers/install.ts     # install 子命令：选项、选择 skill、逐目标安装、输出
├── utils/skills-source.ts  # getBundledSkillsDir（包内 ../skills）、listSkills（解析 frontmatter）
├── utils/install-skills.ts # resolveTargetSkillsDir / installSkills（复制 | 软链）/ assertLinkableSource
└── types/index.ts          # SkillTargetEnum（claude | codex | agents）、InstallOptions、SkillMeta
```

## 3. 关键实现约定

- **目标目录** = `<家目录 | safeCwd()>/.<target>/skills`；多目标逐个安装，同一 skill 集合。
- **已存在判定用 `lstat`**：悬空软链也算存在，避免 `existsSync` 跟随软链误判。
- **覆盖前先移除**：软链 `unlink`（[MUST NOT] 跟随进包内源目录写入）；实体目录经 `safeRemoveDirSync`（限定在该 skills 根内）。
- **软链**指向 `realpath(包内 skill 目录)`，类型 `junction`（Windows 兼容，POSIX 忽略）；源路径含 `/_npx/` 即拒绝。
- frontmatter 用最小正则解析，不引入 YAML 依赖。
- 四份 skill 的 CLI 入口规则一致：按 `command -v` 先主包、再独立子包、最后 `npx <子包>@latest`；Bash 数组保留入口与参数边界，示例统一用 `done-coding <X>`，module-generate 的 MCP 主路径保持优先。

## 4. 测试

vitest（`__tests__/`）：`listSkills` 枚举与解析、复制安装的 skip / force、目标目录解析、软链建立与软链 ↔ 复制件互换不触碰源目录、悬空软链处理、npx 来源拒绝；`bundled-generator-skill` 校验内置 skill 可被发现且 frontmatter 正确；`plugin-manifests` 校验两份清单字段取自 package.json、Codex 展示信息、`files` 含清单目录。夹具全在临时目录。

## 5. 开发命令（包目录下）

| 用途 | 命令                                     |
| ---- | ---------------------------------------- |
| 测试 | `pnpm test`（或仓库根 `pnpm test` 聚合） |
| 构建 | `pnpm build`                             |
| Lint | `pnpm exec eslint .`（沿用仓库根配置）   |
