# @done-coding/cli-skills

安装 done-coding CLI 对应的 Agent Skills，让支持 Agent Skills 的编码工具发现并调用命令。此包提供说明和安装器，具体 CLI 需另外安装。

## 安装与使用

```bash
npm install -g @done-coding/cli-skills
dc-cli-skills install --help
dc-cli-skills install --all --target codex
# 只安装指定 skill
dc-cli-skills install --skill cli-generator --target claude
```

默认复制到当前项目 `.claude/skills/`；`--target codex` 使用 `.codex/skills/`，`--target agents` 使用 `.agents/skills/`，可传多个目标。未指定 `--all` 或 `--skill` 时会交互选择。

| 选项              | 说明                                                |
| ----------------- | --------------------------------------------------- |
| `--global` / `-g` | 安装到家目录的对应 skills 目录                      |
| `--link` / `-l`   | 使用软链，要求本包已稳定安装；不要指向 npx 临时目录 |
| `--all` / `-a`    | 安装所有内置 skills                                 |
| `--skill` / `-s`  | 指定 skill，可多个                                  |
| `--force` / `-f`  | 覆盖已有同名 skill                                  |

`dc-cli-skills` 是独立命令，没有 `done-coding cli-skills` 子命令。已装主包时，skills 优先调用主包固定的子包版本；否则使用独立子包或 npx。

MIT 许可证。
