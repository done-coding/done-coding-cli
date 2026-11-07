# @done-coding/cli-utils

供程序复用的 CLI 公共工具库，包含命令构建、配置读取、终端交互、输出与路径处理，不提供独立命令。

## 安装

```bash
npm install @done-coding/cli-utils
```

## 使用

```js
import { safeCwd, resolveHandlerContext } from "@done-coding/cli-utils";

const context = resolveHandlerContext({
  mode: "cli",
  cwd: safeCwd(),
  interactive: false,
});
```

`safeCwd()` 在当前工作目录失效时回落到有效的 PWD 或家目录；调用方仍需检查最终路径是否适合本次操作。`resolveHandlerContext` 统一解析执行模式、交互状态、运行目录、日志和危险操作开关。

库也导出配置文件、JSON5、文件操作与模板相关辅助能力。完整导出和参数以安装版本随包的 TypeScript 类型为准。

MIT 许可证。
