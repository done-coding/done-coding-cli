# done-coding CLI

done-coding 把项目创建、代码生成、工程配置、信息处理和发布工具放在同一个命令入口。可安装主包，也可只安装需要的子包。

<!-- docs-site-link -->

完整文档：[使用文档](https://done-coding.github.io/cli/)。

<!-- /docs-site-link -->

## 安装与开始使用

```bash
npm install -g done-coding
done-coding --help
done-coding create my-project
```

`done-coding`、`DC`、`dc-cli` 是同一个入口。未安装主包时，也可用 `npm create done-coding my-project` 创建项目。

主包及多数工具要求 Node.js >= 18；Dex 要求 Node.js >= 22.19.0。使用 Dex 时请按较高版本准备环境。

## 选择工具

| 文档                                            | 用途                                          |
| ----------------------------------------------- | --------------------------------------------- |
| [主 CLI](./packages/cli/README.md)              | 安装、命令入口、Shell 补全                    |
| [create](./packages/create/README.md)           | 从模板创建项目，支持非交互供答                |
| [generator](./packages/generator/README.md)     | 按配置生成实例、组装模板、检查产物漂移        |
| [component](./packages/component/README.md)     | 使用 component 配置生成和管理组件             |
| [config](./packages/config/README.md)           | 检查和添加工程化配置                          |
| [extract](./packages/extract/README.md)         | 从文件提取信息并生成输出                      |
| [inject](./packages/inject/README.md)           | 从 JSON 读取、转换和注入字段                  |
| [template](./packages/template/README.md)       | 模板变量替换与批量编译                        |
| [git](./packages/git/README.md)                 | 仓库克隆、Git 钩子回调、合并检测              |
| [publish](./packages/publish/README.md)         | 使用者项目的 npm / web 发布                   |
| [cc-switch](./packages/cc-switch/README.md)     | 管理 Claude Code 的服务商、账号和模型 profile |
| [Dex](./packages/dex/README.md)                 | 终端编码智能体                                |
| [harness](./packages/harness/README.md)         | 治理清单、规则检查与跨仓 issue                |
| [MCP](./packages/mcp/README.md)                 | 在支持 MCP 的客户端使用创建与生成工具         |
| [Agent Skills](./packages/cli-skills/README.md) | 安装 CLI 对应的 Agent Skills                  |
| [utils](./packages/utils/README.md)             | 在程序里复用 CLI 公共能力                     |

主包全局安装只提供自身入口。需要直接使用 `dc-generator` 等独立命令时，请安装对应子包；完整规则见[主 CLI 文档](./packages/cli/README.md)。

## 许可证与反馈

本项目使用 MIT 许可证。问题反馈请到 [GitHub Issues](https://github.com/done-coding/done-coding-cli/issues)。
