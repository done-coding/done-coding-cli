---
id: 7m924q
title: dc-harness 引用闸：Vue 文件里与 <script> 同一行的 import 不被识别，越界引用漏报
created: 2026-11-16
from: business-code-studio
---

## 现象

引用闸（`feat/harness-mechanical-gates` 49cd746）识别 Vue 单文件组件里的 import 时，只认独占一行开头的 `import`。`<script>` 标签与 `import` 写在同一行时，这条引用不被检查，越界引用漏报。

## 复现

business-code-studio 批次 fb012u：三闸为 on，`check` 全过的状态下，在壳文件 `frontend/apps/web/src/Home.vue` 末尾追加一行

```vue
<script lang="ts">import "./domains/project-workspace/format";</script>
```

`dc-harness check` 仍全过（`format.ts` 是领域内部文件，壳只许经领域 `index.ts`）。把同一句拆成三行（`<script lang="ts">` / `import …` / `</script>`），或放进已有的 `<script setup>` 块，都能报出 `❌ 引用：…/Home.vue:N → …/project-workspace/format.ts`。

## 影响与建议

prettier 会把这种写法拆成多行，所以按仓库格式化的代码一般不会撞上。但未格式化的文件，以及不跑 prettier 的仓库，会让引用闸给出假绿。建议按 `<script>` 块的内容解析，或允许 `import` 前面出现 `>`。

已有 5pmb5g（未跟踪文件、方向、`__all__` 等）、rhfv9v（public 不分使用方）、w6d0yv（已替换规则），与本条不同题。
