---
id: an1hhe
title: cli-utils 拼音改用不带原生构建的 pinyin@4，pnpm 12 全新安装不再报 IGNORED_BUILDS
modules: [utils]
created: 2026-11-11
source: 总协调派单（发版后冒烟发现，用户 2026-11-11 分诊当轮做，服务 M4）
after: ""
---

# cli-utils 去掉原生构建依赖

## 任务

| 项                                                                                           | 状态                                                         | 交付 sha   |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------- |
| acqapd cli-utils 经 pinyin@2 → nodejieba 带进原生构建，pnpm 12 全新安装退出码 1              | 已完成（generator / create 达标；done-coding 余项转 d3f6t7） | 本归档提交 |
| 刷新 utils 快照与上层摘要；归档本批（只留 PROGRESS.md），`pnpm gov:lists` / `gov:check` 通过 | 已完成                                                       | 本归档提交 |
| 收工                                                                                         |                                                              |            |

## 边界

- 分支：从 master `af27ef3` 切 `fix/utils-pure-js-pinyin`，压成一个提交；push、合并、发版由用户执行。
- 共享骨架独占（本批声明）：`pnpm-lock.yaml`。锁文件用 CI 同版本 pnpm 10.33.0（`--lockfile-only`，npmjs 源）更新，再按根 `postinstall` 用 prettier 格式化。

## 进度

- 根因（发版后冒烟实测）：pnpm 12.15.0 全新安装 cli-generator 0.5.0 / create-done-coding 0.20.0，报 `ERR_PNPM_IGNORED_BUILDS: nodejieba@2.5.2`，退出码 1；链路为 cli-utils 0.14.1 → pinyin@2.11.2 →（optionalDependencies）nodejieba。仓内只有 `packages/utils/src/git/commit-resolve.ts` 用 pinyin，给 `getGitLastCommitInfo` 的 `lastCommitterPinYin` / `userNamePinYin` 取值；这两个字段在本工作区无消费方，但属 cli-utils 公开 API，故保留能力、只换实现。
- 方案：升到 pinyin@4.0.0。同一作者的同一库，分词器（nodejieba / segmentit / @node-rs/jieba）改为可选 peer，默认不装、无原生构建；本仓不传 `segment`，与 v2 默认不分词的行为一致。v4 的 CJS 产物把函数挂在 `exports.default`，Node ESM 默认导入拿到的是对象，故改为具名导入 `import { pinyin } from "pinyin"`（Node ESM 与 vite 下均实测可用）；v4 自带类型，删去 `@types/pinyin`。
- 许可证与风险：pinyin@4.0.0 为 MIT（作者 hotoo，与 2.11.2 相同）。4.0.0 发布于 2025-05-21，至今无新版本，维护活跃度一般；`engines` 写的是 `install-node: ^18.0.0`，不影响安装。新增依赖仅 `commander@1.1.1`（v2 已有）。
- 输出对照：用 40 个样本（含多音姓氏、繁体、中英混排、符号、emoji、全角、韩日文、空串）分别跑 pinyin@2.11.2 与 4.0.0（`STYLE_NORMAL`、`heteronym: false`），输出逐项一致。新增 `packages/utils/__tests__/commit-resolve.test.ts`（mock git 命令输出，拼音走真实依赖，16 例），期望值取 v2 实测；换实现前后同一份测试都通过。
- 锁文件：diff 只有 pinyin 2.11.2 → 4.0.0、去掉 `@types/pinyin` 与 nodejieba / node-pre-gyp 依赖链（共 23 项），无其他变动。
- 仓外冒烟（pnpm 12.15.0，npmjs 源，`pnpm -r pack` 出 16 个 tarball，冒烟目录用 `overrides` 把所有 `@done-coding/*` 指向本地 tarball）：
  - cli-generator：`pnpm add` 退出码 0，无 IGNORED_BUILDS，解析 pinyin@4.0.0、无 nodejieba；`tree build` / `tree check` 退出码 0。
  - create-done-coding：`pnpm add` 退出码 0；用 gitee 公开模板 template-npm-common 非交互建项目，退出码 0，生成 `.done-coding/template.lock.json`。
  - 打包后的 cli-utils 在真实 git 仓里调用 `getGitLastCommitInfo`：提交者「苏鹏飞」→ `supengfei`，用户名「单雄信」→ `danxiongxin`，与 v2 一致。
  - done-coding：`pnpm add` 仍退出码 1，余 `done-coding` 自身 postinstall、`@google/genai@1.52.0`（preinstall 为 echo）、`protobufjs@7.6.6`（postinstall），后两者经 cli-dex → `@earendil-works/pi-coding-agent` 引入。超出本批 utils 范围，另立 backlog 条目 d3f6t7。
- 门禁（2026-11-11）：utils `vitest run` 31 例全过、`tsc --noEmit` 退 0、`eslint .` 退 0、`vite build` 退 0。
