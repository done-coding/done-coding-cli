---
id: r8m2qx
title: issue 标题与正文的本机家目录路径替换
modules: [harness]
created: 2026-10-28
after: ""
---

# PROGRESS — r8m2qx

## 目标与边界

- 写入 issue 前，仅把 title 与正文里的当前家目录前缀（后接 `/` 或字符串结束）换成 `~`，合计替换数并按需提示；源文件不改。
- 仅修改 packages/harness 与本仓治理文档；不 push、不发版、不加 hook 或 check 规则。
- 修复指定 issue 的一处路径前缀；测试只用临时夹具，不访问真实注册表或其他仓。

## 进度与验证

- 已读根规则、开发流程、harness 快照及 issue handler/core；无 DESIGN.md。工作树初始干净，分支符合要求。
- 验收：harness test / build / eslint，仓根 check / instructions，docs 家目录路径检查。
- 已实现 title / 正文按字面路径边界替换、合计计数与按需 stdout 提示；保持既有 trim / 文件格式行为。README 已补充说明，kcxpp3 仅改路径前缀。
- 包内 `pnpm test --run`：6 文件、47 例通过；`pnpm build` / `pnpm exec eslint .` 均退 0。构建提示 API Extractor 内置 TypeScript 5.3.3 早于项目 5.8.3，未影响构建结果。
- 仓根已装命令与本地构建的 `check` / `instructions` 均退 0，`pnpm gov:check` 退 0；`git diff --check` 无输出，docs 下本机家目录绝对路径检索无匹配（退出码 1）。
- 快照已在实现提交中刷新。未 push、未发版，未新增依赖。

## 交付

- [x] v7k2pn — `44d40a5`：issue 标题 / 正文路径替换及按需计数提示、8 个新增回归用例、README 与快照更新、指定 issue 路径前缀修复。
- [x] 归档：Codex 实现提交 `44d40a5` 后写 `.git/index.lock` 被拒（未绕过）；Claude 复核（harness 47 例测试通过、实现按路径边界替换、源文件不改）后删除条目正文、git mv 归档、重生成清单并代提交本归档。
- 提交 hook 仅格式化 handler 换行；工作树与实现提交一致，但索引仍有其反向格式差异，接手时对该文件显式 git add 即可对齐。交接材料见 `/tmp/harness-issue-tilde/`（临时文件不入仓）。
