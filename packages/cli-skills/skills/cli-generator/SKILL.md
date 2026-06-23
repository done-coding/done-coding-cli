---
name: cli-generator
description: Use when generating / scaffolding named batch instances (components, pages, stores, routes, any templated file set) into an existing project via dc-generator（生成/新增具名批次实例：组件、页面、路由等任意模板化文件批次）. Drives the dc-generator CLI non-interactively via npx — no resident MCP needed.
---

# 生成 done-coding 批次实例（cli-generator / dc-generator）

用 `dc-generator` 把一个**具名批次**（component / page / store / route / api … 任意由 `.done-coding/<type>/` 配置定义的批次）**非交互**地生成进当前项目，无需常驻 MCP。

> **调用入口（重要）**：两个**参数完全一致**的等价入口——
> - 本机已全局装 `dc-generator` → 优先 **`dc-generator ...`**（最稳）。
> - 否则 **`npx @done-coding/cli-generator@latest ...`**（现取现用；⚠️ 发布后生效，未发布时改用全局 `dc-generator`）。
>
> 下文示例以 `dc-generator` 书写，替换为 `npx @done-coding/cli-generator@latest` 即等价。

## 何时用

用户要：在现有项目里**生成/新增**一个组件 / 页面 / store / 路由 / 任意模板化文件批次；批量 scaffold 一套文件；按既有规范确定性产出代码。

## 心智模型（两步）

1. **查问题** `add <type> --list-questions`：拿到该批次要哪些答案（JSON，机读）。
2. **带答案生成** `add <type> <name> --env '{...}'`：把答案一次性传入，非交互生成实例。

## 前置：确定批次类型 `<type>`

批次由 `.done-coding/<type>/`（含 `index.json` + `config.json5` + `template/`）定义，按**就近优先**解析：当前项目 → 逐级父目录 → 全局 `~/.done-coding/<type>/`。

ⓐ **用户已指明批次类型** → 直接用作 `<type>`。
ⓑ **不确定有哪些批次** → 先列出：

```bash
dc-generator list
```

输出各层可达批次（含 `layer` / `shadowed` / 是否 `invalid`）。**[MUST NOT]** 把标记非法（缺 index.json / config 不可解析）的批次当可用批次。

ⓒ **没有想要的批次** → 用 `dc-generator init <type>`（或 `--global` 写 `~/.done-coding/<type>/`）生成骨架后，按注释填 `config.json5` + `template/`，目标已存在则报错不覆盖。

## 步骤 1 — 查询批次需要哪些答案

```bash
dc-generator add <type> --list-questions
```

仅向 **stdout** 打印 JSON（不落地，退出码 0）。形如：

```json
[
  { "key": "series", "required": false, "default": "Dc" },
  { "key": "desc", "required": true }
]
```

判定规则：
- `required: true`（无 `default`）→ **必填**，[MUST] 供答。
- `required: false`（带 `default`）→ 选填，不供答则回落 `default`。

## 步骤 2 — 收集答案后非交互生成

答案拼成 JSON（key 对齐步骤 1 的 `key`，**是 key 不是中文 label**），经 `--env` 一次性供答：

```bash
dc-generator add <type> <name> --env '{"desc":"用户卡片","series":"Dc"}'
```

答案多时可改用文件：`--env-file ./answers.json`（内容为 `{ key: value }`）。

## 移除实例（反配方）

```bash
dc-generator remove <type> <name> [--env '{...}']
```

按 add 的反配方移除：create 产物删文件、append/inject 块按命中/marker 精确回退、空目录可配删除。`inject`（锚点插入）按 marker 精确删、免疫块内手改；`replace` 策略**不可自动 remove**（会 fail-loud 提示手动）。

## 完整示例

```bash
# 1. 先查问题
dc-generator add component --list-questions
# → [{"key":"series","required":false,"default":"Dc"},{"key":"desc","required":true}]

# 2. 补必填后生成名为 user-card 的组件实例
dc-generator add component user-card --env '{"desc":"用户卡片"}'

# 3. 列出 component 批次的已有实例（-o 落地 JSON 列表）
dc-generator list component -o ./src/components/name-list.json

# 4. 不要了，移除
dc-generator remove component user-card
```

## 行为约定（据实测）

- **退出码可信**：缺必填 / 失败 → **退出码 1**，stderr 列出缺啥；成功 → 0。agent 可直接靠退出码判断成败。
- **stdout 只出数据**：`--list-questions` 的 JSON 走 stdout，诊断/报错走 stderr——解析只读 stdout。
- **无 TTY 自动非交互**：CI / agent / 管道环境缺答案即快速失败，不卡住。
- **就近覆盖**：同名批次以更近层（项目 > 父 > 全局）为准；实例永远落在**当前项目**（执行目录），与模板来自哪层无关。
- **inject 锚点插入**：用语言感知 marker 哨兵注释包裹，按实例身份回退，免疫块内手改（对标 Ansible blockinfile）。

## 命令速查（公开项）

| 命令 | 说明 |
|---|---|
| `dc-generator list [type]` | 无 type=列出所有已发现批次；带 type=列出该批次实例（`-o` 落地 JSON） |
| `dc-generator add <type> <name>` | 生成一个批次实例（`--list-questions` 探针 / `--env` / `--env-file` 供答） |
| `dc-generator remove <type> <name>` | 反配方移除一个实例（`--env` 复算落地块） |
| `dc-generator init <type>` | 生成批次骨架（`--global` 写 ~/.done-coding） |
| `--list-questions` | 仅打印该批次问题清单(JSON)，不落地 |
| `--env` / `--env-file` | 预设答案 JSON 字符串 / 文件路径 |
