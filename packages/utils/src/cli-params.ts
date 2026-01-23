/**
 * 参数转cli参数
 * -----
 * yargs 参数格式：
 * --key=value
 */
export const params2cliParams = (params: Record<string, any>) => {
  return Object.entries(params)
    .map(([key, value]) => {
      return `--${key}=${value}`;
    })
    .join(" ");
};
