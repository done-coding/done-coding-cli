---
id: q8m4vx
title: cc-switch 软链家目录配置修复
modules: [cc-switch]
created: 2026-10-28
parent: ""
after: ""
---

# PROGRESS — q8m4vx

## 目标与边界

修复命名空间软链导致 --meta-ui 拒绝启动/保存；只改 cc-switch 实现与测试，以及本批必需治理记录。
不 push、不发版；所有夹具使用临时 HOME，不访问真实 ~/.done-coding。
依据仓内 settings-file.ts、meta-ui.ts、已有回归与设计契约；不引入依赖或外部代码。

## 完成标准

同步/异步共享路径判定：命名空间软链允许，root 逃逸和文件软链拒绝。
先见失败回归，再修复；包 test/build/eslint、构建 CLI HTTP 冒烟与 harness check 通过。

## 进度

- 已读规则、快照、设计和实现；初始工作树干净，分支符合任务。
- 已定位异步 lstat 对 root/parent 的直接拒绝；UI 启动、保存和 profile 重建共用该检查。
- Node v22.22.2，pnpm 10.33.2；不操作依赖和 lockfile。
- RED：两条命名空间软链回归均在 assertSettingsTargetAsync 报「目录符号链接或越界」；同步迁移先成功。
- 沙箱 HTTP 监听 EPERM，已申请本地回环监听豁免；Corepack 固定既有缓存并禁网。
- 实现将可疑根、目录 realpath 边界、文件类型与文件 realpath 判定提取为共享纯函数；两版只保留各自 I/O。

## 最终验证

| 命令（包内执行，治理命令除外） | 结果 | 日志 |
| --- | --- | --- |
| pnpm exec vitest run src/__tests__/meta-ui.test.ts（修复前） | 2 failed / 15 passed，仅新增合法软链场景失败 | red-http.log |
| pnpm test | 16 文件、207 例通过，exit 0 | test.log |
| pnpm build | exit 0；既有 API Extractor TypeScript 版本提示 | build.log |
| pnpm exec eslint . | exit 0；21 warning / 0 error | lint.log |
| node scripts/smoke-meta-ui.mjs | exit 0；命名空间软链下真实 CLI HTTP 保存、权限 600、重建字节一致 | smoke.log |

日志与运行器在 `/tmp/cc-switch-symlink-fix/`。运行器设置临时 HOME、固定已有 Corepack 缓存并禁网；
HTTP 单测和冒烟获回环监听豁免，其余检查在默认沙箱执行。
两条合法软链回归覆盖同步迁移备份/源文件 600、异步 UI 保存/profile 重建 600；
root 逃逸时同步迁移与 UI 启动均拒绝，外部字节与文件清单保持；既有 settings/profile 文件软链拒绝用例全过。
启动阶段和 profile 重建没有额外独立的同类检查，均随共享判定修复。

## 收口

本批条目 r7k2nz 已实现；所涉模块和上层快照、设计契约已更新，归档仅保留本进度文件。
交付 sha：随本归档所在提交（不自引用）；若 .git 写入受限，由 Claude 使用准备的材料代提交。
未验证真实浏览器交互与用户配置；本次按任务要求验证 HTTP 与临时夹具，不访问真实 ~/.done-coding。
不 push、不发版；未扩大到其他包、依赖或 lockfile。

- 归档后 `dc-harness check` 与 `pnpm gov:check` 均 exit 0；日志分别为 harness-check.log / gov-check.log。
- `done-coding harness lists` 已重生成归档清单，`git diff --check` 通过。
