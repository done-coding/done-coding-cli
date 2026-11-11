# done-coding

项目创建、代码生成、配置和发布工具的统一命令入口。

<!-- docs-site-link -->

完整文档：[使用文档](https://done-coding.github.io/cli/docs/packages/cli)。

<!-- /docs-site-link -->

## 安装

```bash
npm install -g done-coding
done-coding --help
```

也可在项目中 `npm install --save-dev done-coding`，通过 `npx done-coding --help` 调用。`done-coding`、`DC`、`dc-cli` 三个入口等价；macOS / Linux 请使用这些明确的名字，避免和系统 `dc` 命令冲突。

多数命令要求 Node.js >= 18；Dex 要求 >= 22.19.0。

## 主包与独立命令

| 主包入口                | 独立命令                           | 说明                                             |
| ----------------------- | ---------------------------------- | ------------------------------------------------ |
| `done-coding create`    | `dc-create` / `create-done-coding` | [从模板创建项目](../create/README.md)            |
| `done-coding generator` | `dc-generator`                     | [具名实例生成与模板组装](../generator/README.md) |
| `done-coding component` | `dc-component`                     | [组件生成](../component/README.md)               |
| `done-coding config`    | `dc-config`                        | [工程化配置](../config/README.md)                |
| `done-coding extract`   | `dc-extract`                       | [信息提取](../extract/README.md)                 |
| `done-coding inject`    | `dc-inject`                        | [JSON 注入](../inject/README.md)                 |
| `done-coding template`  | `dc-template`                      | [模板处理](../template/README.md)                |
| `done-coding git`       | `dc-git`                           | [Git 操作](../git/README.md)                     |
| `done-coding publish`   | `dc-publish`                       | [项目发布](../publish/README.md)                 |
| `done-coding cc-switch` | `dc-cc-switch` / `cc-router`       | [Claude Code 模型路由](../cc-switch/README.md)   |
| `done-coding dex`       | `dc-dex` / `dex`                   | [终端编码智能体](../dex/README.md)               |
| `done-coding harness`   | `dc-harness`                       | [工作区治理工具](../harness/README.md)           |

安装主包只会注册 `done-coding` / `DC` / `dc-cli`。要直接调用右列命令，需要独立安装对应子包。两者同时安装时，主包命令使用随主包固定的子包版本，独立命令使用独立安装的版本。

[dc-mcp](../mcp/README.md) 和 [dc-cli-skills](../cli-skills/README.md) 需要独立安装，不是主包子命令。`git` 命令可用，但不显示在主帮助的命令列表中。

```bash
done-coding create my-project
done-coding generator list
done-coding component list
done-coding config check
```

`ai` 和 `mrm` 已移除，分别使用 `dex` 和 `cc-switch`。不带子命令运行会显示帮助。

## 临时调用子包

```bash
npx @done-coding/cli-generator@latest --help
# 多 bin 包需明确指定入口
npx -p @done-coding/cli-cc-switch@latest dc-cc-switch --meta-help
npx -p @done-coding/cli-dex@latest dc-dex --help
```

## Shell 补全

将对应命令加入自己的 Shell 配置：

```bash
# zsh
source <(done-coding completion zsh)
compdef _DC_yargs_completions done-coding dc-cli

# bash
source <(done-coding completion bash)
```

zsh 的默认补全注册名是 `DC`，第二行注册另外两个别名。保存配置并重开终端后生效。

## 配置与常见问题

多数项目配置放在项目根 `.done-coding/`，具体格式见对应子包文档；个人模型配置位于 `~/.done-coding/cc-switch/`，Dex 位于 `~/.done-coding/dex/`。

找不到命令时，先检查 npm 全局安装目录是否在 PATH，再确认安装的是主包还是独立子包。具体命令参数可用 `done-coding <命令> --help` 查看；cc-switch 使用 `--meta-help`。

MIT 许可证。
