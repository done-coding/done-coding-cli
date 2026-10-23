# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.4.0](https://gitee.com/done-coding/done-coding-cli/compare/@done-coding/cli-skills@0.3.0...@done-coding/cli-skills@0.4.0) (2026-10-23)

### Features

- **cli-skills:** 随包发布 Claude / Codex 插件清单；2026-10-23 发版收口与文档补齐 ([#46](https://gitee.com/done-coding/done-coding-cli/issues/46)) ([921b991](https://gitee.com/done-coding/done-coding-cli/commits/921b9917d9f4c4f549c7cfaf3f906b9fbfb5237e))

# [0.3.0](https://gitee.com/done-coding/done-coding-cli/compare/@done-coding/cli-skills@0.2.1...@done-coding/cli-skills@0.3.0) (2026-10-23)

- feat!: 治理工具 cli-harness 首发、统一代码生成合入、skill 多宿主安装，退役 ai / mrm (#44) ([03742b7](https://gitee.com/done-coding/done-coding-cli/commits/03742b73006033658b2f795de5d77b20c597f7c4)), closes [#44](https://gitee.com/done-coding/done-coding-cli/issues/44)

### BREAKING CHANGES

- 移除 DC ai / DC mrm 子命令及 @done-coding/cli-ai、@done-coding/cli-mrm 两包
  （对话改用 dex，模型切换改用 cc-switch）。

Co-authored-by: Soaren <cm.soar@qq.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

## [0.2.1](https://gitee.com/done-coding/done-coding-cli/compare/@done-coding/cli-skills@0.2.0...@done-coding/cli-skills@0.2.1) (2026-08-01)

**Note:** Version bump only for package @done-coding/cli-skills

# [0.2.0](https://gitee.com/done-coding/done-coding-cli/compare/@done-coding/cli-skills@0.1.0...@done-coding/cli-skills@0.2.0) (2026-06-22)

### Features

- **cli-skills:** cli-generator SKILL 接线（P3） ([c8b40dd](https://gitee.com/done-coding/done-coding-cli/commits/c8b40dd96d26e5bf5e780dbde2d8012425256e3c))

# 0.1.0 (2026-06-12)

### Features

- **cli-skills:** 从 npm-node-cli 模板 scaffold @done-coding/cli-skills 包骨架 ([20abf31](https://gitee.com/done-coding/done-coding-cli/commits/20abf316d9e8c93ba3e8adfa8cdb63399bba71cd))
- **cli-skills:** 实现 install 安装器与首个 create-done-coding skill ([b7376a9](https://gitee.com/done-coding/done-coding-cli/commits/b7376a904d0bdf34e1c995a38ae44f8195d66390))
