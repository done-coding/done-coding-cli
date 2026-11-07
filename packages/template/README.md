# @done-coding/cli-template

替换模板变量并写入文件，支持单文件编译、批量处理与部分模式的回滚。

## 安装与快速开始

```bash
npm install -g @done-coding/cli-template
dc-template --input ./template.txt --envData '{"name":"example"}' --output ./generated.txt
dc-template --help
```

安装主包后可用 `done-coding template`。单文件编译直接运行命令，不需要加 `compile`。模板使用 `${name}` 这样的变量占位符。

## 单文件选项

| 选项                 | 说明                                         |
| -------------------- | -------------------------------------------- |
| `--input` / `-i`     | 模板文件路径                                 |
| `--inputData` / `-I` | 内联模板内容，优先级低于 input               |
| `--env` / `-e`       | 模板数据 JSON 文件路径                       |
| `--envData` / `-E`   | 模板数据 JSON 字符串，优先级低于 env         |
| `--output` / `-o`    | 输出文件路径                                 |
| `--mode` / `-m`      | overwrite（默认）/ append / replace / return |

`return` 主要用于编程调用，不写文件。覆盖模式会替换目标文件，请先检查输出路径。

## 批量编译

```bash
dc-template init
# 编辑 .done-coding/template.json 中的 list
dc-template batch
```

```json
{
  "list": [
    {
      "input": "./template.txt",
      "envData": "{\"name\":\"example\"}",
      "output": "./generated.txt",
      "mode": "overwrite"
    }
  ]
}
```

批量命令支持 `--configPath`（`-C`）与 `--rootDir`（`-R`）。也可用单文件入口的 `--batch` 进入批量处理。不带任何单文件参数（`-e`/`-E`/`-i`/`-I`）直接运行 `dc-template` 时，若配置文件存在也按它批量编译；配置文件不存在则报错并说明两种用法。非交互运行时，`collectEnvDataForm` 中没有 `initial` 的项会被列为缺失。

`dc-template batch --rollback` 用于可回滚的追加块；`--rollbackDelAskAsYes` 自动确认删除，`--rollbackDelNullFile` 删除回滚后的空文件。它们不是任意覆盖操作的撤销功能。需要按配置管理具名实例或插入块时，使用 [generator](../generator/README.md)。

MIT 许可证。
