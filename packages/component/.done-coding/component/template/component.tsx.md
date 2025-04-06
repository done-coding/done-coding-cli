```tsx
import { defineComponent } from "vue";
import type { SlotsType } from "vue";
import { withInstall } from "@/_utils";

export interface ${name}Props {}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ${name}Emits = {};

export interface ${name}Slots {}

const boxCls = "${cls}";

export default withInstall(
  defineComponent<${name}Props, ${name}Emits, string, SlotsType<${name}Slots>>(
    (props, ctx) => {
      return () => {
        const { slots } = ctx;
        console.log("${name}", boxCls, props, slots);
        return <div class={boxCls}>${name}</div>;
      };
    },
    {
      name: "${fullName}",
    },
  ),
);
```
