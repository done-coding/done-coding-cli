# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.1.1-alpha.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-dex@0.1.0...@done-coding/cli-dex@0.1.1-alpha.0) (2026-10-23)

- feat!: 治理工具 cli-harness 首发、统一代码生成合入、skill 多宿主安装，退役 ai / mrm (#43) ([75eb8ab](https://github.com/done-coding/done-coding-cli/commit/75eb8abb332008d480eabd414e298803d25d1100)), closes [#43](https://github.com/done-coding/done-coding-cli/issues/43)

### BREAKING CHANGES

- 移除 DC ai / DC mrm 子命令及 @done-coding/cli-ai、@done-coding/cli-mrm 两包
  （对话改用 dex，模型切换改用 cc-switch）。

Co-authored-by: Soaren <cm.soar@qq.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

# 0.1.0 (2026-08-15)

### Features

- **dex:** 新增 Dex 智能体（@done-coding/cli-dex，基于 pi-coding-agent 基座） ([#42](https://github.com/done-coding/done-coding-cli/issues/42)) ([e8d4f60](https://github.com/done-coding/done-coding-cli/commit/e8d4f603584eef5680182f33c4d77bb05cb4f1a6))
