/**
 * create templateList 最小同步器（Wave C2，design §7.4 / §14 D-H4）。
 *
 * 仅当 recipe.createTemplate 存在时：读目标 create config json（configPath 相对 cwd）→
 * 按 name upsert templateList 项 { name, url=本地仓根, directory=recipe.output, description } →
 * 写回（保留既有其它项，幂等不重复追加）。
 *
 * 边界（D-H4）：[MUST NOT] 改 create 源码 / handler / 用户面 UX；只写 create config 数据文件。
 * url = 本地仓根（output 所在 git 仓 toplevel；非 git 仓回退 cwd）；directory = recipe.output。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Recipe } from "./types";

/** create config 中单个模板项（对齐 packages/create CreateTemplateChoiceItem 子集）。 */
interface TemplateListItem {
  name: string;
  url?: string;
  directory?: string;
  description?: string;
  [k: string]: unknown;
}

interface CreateConfigShape {
  templateList?: TemplateListItem[];
  [k: string]: unknown;
}

export interface SyncResult {
  /** 是否执行了同步（recipe 无 createTemplate → false） */
  synced: boolean;
  /** 同步后的 config 路径（绝对） */
  configPath?: string;
  /** upsert 的项名 */
  name?: string;
  /** 是否为新增（false=更新既有） */
  inserted?: boolean;
}

/** 解析本地仓根（output 所在 git 仓 toplevel；非 git 仓回退 cwd 绝对路径）。 */
const resolveLocalRepoRoot = (cwd: string): string => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return path.resolve(cwd);
  }
};

/** 读 create config json（不存在 → {}；非法 JSON → throw fail-loud）。 */
const readConfig = (absPath: string): CreateConfigShape => {
  if (!fs.existsSync(absPath)) return {};
  const text = fs.readFileSync(absPath, "utf-8");
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text) as CreateConfigShape;
  } catch (err) {
    throw new Error(
      `create config 解析失败（仅支持标准 JSON）：${absPath}\n  ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
};

/** 探测既有文件缩进风格（首个缩进行；默认 2 空格）。 */
const detectIndent = (absPath: string): number => {
  if (!fs.existsSync(absPath)) return 2;
  const m = fs.readFileSync(absPath, "utf-8").match(/\n([ \t]+)\S/);
  if (!m) return 2;
  return m[1].includes("\t") ? 2 : m[1].length;
};

/**
 * 同步：把 recipe 产物 upsert 进 create config 的 templateList。
 * recipe 无 createTemplate → 直接返回 {synced:false}（不触达任何文件）。
 */
export const syncCreateTemplate = (cwd: string, recipe: Recipe): SyncResult => {
  const decl = recipe.createTemplate;
  if (!decl) return { synced: false };

  const absConfig = path.resolve(cwd, decl.configPath);
  const config = readConfig(absConfig);
  const list: TemplateListItem[] = Array.isArray(config.templateList)
    ? config.templateList
    : [];

  const item: TemplateListItem = {
    name: decl.name,
    url: resolveLocalRepoRoot(cwd),
    directory: recipe.output,
    ...(decl.description ? { description: decl.description } : {}),
  };

  const idx = list.findIndex((it) => it.name === decl.name);
  const inserted = idx < 0;
  if (inserted) {
    list.push(item);
  } else {
    // 保留既有其它字段（如 branch/instances），仅覆盖 url/directory/description
    list[idx] = { ...list[idx], ...item };
  }

  const next: CreateConfigShape = { ...config, templateList: list };
  const indent = detectIndent(absConfig);
  fs.mkdirSync(path.dirname(absConfig), { recursive: true });
  fs.writeFileSync(
    absConfig,
    JSON.stringify(next, null, indent) + "\n",
    "utf-8",
  );

  return { synced: true, configPath: absConfig, name: decl.name, inserted };
};
