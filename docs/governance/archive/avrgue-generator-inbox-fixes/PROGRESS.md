---
id: avrgue
title: generator 拒写输出去调用栈与参数写法统一；配方 format 支持 ruff
modules: [generator]
created: 2026-11-17
source: 总协调 2026-11-17 按用户规矩过 cli 收件箱（blueprint `reviews/2026-11-17-forge-cli-inbox-triage.md`）；溯源 次级车道 › 已发布工具可用 › cli 收件箱
after: 0kmyf7
---

# generator 收件箱两条

## 任务

| 项                                                                                  | 状态   | 交付 sha   |
| ----------------------------------------------------------------------------------- | ------ | ---------- |
| o167op（缺陷）：tree build 预期拒写不打调用栈、不重复原因；提示与帮助的参数写法统一 | 已完成 | 63a9975    |
| cjunp5（新功能）：配方 `format` 支持 `"ruff"`，找不到 ruff 即报错不静默跳过         | 已完成 | 0cd862c    |
| 刷新 generator 快照；归档本批，`pnpm gov:lists` / `gov:check` 通过                  | 已完成 | 本归档提交 |
| 收工                                                                                | 已完成 |            |

## 边界

- 分支同 `0kmyf7`；push、合并、发版由用户执行。
- 全部非破坏性：`format` 新增取值，`"prettier"` 行为不变。
- 只改本仓。共享骨架独占：无。

## 设计与理由

- **o167op ⓐ**：两处拒写（output 有 manifest 未记录的文件；forceClean 缺 git clean 且未放行）是预期保护，改抛 utils 的 `CliUserError`（与 generator 批次未找到、create 等同一机制），命令行只打原因。其它非预期错误照旧附调用栈。
- **o167op ⓑ**：选项按 camelCase 定义，`--help` 列 `--forceClean` / `--allowUntrackedDelete`；提示与选项说明统一成这个写法。yargs 仍同时接受 kebab-case，已有脚本不受影响。
- **cjunp5**：用目标项目自己的 ruff（就近 `.venv` / `venv`，含 Windows `Scripts/ruff.exe`），在该目录运行，`--stdin-filename` 给产物真实路径，让 ruff 就近读 `pyproject.toml`。不用全局 ruff（版本随机器漂移，漂移闸会假阳性，与 prettier 同理）；不借 `uv run` 现场建环境（生成时会改写目标项目的 `.venv`），找不到时提示先 `uv sync`。只管 `*.py` / `*.pyi`，其他文件不动。MCP tree 工具的配方 schema 同步放开。

## 验证（2026-11-17）

- generator vitest 46 文件 415 例全过（新增 ruff 5 例；o167op 的两条断言在改动前的源码上失败）；mcp 28 例、cli-skills 16 例全过；eslint 无报错，tsc 无错。
- 真 ruff 实测（scratchpad 临时项目，`uv venv` 装 ruff 0.17.5，`pyproject.toml` 设 `line-length = 40`）：本分支构建 `assemble build` 一份 `format: "ruff"` 配方，`dto.py` 按 40 列折行、`notes.md` 原样；`ruff format --check` 判已格式化；`assemble check` 无漂移。
- o167op 复现（issue 原步骤）：本分支构建的拒写输出 3 行（原因 + 文件 + 提示 `--forceClean` / `--allowUntrackedDelete`），无 `Error:` 重复与调用栈，退出码仍为 1。
