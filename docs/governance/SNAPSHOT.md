# 治理现状快照（SNAPSHOT）

> 文档定位：快照型 · 覆盖更新、只写当前状态 · **组合视图**：每领域一行 + 指针，细节 [MUST NOT] 复制进来。
> 项目全貌 = `docs/BUSINESS_SNAPSHOT.md` + `docs/TECH_SNAPSHOT.md`（技术基线 / 包依赖 / ADR 以其为唯一载体）。

## 领域现状

`modules/<领域>/` 按需建：**首个触及该领域的批次**交付前建 `README.md` + `SNAPSHOT.md`，并把下表该行改成指向它。
包内已有 `docs/*_SNAPSHOT.md` 的领域，模块 `SNAPSHOT.md` 只写治理视图并指向包内快照，[MUST NOT] 复述。

| 领域                                                                           | 细节快照                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| component · config · dex · extract · git · inject · publish · template · utils | 未建模块快照 → 现状见 `docs/TECH_SNAPSHOT.md` §4 / `docs/BUSINESS_SNAPSHOT.md` §4 |
| cli-skills                                                                     | 未建模块快照 → `packages/cli-skills/docs/{BUSINESS,TECH}_SNAPSHOT.md`             |
| harness                                                                        | `modules/harness/SNAPSHOT.md`                                                     |
| generator                                                                      | `modules/generator/SNAPSHOT.md`                                                   |
| create                                                                         | `modules/create/SNAPSHOT.md`                                                      |
| mcp                                                                            | `modules/mcp/SNAPSHOT.md`                                                         |
| cc-switch                                                                      | `modules/cc-switch/SNAPSHOT.md`                                                   |
| ai · mrm                                                                       | 已下线（2026-10-02 退役删除，见 `MODULES.md`）                                    |

## 跨领域依赖

见 `docs/TECH_SNAPSHOT.md` §4「依赖关系」（唯一载体）。
