/** 解析checkoutInfo */
export const resolveCheckoutInfoByRefInfo = (message: string) => {
  const refInfo = message.match(/moving\s+from\s+(.*)\s+to\s+(.*)/);
  if (refInfo) {
    const [, fromBranchRaw, toBranchRaw] = refInfo;
    return {
      fromBranch: fromBranchRaw.trim(),
      toBranch: toBranchRaw.trim(),
    };
  }
};
