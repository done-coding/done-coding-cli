/*
 * @Description  : 时间相关初始化
 * @Author       : supengfei
 * @Date         : 2026-01-29 17:38:49
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-29 17:57:48
 */
/** 格式: 2026-01-18 11:38:05 */
export const getLogTime = () => {
  const now = new Date();
  return (
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ` +
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
  );
};
