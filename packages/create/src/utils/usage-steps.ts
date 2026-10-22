/**
 * 创建完成后的「使用步骤」提示。
 * ---
 * 模板可在 `.done-coding/template.json` 声明 `usageSteps: string[]` 覆盖默认步骤
 * （Go / Python 模板、monorepo 成员各有自己的启动方式）；缺省回落 `pnpm install` / `pnpm run dev`。
 * 首步 `cd <项目名>` 由 create 固定补上。
 * [MUST] 在模板配置被编译删除之前读取。
 */
import { outputConsole, readConfigFile } from "@done-coding/cli-utils";
import {
  getConfigPath,
  type CompileTemplateConfig,
} from "@done-coding/cli-template";

/** 模板未声明 usageSteps 时的默认步骤 */
export const DEFAULT_USAGE_STEPS = ["pnpm install", "pnpm run dev"];

interface UsageStepsTemplateConfig extends CompileTemplateConfig {
  usageSteps?: unknown;
}

/** 读模板声明的使用步骤；无配置 / 未声明 → 默认；声明非法 → throw */
export const readTemplateUsageSteps = async ({
  rootDir,
  configPath,
}: {
  rootDir: string;
  configPath: string;
}): Promise<string[]> => {
  if (!getConfigPath({ rootDir, configPath })) return DEFAULT_USAGE_STEPS;
  const config = await readConfigFile<UsageStepsTemplateConfig>({
    rootDir,
    configPath,
  });
  const steps = config?.usageSteps;
  if (steps === undefined) return DEFAULT_USAGE_STEPS;
  const valid =
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every((s) => typeof s === "string" && s.trim() !== "");
  if (!valid) {
    throw new Error(`模板配置 usageSteps 须为非空字符串数组：${configPath}`);
  }
  return steps as string[];
};

/** 完整步骤 = `cd <项目名>` + 模板步骤 */
export const buildUsageSteps = (projectName: string, steps: string[]) => [
  `cd ${projectName}`,
  ...steps,
];

/** 输出使用步骤提示 */
export const printUsageSteps = (steps: string[]) => {
  outputConsole.info(`
使用步骤:
${steps.map((step, i) => `  ${i + 1}. ${step}`).join("\n")}
  `);
};
