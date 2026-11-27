# 领域模块 — create

## 职责

从模板创建项目：模板来源解析（列表 / 自定义 url / 本地目录）、预设问题采集（交互 / 非交互供答）、模板编译、git 细节优化、实例注册表留痕、完成提示。

## 目标定义（用户 2026-11-27 定）

脚手架流程保持简单，[MUST NOT] 在取模板这一步节外生枝：

ⓐ 拿模板列表：读配置（`--templateConfig` > 本机指针 `~/.done-coding/create/index.json` > 内置远程配置，单一来源不合并），只为拿到 `templateList`。
ⓑ 选模板。
ⓒ 把模板放到系统临时目录：url 是本机路径 → 在该仓 `git worktree add --detach` 检出它**当前所在分支**（列表项或 `-b` 显式给了分支才用该分支），不联网、不推断远端分支、不在模板仓留分支；url 是远程地址 → `git clone --depth=1`（有分支就带 `-b`）。
ⓓ 只复制模板 `directory` 到目标目录（一个模板仓可按目录提供多个模板），之后本机 / 远程完全同路。
ⓔ 模板问题与预编译生成项目，git 初始化，打印使用步骤。生成的项目里不写来源记录文件。

AI 经 MCP（prepare / complete）调用脚手架是明确需求，与交互路径走同一套 ⓐ–ⓔ。

## 落点

| 落点                                             | 说明                                   |
| ------------------------------------------------ | -------------------------------------- |
| `packages/create`                                | `create-done-coding`                   |
| `packages/mcp/src/handlers/create.ts`            | prepare / complete + 模板列表 Resource |
| `packages/cli-skills/skills/create-done-coding/` | 创建项目 skill（切片）                 |

## 领域边界

- 模板内容属 template-hub / 各模板仓；本领域只读模板的 `.done-coding/template.json`（`collectEnvDataForm` / `globalEnvData` / `list` / `usageSteps`）。
- 模板编译引擎属 `template` 领域。
