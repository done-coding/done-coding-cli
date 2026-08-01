# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.20.0](https://github.com/done-coding/done-coding-cli/compare/done-coding@0.19.0...done-coding@0.20.0) (2026-08-01)

### Features

- **cli-utils:** 启用 yargs shell 补全 —— done-coding 全命令 tab 补全 ([#34](https://github.com/done-coding/done-coding-cli/issues/34)) ([bdaef3d](https://github.com/done-coding/done-coding-cli/commit/bdaef3d0af35b300db02a7515e8c548829fbedcb))

# [0.19.0](https://github.com/done-coding/done-coding-cli/compare/done-coding@0.18.1...done-coding@0.19.0) (2026-08-01)

### Features

- **cc-switch:** ccsuite/cli-router 迁移为 @done-coding/cli-cc-switch + meta 自身命令面 + 注册进主 CLI ([#32](https://github.com/done-coding/done-coding-cli/issues/32)) ([3ee1930](https://github.com/done-coding/done-coding-cli/commit/3ee1930c4dd7f7ddd4fc322fed6f774b2ecf6957))

## [0.18.1](https://github.com/done-coding/done-coding-cli/compare/done-coding@0.18.0...done-coding@0.18.1) (2026-06-24)

**Note:** Version bump only for package done-coding

# [0.18.0](https://github.com/done-coding/done-coding-cli/compare/done-coding@0.17.2...done-coding@0.18.0) (2026-06-23)

### Features

- **cli:** 主命令挂载 generator 子命令 + 补 README ([985954d](https://github.com/done-coding/done-coding-cli/commit/985954d5ca4e857400bdab5764eeb0c9ae10e03c))

## [0.17.2](https://github.com/done-coding/done-coding-cli/compare/done-coding@0.17.1...done-coding@0.17.2) (2026-06-22)

**Note:** Version bump only for package done-coding

## [0.17.1](https://github.com/done-coding/done-coding-cli/compare/done-coding@0.17.0...done-coding@0.17.1) (2026-06-12)

**Note:** Version bump only for package done-coding

# 0.17.0 (2026-06-10)

### Bug Fixes

- **create:** 移除不需要的mcp文件 ([54a229d](https://github.com/done-coding/done-coding-cli/commit/54a229db264e16543fd8ea12056124364cdf7c1d))

### Features

- **ai:** 增加ai对话子命令 ([1f4cc71](https://github.com/done-coding/done-coding-cli/commit/1f4cc71b3ef9e12b68deaebe6cfc52dfe7816942))
- **cli&create&inect:** cli支持增加子命令create、inject & 各主子命令增加信息注入 ([321bf5d](https://github.com/done-coding/done-coding-cli/commit/321bf5d4e6bb6c34198a5f6b82b06894e0ed271d))
- **cli:** cli增加git子命令 ([14b1e41](https://github.com/done-coding/done-coding-cli/commit/14b1e416939de3f8bda425fb170214817d77056b))
- **cli:** 创建cli包&create导出assets ([0c05b90](https://github.com/done-coding/done-coding-cli/commit/0c05b905fa3e9d5837b97caad49d2b621463ecb3))
- **cli:** 引入信息提取子包 ([ce03bc0](https://github.com/done-coding/done-coding-cli/commit/ce03bc00514fc2398e9c95fed81d4ab4ef74507d))
- **cli:** 集成template子命令 ([7bdb20e](https://github.com/done-coding/done-coding-cli/commit/7bdb20e21467b3b7009ce177695d997bcced460a))
- **component:** 组件命令行主流程 ([3dfb9a2](https://github.com/done-coding/done-coding-cli/commit/3dfb9a2056a6787084688aa9e0f6c5accf632cee))
- **engin:** 工程化配置操作命令行 ([667b323](https://github.com/done-coding/done-coding-cli/commit/667b323c1e867f97b3cc63950ff318aa52bdd0d3))
- **engin:** 移除engin包 ([e961e2a](https://github.com/done-coding/done-coding-cli/commit/e961e2aadde83c31a3b6ed10d03d9cff86a47e68))
- **init:** 创建init包 ([db19e38](https://github.com/done-coding/done-coding-cli/commit/db19e388a84659df6bbd69fddd56fe5c73af7846))
- **inject:** 增加使用实践及各包使用 ([3a13922](https://github.com/done-coding/done-coding-cli/commit/3a13922ac6a8bfb932ff6025055a985a34fc5264))
- **mcp-utils:** 添加mcp配置和工具注册功能 ([4ba2e67](https://github.com/done-coding/done-coding-cli/commit/4ba2e670e76a0a274d0ebc037973b3d1aff62e4b))
- **publish:** publish命令迁移至monorepo & 主命令集成publish命令 ([36df0ac](https://github.com/done-coding/done-coding-cli/commit/36df0ac94161367f3d46ca0a0951d8049ab058c2))
- **publish:** 添加根命令名称 ([a472312](https://github.com/done-coding/done-coding-cli/commit/a472312b2751b1dbb6d2c5cdff70f9df86e30d92))
- 临时文件换tmpDir ([c57cbcd](https://github.com/done-coding/done-coding-cli/commit/c57cbcde7344818aadc732a5b2ac7147755f02cc))
- **命令行界面:** 更新 postinstall 脚本和工作区设置 ([ca6fe4e](https://github.com/done-coding/done-coding-cli/commit/ca6fe4eff29606d0dd05731e869becfd3e60b714))
- 更新注入方式 & 更新handler类型 ([3d6d4cc](https://github.com/done-coding/done-coding-cli/commit/3d6d4cc01fb62ad500a6a9228353368a460964a0))
- 移除cli-init ([2f5134c](https://github.com/done-coding/done-coding-cli/commit/2f5134c9cdeb65f65e56bdd224c4693b91a7dfde))

### Performance Improvements

- **component:** 收拢配置文件路径、使用utils json5 ([c28a103](https://github.com/done-coding/done-coding-cli/commit/c28a10354f8795cd8264a65ab670652f2ff32e23))
- **inject:** 调整done-coding实践调用 ([5268181](https://github.com/done-coding/done-coding-cli/commit/5268181a04fd1a97388a0aa4b6e931b6fd65c3cc))
- 优先命令创建方式 ([5dc2bad](https://github.com/done-coding/done-coding-cli/commit/5dc2bad4e752afeb7bc6cf2574d2a545b57e8010))
- 移除onPromptFormStateForSigint、收拢chalk、prompts ([06a913d](https://github.com/done-coding/done-coding-cli/commit/06a913d519c69e57d98856320f8fa39cebc4e2f6))

## [0.16.4](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.16.3...@done-coding/cli@0.16.4) (2026-05-06)

**Note:** Version bump only for package @done-coding/cli

## [0.16.3](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.16.2...@done-coding/cli@0.16.3) (2026-05-04)

**Note:** Version bump only for package @done-coding/cli

## [0.16.2](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.16.1...@done-coding/cli@0.16.2) (2026-04-30)

**Note:** Version bump only for package @done-coding/cli

## [0.16.1](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.16.0...@done-coding/cli@0.16.1) (2026-04-26)

**Note:** Version bump only for package @done-coding/cli

# [0.16.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.15.23...@done-coding/cli@0.16.0) (2026-04-26)

### Features

- **ai:** 增加ai对话子命令 ([1f4cc71](https://github.com/done-coding/done-coding-cli/commit/1f4cc71b3ef9e12b68deaebe6cfc52dfe7816942))

## [0.15.23](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.15.22...@done-coding/cli@0.15.23) (2026-04-14)

### Bug Fixes

- **create:** 移除不需要的mcp文件 ([54a229d](https://github.com/done-coding/done-coding-cli/commit/54a229db264e16543fd8ea12056124364cdf7c1d))

## [0.15.22](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli@0.15.21...@done-coding/cli@0.15.22) (2026-04-12)

**Note:** Version bump only for package @done-coding/cli
