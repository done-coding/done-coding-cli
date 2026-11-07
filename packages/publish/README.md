# @done-coding/cli-publish

为使用者项目提供 npm / web 发布命令，可指定版本类型、发布标签与 Git 推送行为。

## 安装与配置

```bash
npm install -g @done-coding/cli-publish
dc-publish --help
dc-publish init
```

初始化生成 `.done-coding/publish.json`，请按实际项目填写 npm / web 配置并检查发布目标。安装主包后对应入口是 `done-coding publish`。

## 执行发布

下面的命令会实际发布，执行前请确认账号、目标和配置：

```bash
dc-publish --mode npm --type patch
# 不推送 Git 远端；这仍会执行发布
dc-publish --mode npm --type patch --push=false
```

不需要添加 `exec` 子命令。`--push=false` 只控制 Git 推送，不是试运行。

| 选项                  | 说明                                   |
| --------------------- | -------------------------------------- |
| `--mode` / `-m`       | npm（默认）或 web                      |
| `--type` / `-t`       | 版本递增类型，如 major / minor / patch |
| `--distTag` / `-d`    | 发布标签，可选值以 `--help` 为准       |
| `--push` / `-p`       | 是否推送 Git 远端，默认 true           |
| `--configPath` / `-C` | 配置路径，相对 rootDir 解析            |
| `--rootDir` / `-R`    | 运行项目目录，默认当前目录             |

`dc-publish alias` 使用配置中的别名发布信息。npm 发布需要有效登录和包权限，Git 推送需要远端写权限；失败时按终端提示检查，不要把禁用推送当作发布回滚。

MIT 许可证。
