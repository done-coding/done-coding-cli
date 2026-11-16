---
name: done-coding-catalog
description: Use before hand-writing UI, request / login / auth code, generic utilities, project scaffolds, module pages or release scripts in a done-coding / done-creating project, or when the user asks whether done-coding already provides something（动手写界面、请求与登录、通用工具代码、发布流程之前；用户问「done-coding 有没有某某」「有哪些系列 / 包 / 模板」）. Looks up the live capability catalog (done-coding npm series and members, done-creating packages from registered repos, template-hub project and module templates), checks what the current project already installs, and guides to installing (with user confirmation) and using the right package — or to a seam + issue when something is missing.
---

# 能力目录（done-coding-catalog）

动手写之前先查：done-coding 已经有的，用上；有但缺一点的，按接缝做并提 issue；确实没有，才手写并写明查过哪里。

本技能**不带任何包清单**——目录每次从事实源现取（npm 已发布包、仓库注册表里本机仓的 package.json / pyproject.toml、模板清单、各模块模板的 schema.json），技能只讲何时查、怎么查、查到之后做什么。

## 调用入口

按序用 `command -v` 判断，命中即停：ⓐ 已装 `done-coding` → `done-coding <X> …`；ⓑ 否则已装子包 → `dc-<X> …`；ⓒ 都没有 → `npx <子包>@latest …`。下文统一写 `done-coding <X>`。

| 查什么 | 命令 | ⓒ 的 npx 写法 |
| --- | --- | --- |
| 有哪些系列、各系列成员包 | `done-coding harness catalog [--json]` | `npx @done-coding/cli-harness@latest catalog` |
| 当前项目装了哪些、同系列版本是否一致 | `done-coding harness catalog --installed` | 同上加 `--installed` |
| 项目模板（建新项目用） | `done-coding create templates [--json]` | `npx create-done-coding@latest templates` |
| 模块模板（往现有项目生成页面 / 资源） | `done-coding generator tree templates [基座] [--json]` | `npx -p @done-coding/cli-generator@latest dc-generator tree templates` |

`catalog` 输出按**系列 = 包所在仓**分组：系列一句概述（来自仓库注册表的定位，或与系列同名的聚合包描述）；每个包给版本、描述、文档位置，以及
- 「聚合入口：含 …」/「已含在 … 里」/「不在任何聚合入口里，需单独安装」——装了聚合入口不等于装了全系列；
- 「须搭配 …」（同系列 peer 依赖）、「发布到 <源>」「未上 npm」（只在本机仓或私有源）、「已弃用」、「N 天以上未更新」。

## 何时查

- 写界面组件、表单 / 列表 / 弹窗、对话界面、流程图之前；
- 写请求层、登录与静默续期、验票之前；
- 写通用工具代码、脚手架、发布与治理脚本之前；
- 建新项目、往项目里加标准页面之前；
- 用户问「done-coding 有没有…」「有哪些…」。

## 查到之后做什么

1. **找候选**：`catalog` 里按描述与概述找；读 `--json` 时看 `description`、`includedIn`、`peers`、`deprecated`。只按包名 / 组件名对照容易误判，**以描述和文档为准**。
2. **查当前项目**：`catalog --installed`。已装就直接用；同系列各包按同一版本发布时（目录会对不一致给出提示），保持同版本，不单独升降某一个。
3. **读文档再定**：打开该包的 README（目录里的「文档」）与导出（`node_modules/<包>/package.json` 的 `exports`、类型声明）。找「何时不用 / 不适合」一类说明，读到再决定；没有这类说明时，按导出的能力判断，并在汇报里写明依据。
4. **未装要装**：给出安装命令（项目的包管理器，`--registry` 指向目录里写的发布源），**等使用方确认后再装，不静默安装**。装之前提醒体积代价：先记一次构建产物主包体积，装上用后再比（曾实测只引 kit 的一个组件，主包从 885 KB 涨到 2,001 KB）；代价大时交使用方定。
5. **用上**：按文档接入；需要的同系列搭配包（「须搭配」）一起装。

## 有，但缺一点

按 blueprint 0041 做**接缝件**，不整块手写：
- 接缝件对页面暴露的接口按「希望 done-coding 提供的样子」设计，内部先手写；多领域共用的放应用壳，只属一个领域的放该领域内。
- 文件里写标注 `@done-coding-seam <issue 标识>：<一句说明>`，并登记到治理 `SNAPSHOT.md` 的 `## done-coding 缺口表`（列：缺口 / 接缝件 / issue / 状态）。格式与核对见 cli-harness 技能「缺口表闸」。
- 向提供该包的仓提 issue：`done-coding harness scope list --inbox` 找收件箱，`done-coding harness issue <仓名> …`（见 cli-harness 技能）。没有收件箱的仓，正文记在本仓记录里并告知用户。

## 确实没有

可以手写。在提交说明或批次进度里写一句「查过哪里（catalog / templates / 文档）、为何不用」，免得下一个人重复查。

## 目录查不到 ≠ 没有

- `catalog` 提示「未比对 npm」（离线 / 源不通）：已发布版本未知，只列了注册表里本机仓的包。联网后再查，或 `--registry` 换源（镜像可能滞后）。
- 系列「无概述」或包不全：可能是该仓没登记仓库注册表（`done-coding harness scope list` 看已登记的仓）。
- 兜底查法：读当前项目 `node_modules/@done-coding/*/package.json` 与 `node_modules/@done-creating/*/package.json` 的 `description` / `exports`；`npm view <包> description version`；看对应仓的 README。
- 没装任何 done-coding 工具且离线：只能读本机已有的 node_modules 与仓库，如实告诉用户哪些没法确认。

## 目录不会过期的依据

数据每次现取，没有缓存清单。`done-coding harness catalog --check` 在以下情况退出码 1：本机仓里的版本落后 npm（克隆没拉新）、包缺 description、系列缺概述、npm 清单读取失败或未比对。目录看起来不对时先跑它。
