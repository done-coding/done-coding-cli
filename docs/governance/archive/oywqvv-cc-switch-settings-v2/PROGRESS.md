---
id: oywqvv
title: cc-switch settings v2 身份与别名分离及多账号
modules: [cc-switch, dex]
created: 2026-10-27
parent: ""
after: ""
---

# PROGRESS — oywqvv

## 目标与授权

仅在 feat/cc-switch-settings-v2 实施 A；不 push、不发布、不改 master、不访问真实用户配置。B `5p64zz` 本轮仅登记。

## 依据与实现计划

使用仓内 cc-switch config/meta/handlers、dex import 及现有测试（MIT 仓内代码）；Node crypto/fs 内置能力；不引入外部代码或依赖。设计：`../../modules/cc-switch/DESIGN.md`。

- [x] ⓐ 设计及批次串登记，lists/check；独立 docs 内容已登记；提交受沙箱阻止。
- [x] ⓑ 先添加失败用例，再实现 settings-v2.ts 的 parse/normalize/assignMissingUuids 与 v1 分支；config.ts 分发；test/build。
- [x] ⓒ 迁移和 settings 原子写、Schema、meta-account/migrate 与差异提示，先失败测试再实现，README；cc-switch test/build 后整理完整 feat 代提交分组。
- [x] ⓓ dex import 复用导出、拆分账号，先 v2 导入失败测试再实现；dex test/build 后整理独立 feat 代提交分组。
- [x] ⓔ 全仓 test/lint、快照与条目收口完成；归档后执行最终 harness check/instructions。Git 提交由 Claude 代执行（见文末）。

共享接口：parseSettings(unknown) → AnySettings；normalizeSettings(AnySettings) → 账号展开后的服务商列表；assignMissingUuids(SettingsV2Input) → SettingsV2；buildProfileConfig(AnySettings) → ProfileConfig。读取 v2 缺 UUID 报错；写入新实体先补 UUID 再校验。

审查重点：凭据二选一、跨 provider/account 拼名碰撞、备份/写失败不破坏原文件、默认 account 与 provider 关联、非法 v1 alias 迁移不可静默改名。

## 进度与证据

- 起点核验：HEAD aba8c58，指定分支、工作树干净；Node v22.22.2 / pnpm 10.33.2；dex 无包级 AGENTS.md。
- 根 DEVELOPMENT 未指定单独 root lint 脚本；采用 `pnpm exec eslint .`（不自动修改无关文件）。
- 未触及共享骨架，无 lockfile/依赖变动计划。

- 登记验收：`done-coding harness lists`、`done-coding harness check` 均退出 0（临时 HOME）。

- Git 暂存尝试退出 128：`.git/index.lock: Operation not permitted`；未申请绕过。后续采用用户授权的 Claude 代提交方式，消息/pathspec 放 `/tmp/cc-switch-v2-*-{message,pathspec}.txt`，没有交付 sha 前均明确标待提交。
- cc-switch 基线 135/135；配置与写入阶段 164/164（test 退出 0）。覆盖 v1 字节基准、迁移等价、账号/default/冲突/补 UUID、原子失败与 symlink。
- 测试独立 vitest.config.ts，避免加载 generateFile 向 src 写入。所有命令经临时 HOME；Corepack 只读原缓存、显式禁网。现缓存 pnpm 10.33.2，CI 10.33.0 未缓存；本轮无 install/锁文件更改，测试使用现有 10.33.2，不声称已测 CI 版本。
- Schema 使用仓内 eslint 自带 Ajv 6.12.6（MIT），仅测试校验；无新依赖或 lockfile 改动。

- cc-switch `pnpm test`：179/179，退出 0；`pnpm build` 退出 0。dex `pnpm test`：14/14，退出 0；`pnpm build` 退出 0。最后改动后还会执行最终构建和门禁。
- 独立审查（requesting-code-review）发现两处 v1 继承路径不满足设计：模型碰撞先写源、v1 settings 非原子写。已各加回归观察失败，再修复为先构建校验、两版本统一原子写；179/179 通过。
- 自查的部分写入临时文件残留：先复现失败，再改为排他 open 后立刻登记清理责任；migration/v1 均覆盖，源字节保留。
- 审查 Minor 暂缓：UUID 当前按文本精确匹配，大小写不同视为不同值；randomUUID 产出统一小写。未在本批扩展 UUID 大小写规范化，手工引用应保持原值。
- 审查边界裁定：profile 原子写/双文件事务仍沿用现状；dex 默认与 env 导入策略按设计保持；局部 UUID 允许跨 provider 相同；初装保留 v1 starter。上述均不作为本批扩展项。

- 最终两包：cc-switch test 179/179、build；dex test 14/14、build 均退出 0。实际构建 CLI 冒烟（迁移/账号缺参退出 1/正确更新/新增模型/改名/无变化静默）退出 0；pack dry-run 确认包含 Schema。
- 根 `pnpm test` 首轮遇到本批新增红测试，修复后重跑：generator modify.test.ts 无法解析 lodash.assign，退出 1。依赖文件实际存在，涉及 generator/template/lockfile 相对 HEAD 无改动；单独运行 generator modify.test.ts 6/6、退出 0，不能断言缺依赖。构建结束后再完整复跑以排除运行状态干扰，不扩展修复其他包。
- `done-coding harness instructions` 退出 0；根 eslint 退出 0，23 个 warning（含既有和新测试类型提示），无 error。


## 最终验收

