# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.5.1-alpha.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.5.0...@done-coding/cli-harness@0.5.1-alpha.0) (2026-11-20)

### Features

- harness 三闸试用反馈修正，generator 支持 ruff 并按真实路径判越界，create 不信过期 origin/HEAD、模板链接不越出项目 ([#63](https://github.com/done-coding/done-coding-cli/issues/63)) ([3144216](https://github.com/done-coding/done-coding-cli/commit/314421649bb9d87186725285145311b9e9be3c01))

# [0.5.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.4.1...@done-coding/cli-harness@0.5.0) (2026-11-17)

### Features

- harness 归属 / 引用 / 缺口表三闸与能力目录，create / generator 列模板，utils 拼音去原生依赖 ([#62](https://github.com/done-coding/done-coding-cli/issues/62)) ([46dd1c0](https://github.com/done-coding/done-coding-cli/commit/46dd1c0dcf75000e9953b4608a29e122bca17003))

## [0.4.1](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.4.0...@done-coding/cli-harness@0.4.1) (2026-11-11)

**Note:** Version bump only for package @done-coding/cli-harness

# [0.4.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.3.1...@done-coding/cli-harness@0.4.0) (2026-11-07)

### Features

- 组织站文档内容导出、验收问题修复与 tree 生成前校验 ([#58](https://github.com/done-coding/done-coding-cli/issues/58)) ([0236a0d](https://github.com/done-coding/done-coding-cli/commit/0236a0dfc6049d47d46501104ce65886741b6bc0))

## [0.3.1](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.3.0...@done-coding/cli-harness@0.3.1) (2026-11-04)

**Note:** Version bump only for package @done-coding/cli-harness

# [0.3.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.2.0...@done-coding/cli-harness@0.3.0) (2026-10-28)

### Features

- **harness:** issue 内容家目录路径替换为 ~；修复 cc-switch meta-ui 拒绝软链家目录 ([#54](https://github.com/done-coding/done-coding-cli/issues/54)) ([8f1e47d](https://github.com/done-coding/done-coding-cli/commit/8f1e47db3c39b2c2b09af708abf6ca8b62e616e7))

# [0.2.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-harness@0.1.0...@done-coding/cli-harness@0.2.0) (2026-10-26)

### Features

- **cli-skills:** 随包发布 Claude / Codex 插件清单；2026-10-23 发版收口与文档补齐 ([#46](https://github.com/done-coding/done-coding-cli/issues/46)) ([921b991](https://github.com/done-coding/done-coding-cli/commit/921b9917d9f4c4f549c7cfaf3f906b9fbfb5237e))
- **harness:** 新增 dc-harness instructions 指令闸 ([#50](https://github.com/done-coding/done-coding-cli/issues/50)) ([97659fc](https://github.com/done-coding/done-coding-cli/commit/97659fc309c83ea8ca383622f7c725061fe4a5de))

# 0.1.0 (2026-10-23)

- feat!: 治理工具 cli-harness 首发、统一代码生成合入、skill 多宿主安装，退役 ai / mrm (#44) ([03742b7](https://github.com/done-coding/done-coding-cli/commit/03742b73006033658b2f795de5d77b20c597f7c4)), closes [#44](https://github.com/done-coding/done-coding-cli/issues/44)

### BREAKING CHANGES

- 移除 DC ai / DC mrm 子命令及 @done-coding/cli-ai、@done-coding/cli-mrm 两包
  （对话改用 dex，模型切换改用 cc-switch）。

Co-authored-by: Soaren <cm.soar@qq.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>
