---
id: 3r4dvv
title: tree build 生成前校验（参数 schema + 基座版本）
modules: [generator]
created: 2026-11-06
source: 用户 2026-11-06 经总协调派发（第 2 批）
after: 6zzib5
---

# tree build 生成前校验

## 任务

| 项 | 状态 | 交付 sha |
|---|---|---|
| 下发本批（条目 git mv、锁文件独占声明） | 已提交 | dd0c7e5 |
| dyynp0 参数按模板 schema 校验 + 基座版本闸（含 tree check 同口径） | 已实现并验证 | 01c88d5 |
| 新建池条目 dhokbr（非 npm 基座版本校验，parent dyynp0） | 已入池 | 随归档提交 |
| 刷新所涉模块快照和上层摘要 | 已更新 generator | 随归档提交 |
| 归档本批并跑治理闸 | `pnpm gov:check` 通过 | 随归档提交 |
| 收工 | 完成 | |

## 授权与边界

- 同批次 6zzib5：本仓读写、显式 pathspec 提交；禁止 push、发版、改其他仓（template-hub 只读核对契约）、手改锁文件。
- **共享骨架独占：`pnpm-lock.yaml`**。generator 新增依赖 `ajv`、`semver`（两者已在锁文件中，经 MCP SDK / utils 引入），用 pnpm 10.33.0 `pnpm install` 更新 importer 段，提交前核对 diff 只含 generator importer。

## 进度

ⓐ 已读条目、generator 快照、tree handler、模板发现；只读核对 template-hub：forge / admin-core 模板 `schema.json` 已按 `base: { package, range }` 声明（hub 归档 jbmc8m 明写字段名对齐本条），无未定契约。

ⓑ 设计取舍：
- 配方 → 模板：按 addFragment `source` 约定 `<base>/<template>/fragments/<file>`（相对 templates 根）推导，一个配方可引多个模板，逐个校验；不在模板资产层的配方（assemble 默认 fragments 根）不校验，兼容现有配方。
- 参数闸：ajv 8（MIT，锁文件已有 8.20.0），`allErrors` 一次列全；`strict: false` 容忍模板里的扩展关键字；按 `params.$schema` 选 draft-07 / 2019-09 / 2020-12。常见关键字（required / type / enum / const / additionalProperties）翻成中文期望，其余保留 ajv 原文。`schema.defaults` 不合入 vars（现状即未合入，hub 模板的 defaults 与 required 不重叠）。
- 基座闸：semver（ISC，锁文件已有）`satisfies` 默认语义；从 `recipe.output` 所在目录向上至 gitRoot 就近找 `node_modules/<package>/package.json`，兼容 monorepo 子包各自安装。range 非法 → 指出 schema 问题。
- **未装即告警不阻断**：hub 的 `py-fastapi/resource` 已声明 `base: { package: "fastapi" }`，node_modules 里不可能有；若拒绝会让该模板全部失效。非 npm 生态的表达与版本来源需与 hub 对齐契约，另入池 dhokbr，不阻塞本批。
- 两道闸在 build / check 中都先于任何写盘与漂移比对执行，违规抛 utils `CliUserError`（CLI 不打调用栈；MCP 经 treeHandler 得到同一报错）。
- 依赖子路径（`ajv/dist/2020.js` 等）一并外置：首次构建子路径被打进产物（es/index.mjs 273KB），外置后 93KB；ajv 无 exports 字段，源码子路径须带 `.js`。

ⓒ 实测：
- 新增 `__tests__/tree/guard.test.ts` 9 例（参数违规列全量且零落盘、合规生成、2020-12 draft、版本在范围、版本越界零落盘、monorepo 就近解析、未装告警、range 非法、check 报版本而非漂移）；修前 5 例失败（4 例为放行路径）。
- template-hub 只读实测（复制 `module-templates/admin-core` 与 `scripts/module-templates-check/recipes/` 到临时 git 仓，去掉 `format: "prettier"`，假装 `@done-coding/admin-core`）：0.33.4 → 5 个真实配方 `tree build --all` 全部通过参数校验并生成，退出 0；0.31.0 → `tree check --all` 退出 1，逐配方报「基座版本不符」，无调用栈；删 form-page 的 title、把 control 改成 42 → 报 `/title：期望 必填；实际 缺失` 与 `/formItems/1/control：期望 取值之一 [...]；实际 42`，未写入文件。临时目录已删。

## 门禁

- `pnpm --filter @done-coding/cli-generator test`：403/403；mcp 28/28；cli-skills `test --run` 15/15（该包 test 脚本为 watch 模式，须加 `--run`）。
- eslint（改动文件）退出 0；prettier --check 通过；generator `tsc --noEmit` 退出 0；generator / mcp build 退出 0。
- 锁文件：`pnpm install`（10.33.0）后 diff 仅 generator importer 新增 ajv / semver / @types/semver 三项；`pnpm install --frozen-lockfile --offline` 通过。
