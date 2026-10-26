# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
