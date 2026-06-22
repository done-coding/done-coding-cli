import injectInfo from "@/injectInfo.json";

/** 从本包 injectInfo.bin 取 marker namespace；单 bin 约束，多 bin fail-loud（design R-B3a）。 */
export const getMarkerNs = (): string => {
  const bins = Object.keys(injectInfo.bin ?? {});
  if (bins.length !== 1) {
    throw new Error(
      `marker NS 取值要求本包单 bin，实得 ${bins.length}：${bins.join(",")}`,
    );
  }
  return bins[0];
};
