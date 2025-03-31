import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import _template from "lodash.template";

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log(argv);
  const { envData: envDataInit, envJson, output, input } = argv;

  if (input === output) {
    console.log(chalk.red(`input不能与output相同`));
    return process.exit(1);
  }

  let envData: Record<string, string>;
  if (envJson) {
    if (!envJson.endsWith(".json")) {
      console.log(chalk.red(`envJson必须是json文件，请检查文件后缀名`));
      return process.exit(1);
    }

    if (envJson === output) {
      console.log(chalk.red(`envJson不能与output相同`));
      return process.exit(1);
    }

    console.log(path.resolve(envJson) === path.resolve(process.cwd(), envJson));
    envData = JSON.parse(fs.readFileSync(path.resolve(envJson), "utf-8"));
  } else {
    if (!envDataInit) {
      console.log(chalk.red(`envData 与 envJson 不能同时为空`));
      return process.exit(1);
    }
    console.log(
      chalk.green(`envJson 为空，将使用 ${envDataInit} 作为环境变量`),
    );
    try {
      envData = JSON.parse(envDataInit);
    } catch (error: any) {
      console.log(chalk.red(`envData 格式错误:${error.message}，请检查`));
      return process.exit(1);
    }
  }

  const inputContent = fs.readFileSync(path.resolve(input), "utf-8");
  const compiled = _template(inputContent);
  const outputContent = compiled(envData);
  fs.writeFileSync(path.resolve(output), outputContent);
  console.log(chalk.green(`模板文件 ${input} 已渲染到 ${output}`));

  return outputContent;
};
