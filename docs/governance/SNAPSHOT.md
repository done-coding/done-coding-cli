# 治理现状快照（SNAPSHOT）

> 文档定位：快照型 · 覆盖更新、只写当前状态 · **组合视图**：每领域一行 + 指针，细节 [MUST NOT] 复制进来。
> 项目全貌 = `docs/BUSINESS_SNAPSHOT.md` + `docs/TECH_SNAPSHOT.md`（技术基线 / 包依赖 / ADR 以其为唯一载体）。

## 领域现状

`modules/<领域>/` 按需建：**首个触及该领域的批次**交付前建 `README.md` + `SNAPSHOT.md`，并把下表该行改成指向它。
包内已有 `docs/*_SNAPSHOT.md` 的领域，模块 `SNAPSHOT.md` 只写治理视图并指向包内快照，[MUST NOT] 复述。

| 领域                                                                           | 细节快照                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| config · extract · git · inject · publish | 未建模块快照 → 现状见 `docs/TECH_SNAPSHOT.md` §4 / `docs/BUSINESS_SNAPSHOT.md` §4 |
| cli-skills                                                                     | 未建模块快照 → `packages/cli-skills/docs/{BUSINESS,TECH}_SNAPSHOT.md`             |
| harness                                                                        | `modules/harness/SNAPSHOT.md`（含指令预算与兼容入口闸、issue 家目录路径替换）                                                     |
| generator                                                                      | `modules/generator/SNAPSHOT.md`（tree 生成前参数 / 基座版本校验，未发布）                                                   |
| create                                                                         | `modules/create/SNAPSHOT.md`（位置参数项目名，未发布）                                                      |
| component | `modules/component/SNAPSHOT.md`（缺配置提示初始化命令，未发布） |
| template | `modules/template/SNAPSHOT.md`（裸 `template` 按配置批量编译，未发布） |
| utils | `modules/utils/SNAPSHOT.md`（`CliUserError` 不打调用栈、`epilog`，未发布） |
| mcp                                                                            | `modules/mcp/SNAPSHOT.md`                                                         |
| dex | `modules/dex/SNAPSHOT.md`（cc-switch v1/v2 与多账号导入） |
| cc-switch                                                                      | `modules/cc-switch/SNAPSHOT.md`（0.4.1 settings v2 + meta-ui；命名空间软链修复未发布）                    |
| showcase | `modules/showcase/SNAPSHOT.md`（本地内容导出 + 显式写入组织站；校验与原子替换） |
| ai · mrm                                                                       | 已下线（2026-10-02 退役删除，见 `MODULES.md`）                                    |

## 跨领域依赖

见 `docs/TECH_SNAPSHOT.md` §4「依赖关系」（唯一载体）。
