# @done-coding/cli-inject

读取 JSON 中的字段，按配置转换后写入另一个 JSON 文件，适合生成包信息等静态数据。

## 安装与开始使用

```bash
npm install -g @done-coding/cli-inject
dc-inject init
# 检查并编辑 .done-coding/inject.json 后运行
dc-inject
dc-inject --help
```

安装主包后使用 `done-coding inject`。执行注入直接运行命令，不需要加 `generate`。

## 配置

默认路径为 `.done-coding/inject.json`：

```json
{
  "sourceFilePath": "./package.json",
  "keyConfigMap": {
    "name": { "type": "read" },
    "version": { "type": "read" },
    "label": { "type": "fixed", "value": "示例包" }
  },
  "injectFilePath": "./generated/package-info.json"
}
```

`read` 默认读取同名字段，`sourceKey` 可指定源字段；`fixed` 写入固定值；`reg` 使用 `sourceKey`、`pattern`、可选 `flags` 和 `replaceValue` 转换内容。初始化示例默认写 `src/injectInfo.json`，执行前请确认目标。

```bash
dc-inject --configPath ./config/inject.json --rootDir ./project
```

`--configPath`（`-C`）相对 `--rootDir`（`-R`）解析，rootDir 默认当前目录。报文件不存在时，依次核对配置、源文件及运行目录。

MIT 许可证。
