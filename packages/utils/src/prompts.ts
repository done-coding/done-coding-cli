import chalk from "chalk";

/** prompt表单-进程退出信号处理 */
export function onPromptFormStateForSigint(params: {
  aborted: boolean;
  value: any;
}) {
  if (params.aborted) {
    console.log(chalk.red("退出输入"));
    return process.exit(1);
  }
}
