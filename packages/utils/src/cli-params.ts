/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-23 23:09:08
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-03 21:36:52
 */
/**
 * 参数转cli参数
 * -----
 * yargs 参数格式：
 * --key=value
 */
export const params2cliParams = (params: Record<string, any>) => {
  return Object.entries(params).map(([key, value]) => {
    return `--${key}=${value}`;
  });
};
