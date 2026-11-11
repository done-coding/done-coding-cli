# @done-coding/cli-git

提供仓库克隆、Git 配置初始化、钩子回调和反向合并检测。

<!-- docs-site-link -->

完整文档：[使用文档](https://done-coding.github.io/cli/docs/packages/git)。

<!-- /docs-site-link -->

## 安装与使用

```bash
npm install -g @done-coding/cli-git
dc-git --help
dc-git init
dc-git clone github your-username
dc-git check reverse-merge
```

安装主包后对应入口是 `done-coding git`。该子命令不列在主包帮助中，但仍可调用。

## 命令

| 命令                                 | 用途                                                         |
| ------------------------------------ | ------------------------------------------------------------ |
| `dc-git init`                        | 初始化 Git 相关配置                                          |
| `dc-git clone <platform> <username>` | 从指定平台克隆用户仓库，可用 `--projectName` / `-p` 选择项目 |
| `dc-git hooks <name> [args...]`      | 执行已配置的 Git 钩子回调                                    |
| `dc-git check <type>`                | 检查 Git 操作，例如 reverse-merge                            |

`check reverse-merge` 也供 [config](../config/README.md) 的 merge-lint 使用。它结合本地记录检测，不是远端分支合并状态的完整审计。

克隆需要网络和相应仓库访问权限；钩子与检测应在目标 Git 项目运行。具体平台、初始化类型和参数以相应命令的 `--help` 为准。

MIT 许可证。