命令均使用临时 HOME，Corepack 禁网并只读缓存；本机 Node v22.22.2 / pnpm 10.33.2。日志在 `/tmp/cc-switch-v2-*.log`。

| 目录 | 命令 | 退出码 | 证据 |
| --- | --- | --- | --- |
| packages/cc-switch | pnpm test | 0 | 15 文件，179 例；cc-final-test.log |
| packages/cc-switch | pnpm build | 0 | cc-build-final.log |
| packages/cc-switch | pnpm exec eslint . | 0 | 21 warnings / 0 errors；cc-lint.log |
| packages/dex | pnpm test | 0 | 3 文件，14 例；dex-final-test.log |
| packages/dex | pnpm build | 0 | dex-final-build.log |
| packages/dex | pnpm exec eslint . | 0 | dex-lint.log |
| 仓根 | pnpm test | 0 | 最终 10 包通过；root-test-settled.log |
| 仓根 | pnpm exec eslint . | 0 | 23 warnings / 0 errors；lint-final.log |
| 仓根 | done-coding harness instructions | 0 | instructions.log；归档后再执行最终闸 |
| packages/cc-switch | npm pack --dry-run --ignore-scripts --json | 0 | 包文件含 settings.schema.json；pack-check.log |
| 仓根 | python3 /tmp/cc-switch-v2-cli-smoke.py | 0 | 构建 CLI 的完整迁移 / 账号 / 改名路径；cli-smoke.log |

根测试曾一次失败于 generator 的 lodash.assign 解析；文件已安装，单测复跑与最终全仓复跑均通过。未改 generator/template/锁文件，根因未进一步确认，不将暂态现象写成缺依赖结论。

## 替换了什么

- v1 独占解析替换为按 version 分发的 v1 / v2 共享解析；v1 编译名、env 与序列化字节保持。
- v2 使用 UUID 引用和可改 alias，provider 支持多个独立账号；模型级 env 覆盖顺序不变。
- settings 直接写盘替换为受控路径下的 600 临时文件 + 原子 rename，源变更先构建验证。
- dex 自定义 cc-switch 结构读取替换为包导出的 parseSettings / normalizeSettings，账号分别导入。
- 增加显式迁移、账号参数、差异提示、发布 Schema 和用户文档；没有实现 B/UI，没有依赖/lockfile 变更。

## 交付与提交

Git 写入被拒，未绕过；无短 sha，不声称已提交。按用户指定由 Claude 代提交，分组材料放 `/tmp/cc-switch-v2-commits/`。归档后仅保留本 PROGRESS，代提交时回填下表 sha（不得伪造）。

| 条目 | 交付内容 | sha |
| --- | --- | --- |
| kskg9o | 设计稿 | `335e34e` |
| jc0bsi | settings v2 与校验 | `335e34e` |
| 3jct2z | 显式迁移与 Schema | `335e34e` |
| tqw66s | meta 命令与改名提示 | `335e34e` |
| aye95c | dex 适配 | `3521720` |
| fqd4ru | 验收与治理收口 | 归档提交（不自引用） |

## 未验证 / 暂缓

- 未在 CI 的 pnpm 10.33.0 上验证（本机缓存仅 10.33.2）；无 install 或锁文件变更。
- 未用真实配置/凭据调用 Claude 或服务商 API；没有访问用户真实 ~/.done-coding。
- 包未发布，因此不验证 CDN 上新版 Schema 可访问性。
- 审查 Minor：手工 UUID 大小写规范化暂缓；当前精确文本匹配，保持 UUID 原值即可。
- B 5p64zz 本轮明确不实施，未查询 config-ui 发布状态。后续获授权开工先核验已发布精确版本，未发布则停在 B 开工前。

本批交付归档后立刻开始下一批 `5p64zz`；若 `@done-coding/config-ui` 尚未发布则停在 B 开工前并报告。当前用户本轮明确限制“不实施 B”，故本轮停在 B 开工前，B 仍在 schedule。

- 归档后最终命令：`done-coding harness lists`、`done-coding harness check`、`pnpm gov:check`、`done-coding harness instructions` 全部退出 0。`git diff --check` 退出 0；归档仅保留 PROGRESS，B 留 schedule。
- 代提交分组三组已落 `/tmp/cc-switch-v2-commits/`，01 为 cc-switch + DESIGN，02 为 dex，03 为治理。01 body 明示 generation stdout 增加差异行和 settings 拒绝 symlink 的兼容性影响；不会隐式发版。

## Claude 复核与代提交（2026-10-27）

- 独立重跑：cc-switch 179 例 / dex 14 例测试与两包 build、`dc-harness check` / `instructions` 均 exit 0。
- 真实数据副本实测（临时 HOME，不触碰用户目录）：v1 只读生成与用户现 profile.json 完全一致；`--meta-migrate`
  有备份、迁移后生成 12 个 profile 与迁移前完全一致；手工合并 ark-agent-plan / -199 为一服务商两账号（157 / 199）后，
  199 的 4 个 profile 名与内容不变，157 的 4 个与原 ark-agent-plan 内容一致，改名提示正确列出移除 / 新增名。
- 01 提交信息去掉 `BREAKING CHANGE` 关键字（避免 lerna 将 0.x 直升 1.0.0），行为变化保留在正文；是否按大版本发布由用户决定。
- 代提交：01 `335e34e`（cc-switch + DESIGN）、02 `3521720`（dex），本归档另提一笔。
- 注：未发布前本地构建写入的 `$schema` 指向 `@0.4.0`（该版本尚无此文件）；发布后由新版本迁移写入正确版本号。
