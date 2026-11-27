# 治理现状快照（SNAPSHOT）

> 文档定位：快照型 · 覆盖更新、只写当前状态 · **组合视图**：每领域一行 + 指针，细节 [MUST NOT] 复制进来。
> 项目全貌 = `docs/BUSINESS_SNAPSHOT.md` + `docs/TECH_SNAPSHOT.md`（技术基线 / 包依赖 / ADR 以其为唯一载体）。

## 领域现状

`modules/<领域>/` 按需建：**首个触及该领域的批次**交付前建 `README.md` + `SNAPSHOT.md`，并把下表该行改成指向它。
包内已有 `docs/*_SNAPSHOT.md` 的领域，模块 `SNAPSHOT.md` 只写治理视图并指向包内快照，[MUST NOT] 复述。

| 领域                                      | 细节快照                                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| config · extract · git · inject · publish | 未建模块快照 → 现状见 `docs/TECH_SNAPSHOT.md` §4 / `docs/BUSINESS_SNAPSHOT.md` §4                                                                                                            |
| cli-skills                                | 未建模块快照 → `packages/cli-skills/docs/{BUSINESS,TECH}_SNAPSHOT.md`                                                                                                                        |
| harness                                   | `modules/harness/SNAPSHOT.md`（含指令预算与兼容入口闸、issue 家目录路径替换、归属 / 引用 / 缺口表三闸与 catalog 已发布；三闸试用反馈修正与 public 使用方 / `__all__` 可选规则 0.6.0 已发布） |
| generator                                 | `modules/generator/SNAPSHOT.md`（lodash.template 钉版 + prettier 就近解析 + tree templates 已发布；format ruff、拒写去调用栈与越界判定解开符号链接 0.7.0 已发布）                            |
| create                                    | `modules/create/SNAPSHOT.md`（templates 子命令与模板链接越界防护已发布；本机模板还原取当前分支、去掉 template.lock 未发布）                                                                  |
| component                                 | `modules/component/SNAPSHOT.md`（缺配置提示初始化命令）                                                                                                                                      |
| template                                  | `modules/template/SNAPSHOT.md`（裸 `template` 按配置批量编译；受限编译 `confineToRootDir` 0.14.0 已发布）                                                                                    |
| utils                                     | `modules/utils/SNAPSHOT.md`（`CliUserError` 不打调用栈、`epilog`、拼音改 pinyin@4 无原生构建）                                                                                               |
| mcp                                       | `modules/mcp/SNAPSHOT.md`                                                                                                                                                                    |
| dex                                       | `modules/dex/SNAPSHOT.md`（cc-switch v1/v2 与多账号导入）                                                                                                                                    |
| cc-switch                                 | `modules/cc-switch/SNAPSHOT.md`（settings v2、meta-ui 与命名空间软链修复已发布）                                                                                                             |
| showcase                                  | `modules/showcase/SNAPSHOT.md`（本地内容导出 + 显式写入组织站；校验与原子替换；README 文档站引导段导出时剔除）                                                                               |
| ai · mrm                                  | 已下线（2026-10-02 退役删除，见 `MODULES.md`）                                                                                                                                               |

## 发布状态

批次 `b0tdff` 已合并并发布，发布提交 `cbec4c9`；工作流为 `.github/workflows/oidc-release.yml`。版本以该提交的 tag 为准，证据与验证限制见 `archive/b0tdff-npm-oidc-publishing/PROGRESS.md`。

最近一次发布：2026-11-20 发版准备批次 `r58lj4`（PR #63 预发 alpha、PR #64 正式），发布提交 `fd39e84`；去掉 forcePublish 后只升 10 个包（create 0.22.0、generator 0.7.0、template 0.14.0、harness 0.6.0、mcp 0.9.0、cli-skills 0.10.0，done-coding 0.24.3、component 0.7.3、dex 0.3.3、extract 0.3.3）。

## 跨领域依赖

见 `docs/TECH_SNAPSHOT.md` §4「依赖关系」（唯一载体）。
