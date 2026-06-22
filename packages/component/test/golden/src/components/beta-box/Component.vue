<template>
  <div :class="boxCls">
    <Button type="primary">BetaBox</Button>
    <div>{{ JSON.stringify(locale.current) }}</div>
  </div>
</template>
<script lang="ts" setup>
import { useLocale, useBaseComponent } from "@/hooks";
import componentLocale from "./locale";
/*
import type {
  BetaBoxProps,
  BetaBoxEmits,
  BetaBoxSlots,
  BetaBoxExpose,
} from "./type";
*/

// const props = defineProps<BetaBoxProps>();

// const emit = defineEmits<BetaBoxEmits>();

// const slots = defineSlots<BetaBoxSlots>();

const boxCls = "dc-beta-box";

/** 组件名(小写开头) */
const nameLowerFirst = "betaBox";

const locale = useLocale({
  nameLowerFirst,
  componentLocale,
});

const Button = useBaseComponent("Button");

// const expose: BetaBoxExpose = {};
// defineExpose(expose)

defineOptions({
  name: "DcBetaBox",
});
</script>
