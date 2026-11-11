# @done-coding/cli-config

检查项目的工程化配置，并按交互选择添加配置模块，例如代码检查与提交规范。

<!-- docs-site-link -->

完整文档：[使用文档](https://done-coding.github.io/cli/docs/packages/config)。

<!-- /docs-site-link -->

## 安装与使用

```bash
npm install -g @done-coding/cli-config
dc-config --help
dc-config check
dc-config add
```

安装主包后可用 `done-coding config check` / `done-coding config add`。

## 常用选项

| 选项                  | 说明                                              |
| --------------------- | ------------------------------------------------- |
| `--rootDir` / `-R`    | 执行项目目录，默认当前目录                        |
| `--configPath` / `-C` | 配置文件相对路径，默认 `.done-coding/config.json` |
| `--moduleList` / `-m` | 限定模块；可选值以 `--help` 为准                  |
| `--commitGit` / `-g`  | 添加完成后是否提交 Git，默认 false，仅 add 使用   |

`add` 会写入项目配置，可能安装依赖或配置 Git hooks，请在目标项目根执行并检查结果。`check` 默认检测的模块不包含 merge-lint；需要它时显式选择。

merge-lint 的反向合并检测由 [git 工具](../git/README.md) 的 `check reverse-merge` 提供。找不到项目或配置时，检查运行目录及 `--configPath`。

MIT 许可证。
