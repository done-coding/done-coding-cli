```vue
<template>
  <div :class="boxCls">
    <Button type="primary">${name}</Button>
    <div>{{ JSON.stringify(locale.current) }}</div>
  </div>
</template>
<script lang="ts" setup>
import { useLocale, useBaseComponent } from "@/hooks";
import componentLocale from "./locale";
/*
import type {
  ${name}Props,
  ${name}Emits,
  ${name}Slots,
  ${name}Expose,
} from "./type";
*/

// const props = defineProps<${name}Props>();

// const emit = defineEmits<${name}Emits>();

// const slots = defineSlots<${name}Slots>();

const boxCls = "${cls}";

/** 组件名(小写开头) */
const nameLowerFirst = "${nameLowerFirst}";

const locale = useLocale({
  nameLowerFirst,
  componentLocale,
});

const Button = useBaseComponent("Button");

// const expose: ${name}Expose = {};
// defineExpose(expose)

defineOptions({
  name: "${fullName}",
});
</script>
```
