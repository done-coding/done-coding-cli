# @done-coding/cli-extract

从 JSON 或文本提取字段，再用模板生成文件。支持 JSON 字段读取、正则转换和固定值。

<!-- docs-site-link -->

完整文档：[使用文档](https://done-coding.github.io/cli/docs/packages/extract)。

<!-- /docs-site-link -->

## 安装与开始使用

```bash
npm install -g @done-coding/cli-extract
dc-extract init
# 检查并编辑 .done-coding/extract.json5 的输入和输出路径后运行
dc-extract
dc-extract --help
```

安装主包后对应命令是 `done-coding extract`。提取操作直接运行命令，不需要加 `generate`。

## 配置

默认配置 `.done-coding/extract.json5` 使用 `extractInput` 指定源文件与字段规则，`extractOutput.list` 指定模板和输出路径。例如：

```json5
{
  extractInput: {
    "./package.json": {
      name: { type: "json-inject", inject: { type: "read" } },
    },
  },
  extractOutput: {
    list: [
      {
        mode: "overwrite",
        inputData: "${name}",
        output: "./generated/name.txt",
      },
    ],
  },
}
```

默认初始化示例会向 `src/extractInfo.json` 输出包信息；使用前请改成自己的目标路径。

## 选项

| 选项                  | 说明                                           |
| --------------------- | ---------------------------------------------- |
| `--configPath` / `-C` | 指定配置文件，相对 rootDir 解析                |
| `--rootDir` / `-R`    | 指定运行目录，默认当前目录                     |
| `--mode` / `-m`       | `result` 生成结果（默认），`template` 生成模板 |

```bash
dc-extract --configPath ./config/extract.json5 --rootDir ./project
```

报文件不存在时，先核对 rootDir 下的配置文件和输入文件。输出模式及模板用法见 [template 文档](../template/README.md)。

MIT 许可证。
