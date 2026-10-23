# 领域模块 — harness

## 职责

harness-workspace 治理机制的工具化：治理清单生成、治理闸（元闸 / 并行闸 / 收口形态 / 清单零 diff）、跨仓 issue 投递（可按仓名寻址）、仓库注册表 `~/.done-coding/harness/scope`（list / check / register）。

## 落点

| 落点                                      | 说明                                         |
| ----------------------------------------- | -------------------------------------------- |
| `packages/harness`                        | `@done-coding/cli-harness`，bin `dc-harness` |
| `packages/cli-skills/skills/cli-harness/` | 对接 Claude 的 skill（聚合容器内切片）       |

`packages/cli` 的 `DC harness` 注册属共享骨架，不归本领域。

## 领域边界

- 只做机械检查与文件生成，不裁决需求取舍（分诊 / 划批判断属使用方会话）。
- 不依赖 Python；目标取代 `~/.claude/scripts/governance-lists.py` 与各仓 `docs/governance/scripts/gates.py`（现状见 `SNAPSHOT.md`）。
