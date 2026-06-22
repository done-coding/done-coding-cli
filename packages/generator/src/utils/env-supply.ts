/**
 * [T5] 非交互供答解析（--env / --envFile）。
 *
 * 复刻 create 的 resolveCliEnvData 范式（create.ts:736）：
 *  - --env：内联 JSON 字符串；--envFile：JSON 文件路径（按 cwd resolve）。
 *  - 两者均解析为 `{ key: value }` 对象；同时存在时 --env 覆盖 --envFile。
 *  - 解析失败 / 文件不存在 / 非对象 → fail-fast（带来源标注）。
 *
 * content-free：generator 不认识具体 key，仅把供答对象交给后续 env 合并 / 级联消费。
 */
import fs from "node:fs";
import path from "node:path";
import { safeCwd } from "@done-coding/cli-utils";

/** 解析一段 JSON 文本为 `{ key: value }` 对象（fail-fast，带来源标注） */
const parseEnvJsonObject = (
  raw: string,
  source: string,
): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${source} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${source} 必须为 { key: value } 对象`);
  }
  return parsed as Record<string, unknown>;
};

/**
 * 解析 --env / --envFile 非交互供答。
 * 二者都未提供 → 返回 undefined（交回交互 / 缺省路径）。
 */
export const resolveEnvSupply = (argv: {
  env?: string;
  envFile?: string;
  cwd?: string;
}): Record<string, unknown> | undefined => {
  const { env, envFile, cwd = safeCwd() } = argv;
  if (!env && !envFile) {
    return undefined;
  }
  let result: Record<string, unknown> = {};
  if (envFile) {
    const envFilePath = path.resolve(cwd, envFile);
    if (!fs.existsSync(envFilePath)) {
      throw new Error(`模板预设答案文件不存在: ${envFilePath}`);
    }
    result = {
      ...result,
      ...parseEnvJsonObject(
        fs.readFileSync(envFilePath, "utf-8"),
        `模板预设答案文件 ${envFilePath}`,
      ),
    };
  }
  if (env) {
    result = { ...result, ...parseEnvJsonObject(env, "--env") };
  }
  return result;
};
