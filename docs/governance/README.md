# 治理总纲 — done-coding-cli

> 方法论：harness-workspace skill · 档位：**中** · 初始化：2026-09-27（初始化标记即本文件）
> 调度领域（横向 `release`）：无常驻承接方，需发版的会话按需一次性承接。

## 文档职责

| 文件 / 目录                                                                  | 职责                                             | 维护方式                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------- |
| `DEVELOPMENT.md`                                                             | 全项目开发流程（由仓根 `AGENTS.md` 要求读取）    | 手写，模板源自 skill          |
| `AGENTS.md`                                                                  | 本目录维护规则：条目 / 流转 / 收口 / 分诊        | 手写                          |
| `MODULES.md`                                                                 | 领域清单与落点（设计视图）                       | 手写，新增包同批改            |
| `SNAPSHOT.md`                                                                | 上层现状（每领域一行 + 指针）                    | 覆盖更新，交付同笔刷          |
| `BACKLOG.md` · `SCHEDULE.md` · `ARCHIVE-DONE.md` · `DROPPED.md` · `ISSUE.md` | 清单                                             | **脚本生成**，[MUST NOT] 手改 |
| `backlog/`                                                                   | 需求池正文 `<id>-<slug>.md`                      | 任何会话可建                  |
| `issue/`                                                                     | 兄弟仓（本治理外）反馈收件箱，只有「未分诊」一态 | 外部方填；分诊由用户触发      |
| `schedule/<批次id>-<slug>/`                                                  | 在途批次：`PROGRESS.md` + 条目正文               | 谁开谁关                      |
| `archive/<批次id>-<slug>/`                                                   | 已交付批次，只留 `PROGRESS.md`                   | 交付时 `git mv`               |
| `dropped/`                                                                   | 判不做 / 过期 / 被合并（带 `dropped:` 理由）     | `git mv`，[MUST NOT] 删       |
| `modules/<领域>/`                                                            | 模块 `README.md` + `SNAPSHOT.md`                 | 首个触及批次按需建            |

## 常用命令（仓根执行）

```bash
pnpm gov:lists                                    # 重生成清单（dc-harness lists）
pnpm gov:check                                    # 收口 / 下发前过闸（dc-harness check）
dc-harness issue <目标仓> -t <标题> -s <slug> -b <正文文件>   # 向兄弟仓提 issue
LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c6 # 条目 / 批次 id
```

> `gov:*` 直接跑 `packages/harness/es/`，全新 clone 先 `pnpm install && pnpm -F "@done-coding/cli-harness..." build`（`...` 连同依赖一起构建）。
> 清单文件头仍写「由 `scripts/governance-lists.py` 重生成」：与全局生成器逐字节一致是迁移验收口径，待全局 py 退役（`~/.claude` 侧 specs+Gate）时统一改。

## 与既有文档的关系

- `docs/specs/` 存量 live spec 保持原流程（settled 后 `archive-docs.sh` 迁 `.harness`），不并入本池。
- 项目全貌仍以 `docs/{BUSINESS,TECH}_SNAPSHOT.md` 为准；本目录只放治理视图。
