# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.15.1](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.15.0...create-done-coding@0.15.1) (2026-06-23)

**Note:** Version bump only for package create-done-coding

# [0.15.0](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.14.0...create-done-coding@0.15.0) (2026-06-22)

### Features

- **cli-template:** collectEnvData 的 initial 支持引用前序已答变量 ([d26a8c4](https://github.com/done-coding/done-coding-cli/commit/d26a8c488e9ebfd087eee3683f1aa48b48779ce0))

# [0.14.0](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.13.0...create-done-coding@0.14.0) (2026-06-12)

### Bug Fixes

- **cli:** guard process.cwd() against uv_cwd crash ([9b03bd2](https://github.com/done-coding/done-coding-cli/commit/9b03bd28a80da99fa7dc28473f1a15a37833b20f))
- **create:** robust local template worktree cleanup with safe removal ([b6ac67d](https://github.com/done-coding/done-coding-cli/commit/b6ac67d3d9d3b20cace8b89181b94d9ee7d87dc8))
- **create:** 模板拷贝黑名单收敛为仅 .git，不再误删同名源码目录 ([fde1879](https://github.com/done-coding/done-coding-cli/commit/fde18790291dc0ac79667c18a42b90c86ce7a83a))

### Features

- **create/mcp:** 为 create-mcp 引入资源/提示词三原语并结构化隔离模板来源 ([38c8b80](https://github.com/done-coding/done-coding-cli/commit/38c8b8088491375c88e7534e754e8ad11a9f6157))
- **create/mcp:** 隔离 MCP 模板来源与全局/远程配置 ([4fd5b0e](https://github.com/done-coding/done-coding-cli/commit/4fd5b0e155bdf200a7359040f88738eaa6e87688))
- **create:** configurable local template list source ([0404e77](https://github.com/done-coding/done-coding-cli/commit/0404e7727d4d2755bbbc23fefb5b9e7e2af01c68))
- **create:** 支持 CLI 非交互供答与无 TTY 快速失败 ([e289cfd](https://github.com/done-coding/done-coding-cli/commit/e289cfdfd987b3360bcc7126d6eae78ca5c5c4dc))

# [0.13.0](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.12.2...create-done-coding@0.13.0) (2026-06-10)

### Bug Fixes

- **create:** guard recursive project directory removal ([cca73f8](https://github.com/done-coding/done-coding-cli/commit/cca73f81219cc88247e25053b7a3e61cf823d4f5))

### Features

- **create:** add mcp-ready project preparation ([08b2a23](https://github.com/done-coding/done-coding-cli/commit/08b2a232447b840a4cbf9065bfb9dc9974d29c6f))

## [0.12.2](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.12.1...create-done-coding@0.12.2) (2026-05-04)

**Note:** Version bump only for package create-done-coding

## [0.12.1](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.12.0...create-done-coding@0.12.1) (2026-04-30)

**Note:** Version bump only for package create-done-coding

# [0.12.0](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.11.26...create-done-coding@0.12.0) (2026-04-26)

### Features

- **ai:** 增加ai对话子命令 ([1f4cc71](https://github.com/done-coding/done-coding-cli/commit/1f4cc71b3ef9e12b68deaebe6cfc52dfe7816942))

## [0.11.26](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.11.25...create-done-coding@0.11.26) (2026-04-14)

### Bug Fixes

- **create:** 移除不需要的mcp文件 ([54a229d](https://github.com/done-coding/done-coding-cli/commit/54a229db264e16543fd8ea12056124364cdf7c1d))

## [0.11.25](https://github.com/done-coding/done-coding-cli/compare/create-done-coding@0.11.24...create-done-coding@0.11.25) (2026-04-12)

**Note:** Version bump only for package create-done-coding
