# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.6.1-alpha.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.6.0...@done-coding/cli-generator@0.6.1-alpha.0) (2026-11-20)

### Features

- harness 三闸试用反馈修正，generator 支持 ruff 并按真实路径判越界，create 不信过期 origin/HEAD、模板链接不越出项目 ([#63](https://github.com/done-coding/done-coding-cli/issues/63)) ([3144216](https://github.com/done-coding/done-coding-cli/commit/314421649bb9d87186725285145311b9e9be3c01))

# [0.6.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.5.0...@done-coding/cli-generator@0.6.0) (2026-11-17)

### Features

- harness 归属 / 引用 / 缺口表三闸与能力目录，create / generator 列模板，utils 拼音去原生依赖 ([#62](https://github.com/done-coding/done-coding-cli/issues/62)) ([46dd1c0](https://github.com/done-coding/done-coding-cli/commit/46dd1c0dcf75000e9953b4608a29e122bca17003))

# [0.5.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.4.0...@done-coding/cli-generator@0.5.0) (2026-11-11)

### Features

- generator 消费侧修复 + create 默认远端分支与 template.lock 出生记录 ([8344fba](https://github.com/done-coding/done-coding-cli/commit/8344fba8e89097e6217bbd98dc8b33cb7ed03a2a))

# [0.4.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.3.1...@done-coding/cli-generator@0.4.0) (2026-11-07)

### Features

- 组织站文档内容导出、验收问题修复与 tree 生成前校验 ([#58](https://github.com/done-coding/done-coding-cli/issues/58)) ([0236a0d](https://github.com/done-coding/done-coding-cli/commit/0236a0dfc6049d47d46501104ce65886741b6bc0))

## [0.3.1](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.3.0...@done-coding/cli-generator@0.3.1) (2026-11-04)

**Note:** Version bump only for package @done-coding/cli-generator

# [0.3.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.2.1...@done-coding/cli-generator@0.3.0) (2026-10-23)

- feat!: 治理工具 cli-harness 首发、统一代码生成合入、skill 多宿主安装，退役 ai / mrm (#44) ([03742b7](https://github.com/done-coding/done-coding-cli/commit/03742b73006033658b2f795de5d77b20c597f7c4)), closes [#44](https://github.com/done-coding/done-coding-cli/issues/44)

### BREAKING CHANGES

- 移除 DC ai / DC mrm 子命令及 @done-coding/cli-ai、@done-coding/cli-mrm 两包
  （对话改用 dex，模型切换改用 cc-switch）。

Co-authored-by: Soaren <cm.soar@qq.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

## [0.2.1](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.2.0...@done-coding/cli-generator@0.2.1) (2026-08-01)

**Note:** Version bump only for package @done-coding/cli-generator

# [0.2.0](https://github.com/done-coding/done-coding-cli/compare/@done-coding/cli-generator@0.1.0...@done-coding/cli-generator@0.2.0) (2026-06-23)

### Features

- **cli:** 主命令挂载 generator 子命令 + 补 README ([985954d](https://github.com/done-coding/done-coding-cli/commit/985954d5ca4e857400bdab5764eeb0c9ae10e03c))

# 0.1.0 (2026-06-22)

### Bug Fixes

- **generator:** addFragment 顶层 source 自身为空目录保真产出（R3④） ([8461f09](https://github.com/done-coding/done-coding-cli/commit/8461f09cd0b374639b43005b404417f1104586f4))

### Features

- **generator:** assemble 配置收敛到 .done-coding/generator/assemble ([6da9eee](https://github.com/done-coding/done-coding-cli/commit/6da9eeee44c65701c54a422bb9834c1d554a3814))
- **generator:** assemble 默认原样拷（render opt-in）+ 保真守卫 ([0978fa9](https://github.com/done-coding/done-coding-cli/commit/0978fa993e9621b50b50729f2b4f464ee866699f))
- **generator:** 通用具名批次生成器（gen/inject/assemble/modify）+ 安全收尾硬化 ([db759ca](https://github.com/done-coding/done-coding-cli/commit/db759ca958fc01f139c52a839531906a38d9dc74))
