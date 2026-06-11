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

/** 本机指针配置文件绝对路径 */
export const getLocalPointerConfigPath = () => {
  return path.resolve(homedir(), LOCAL_POINTER_CONFIG_RELATIVE_PATH);
};

/** 本机指针配置文件结构 */
export interface CreateLocalPointerConfig {
  /** 指向真正模板配置文件的【本地】路径 */
  configPath?: string;
}

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
