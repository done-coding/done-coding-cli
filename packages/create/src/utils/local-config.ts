import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  assetIsExitsAsync,
  outputConsole,
  readJsonFileAsync,
} from "@done-coding/cli-utils";
import type { CreateConfigJson, CreateTemplateChoiceItem } from "@/types";

/**
 * 本机【指针】配置文件相对 home 的路径。
 * ---
 * 该文件内容是一个【指针】：`{ "configPath": "/abs/真正的配置文件.json" }`，
 * 指向真正的模板配置文件（`{ templateList: [...] }` = CreateConfigJson）。
 * 不做多文件合并——用户若需合并，自行维护一份合并好的配置文件并在此指向它。
 */
export const LOCAL_POINTER_CONFIG_RELATIVE_PATH =
  ".done-coding/create/index.json";

/** 本机指针配置文件绝对路径（`baseDir` 默认家目录，测试可注入临时目录） */
export const getLocalPointerConfigPath = (baseDir = homedir()) => {
  return path.resolve(baseDir, LOCAL_POINTER_CONFIG_RELATIVE_PATH);
};

/** 本机指针配置文件结构 */
export interface CreateLocalPointerConfig {
  /** 指向真正模板配置文件的【本地】路径 */
  configPath?: string;
}

/** 读指针文件为对象（不存在 / 解析失败 → 空对象），保留未知字段以便原样写回 */
const readPointerObject = async (
  pointerPath: string,
): Promise<Record<string, unknown> & CreateLocalPointerConfig> => {
  try {
    const parsed = JSON.parse(await readFile(pointerPath, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

/** 原子写指针文件：temp 文件 + rename（同目录同分区） */
const writePointerObject = async (
  pointerPath: string,
  pointer: Record<string, unknown>,
) => {
  await mkdir(path.dirname(pointerPath), { recursive: true });
  const tmpPath = `${pointerPath}.tmp-${process.pid}`;
  await writeFile(tmpPath, `${JSON.stringify(pointer, null, 2)}\n`);
  await rename(tmpPath, pointerPath);
};

/** 校验模板清单文件：存在、是 JSON、`templateList` 为数组；返回模板数，不合格抛错 */
const inspectTemplateConfigFile = async (configPath: string) => {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    throw new Error(`模板清单文件不存在或不可读: ${configPath}`);
  }
  let config: Partial<CreateConfigJson>;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`模板清单文件不是合法 JSON: ${configPath}`);
  }
  if (!Array.isArray(config?.templateList)) {
    throw new Error(`模板清单文件的 templateList 不是数组: ${configPath}`);
  }
  return config.templateList.length;
};

/** 指针现状：指向哪份清单、该清单是否可用 */
export interface TemplateConfigPointerInfo {
  /** 指针文件绝对路径 */
  pointerPath: string;
  /** 当前指向的模板清单（未配置为 undefined） */
  configPath?: string;
  /** 指向的清单是否可用（未配置时为 undefined） */
  valid?: boolean;
  /** 可用时的模板数 */
  templateCount?: number;
  /** 不可用原因 */
  reason?: string;
}

/** 读取模板清单指针现状 */
export const readTemplateConfigPointer = async ({
  baseDir,
}: { baseDir?: string } = {}): Promise<TemplateConfigPointerInfo> => {
  const pointerPath = getLocalPointerConfigPath(baseDir);
  const { configPath } = await readPointerObject(pointerPath);
  if (!configPath) return { pointerPath };
  try {
    const templateCount = await inspectTemplateConfigFile(configPath);
    return { pointerPath, configPath, valid: true, templateCount };
  } catch (error) {
    return {
      pointerPath,
      configPath,
      valid: false,
      reason: (error as Error).message,
    };
  }
};

/**
 * 设置模板清单指针：`inputPath` 按 `cwd` 解析为绝对路径，校验通过才写入（不合格抛错、不动旧指针）。
 * ---
 * 只有一个指向（不做多清单合并）；指针文件其它字段原样保留。
 */
export const setTemplateConfigPointer = async (
  inputPath: string,
  { cwd, baseDir }: { cwd: string; baseDir?: string },
) => {
  const configPath = path.resolve(cwd, inputPath);
  const templateCount = await inspectTemplateConfigFile(configPath);
  const pointerPath = getLocalPointerConfigPath(baseDir);
  const pointer = await readPointerObject(pointerPath);
  await writePointerObject(pointerPath, { ...pointer, configPath });
  return { pointerPath, configPath, templateCount };
};

/** 清除模板清单指针（保留其它字段）；未配置时不写盘 */
export const unsetTemplateConfigPointer = async ({
  baseDir,
}: { baseDir?: string } = {}) => {
  const pointerPath = getLocalPointerConfigPath(baseDir);
  const { configPath, ...rest } = await readPointerObject(pointerPath);
  if (configPath === undefined) return { pointerPath, removed: false };
  await writePointerObject(pointerPath, rest);
  return { pointerPath, removed: true };
};

/**
 * 解析"模板配置文件路径"。
 * ---
 * 优先级：显式传入(CLI `--template-config` / MCP `configPath`) > home 指针文件。
 * 都没有 → 返回 undefined（由调用方回落到内置远端配置）。
 * 不依赖网络；读取失败一律忽略，不抛错阻塞。
 */
export const resolveTemplateConfigPath = async (
  explicitConfigPath?: string,
): Promise<string | undefined> => {
  if (explicitConfigPath) {
    return explicitConfigPath;
  }
  const pointerPath = getLocalPointerConfigPath();
  try {
    if (!(await assetIsExitsAsync(pointerPath))) {
      return undefined;
    }
    const pointer = await readJsonFileAsync<CreateLocalPointerConfig>(
      pointerPath,
      {},
    );
    return pointer?.configPath || undefined;
  } catch (error) {
    outputConsole.warn(`本机指针配置读取失败，已忽略: ${pointerPath}`);
    return undefined;
  }
};

/**
 * 从指定【本地】配置文件读取模板列表。
 * ---
 * 不依赖网络。文件不存在 / 非数组 / 解析失败 → 返回 `[]` 并告警，绝不抛错阻塞。
 */
export const readTemplateListFromFile = async (
  configPath: string,
): Promise<CreateTemplateChoiceItem[]> => {
  try {
    if (!(await assetIsExitsAsync(configPath))) {
      outputConsole.warn(`模板配置文件不存在，已忽略: ${configPath}`);
      return [];
    }
    const config = await readJsonFileAsync<Partial<CreateConfigJson>>(
      configPath,
      {},
    );
    const list = config?.templateList;
    if (!Array.isArray(list)) {
      outputConsole.warn(
        `模板配置文件 templateList 不是数组，已忽略: ${configPath}`,
      );
      return [];
    }
    return list;
  } catch (error) {
    outputConsole.warn(`模板配置文件读取失败，已忽略: ${configPath}`);
    return [];
  }
};

/** create-mcp「模板列表资源」读取结果的载荷结构 */
export interface CreateTemplateListResource {
  /** 固定为 "local"：本资源只读本地、不联网、不读全局/远程 */
  source: "local";
  /** 解析所用的本地配置文件绝对路径 */
  configPath: string;
  /** 模板列表（缺失/非数组/解析失败 → 空数组） */
  templateList: CreateTemplateChoiceItem[];
}

/**
 * create-mcp「模板列表资源」的纯读取逻辑。
 * ---
 * 只调 `readTemplateListFromFile`（本地、不联网、不读家目录全局指针、不读远程默认）。
 * `configPath` 缺失/为空 → 抛错（不静默联网、不回落）。供 MCP 资源回调与单测复用。
 */
export const readTemplateListResource = async (
  configPath: string,
): Promise<CreateTemplateListResource> => {
  const normalized = (configPath ?? "").trim();
  if (!normalized) {
    throw new Error("读取模板列表资源需要本地 configPath（绝对路径）");
  }
  const templateList = await readTemplateListFromFile(normalized);
  return { source: "local", configPath: normalized, templateList };
};
