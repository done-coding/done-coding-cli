# @done-coding/cli-component

使用项目的 component 配置生成和管理组件。它复用 [generator](../generator/README.md) 的实例生成能力，不内置组件业务模板。

## 安装与使用

```bash
npm install -g @done-coding/cli-component
dc-component --help
dc-component list
dc-component add Button --list-questions
dc-component add Button
dc-component modify Button
dc-component remove Button
```

安装主包后，同样的参数可通过 `done-coding component` 使用。

## 配置与非交互调用

先在项目中准备 `.done-coding/component/` 配置。配置按就近向上及全局位置发现；项目未提供配置时，命令不会凭空生成组件模板。

```bash
dc-component add Button --env-file ./answers.json
dc-component modify Button --env '{"title":"按钮"}'
```

供答字段需与配置中的问题名称一致。先使用 `--list-questions` 查询，再填写答案；不要直接套用示例字段。`remove` 需要明确指定组件名。`list --output` 可输出组件名列表，`--path` 指定输出路径。

找不到组件时，确认执行目录、配置位置和实例名称。配置格式与模板组装能力见 [generator 文档](../generator/README.md)。

MIT 许可证。
