/** 路径安全性检测正则 - 移除全局标志 g 以保证 test() 的幂等性 */
const PATH_SAFE_CHECK_REGEX = /[^a-zA-Z0-9._\-]/;
/** 路径替换正则 - 保留 g 用于全局替换 */
const PATH_SAFE_REPLACE_REGEX = /[^a-zA-Z0-9._\-]/g;

/** 路径是否安全 */
export const pathIsSafe = (path?: string): boolean => {
  // 注意：这里逻辑需要反一下。
  // 如果 test 到了非法字符，说明路径“不安全”
  return path ? !PATH_SAFE_CHECK_REGEX.test(path) : false;
};

/** 获取安全路径 */
export const getSafePath = (path?: string) => {
  // 将所有非法字符替换为下划线，确保目录名合法
  return (path || "_").replace(PATH_SAFE_REPLACE_REGEX, "_");
};
