import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { outputConsole } from "@done-coding/cli-utils";

/**
 * `dc create` 中央本机实例注册表。
 * ---
 * 落 `~/.done-coding/create/instances.json`（复用 create 已有的 home 目录），
 * 回答「本机有哪些项目基于模板创建」而无需挨个扫项目（免扫描的关键 = 中央清单）。
 *
 * 设计要点：
 *  - upsert by `path`：同路径重建覆盖该条、不堆重复。
 *  - 原子写：temp 文件 + rename（与 create.ts 既有 renameSync 范式一致，零新依赖）。
 *  - record 为 best-effort 副作用：失败仅告警、[MUST NOT] 中断已成功的创建主流程。
 *  - `baseDir` 注入点：默认 homedir()，测试传 tmpdir → 不碰真实 ~/.done-coding。
 *  - R6：仅记 path / 模板标识 / 版本 / 时间，无业务敏感信息。
 */

/** 注册表内一条实例记录 */
export interface CreateInstanceRecord {
  /** 项目绝对路径（upsert 键） */
  path: string;
  /** 模板标识：模板名优先，无名时回落模板 url */
  template: string;
  /** 模板版本（best-effort，当前无来源则省略） */
  templateVersion?: string;
  /** 模板 url */
  templateUrl?: string;
  /** 模板分支 */
  templateBranch?: string;
  /** 创建时间（ISO 8601） */
  createdAt: string;
}

/** 注册表文件结构 */
export interface CreateInstancesRegistry {
  instances: CreateInstanceRecord[];
}

/** record 入参：createdAt 可省略，缺省即当前时间 */
export type RecordCreateInstanceInput = Omit<
  CreateInstanceRecord,
  "createdAt"
> & {
  createdAt?: string;
};

const REGISTRY_RELATIVE_PATH = ".done-coding/create/instances.json";

/**
 * 解析注册表根目录。
 * 优先级：显式 baseDir（单测注入）> 环境变量 `DC_CREATE_INSTANCES_BASE_DIR`（e2e / 子进程沙盒重定向）> homedir()。
 * 环境变量为测试隔离 seam——避免 e2e 真跑 create 时污染真实 ~/.done-coding（项目测试沙盒约束）。
 */
const resolveBaseDir = (baseDir?: string): string => {
  return baseDir ?? process.env.DC_CREATE_INSTANCES_BASE_DIR ?? homedir();
};

/** 注册表绝对路径（baseDir 默认 home，测试可注入沙盒目录） */
export const getRegistryPath = (baseDir?: string): string => {
  return path.resolve(resolveBaseDir(baseDir), REGISTRY_RELATIVE_PATH);
};

/**
 * 读取注册表。
 * ---
 * 不存在 / 解析失败 / 结构非法 → 回落 `{ instances: [] }`，绝不抛错。
 */
export const readRegistry = (baseDir?: string): CreateInstancesRegistry => {
  const registryPath = getRegistryPath(baseDir);
  try {
    if (!existsSync(registryPath)) {
      return { instances: [] };
    }
    const parsed = JSON.parse(
      readFileSync(registryPath, "utf-8"),
    ) as Partial<CreateInstancesRegistry>;
    if (!parsed || !Array.isArray(parsed.instances)) {
      return { instances: [] };
    }
    return { instances: parsed.instances };
  } catch (error) {
    outputConsole.warn(`实例注册表读取失败，已忽略: ${registryPath}`);
    return { instances: [] };
  }
};

/** 原子写注册表：temp 文件 + rename（同目录同分区，保证原子） */
const writeRegistryAtomic = (
  registry: CreateInstancesRegistry,
  baseDir?: string,
): void => {
  const registryPath = getRegistryPath(baseDir);
  mkdirSync(path.dirname(registryPath), { recursive: true });
  const tmpPath = `${registryPath}.tmp-${process.pid}`;
  writeFileSync(tmpPath, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(tmpPath, registryPath);
};

/** 构造存储记录：仅落已定义字段，避免写出 undefined 键（R6 字段封闭） */
const buildRecord = (
  input: RecordCreateInstanceInput,
): CreateInstanceRecord => {
  const record: CreateInstanceRecord = {
    path: input.path,
    template: input.template,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  if (input.templateVersion !== undefined) {
    record.templateVersion = input.templateVersion;
  }
  if (input.templateUrl !== undefined) {
    record.templateUrl = input.templateUrl;
  }
  if (input.templateBranch !== undefined) {
    record.templateBranch = input.templateBranch;
  }
  return record;
};

/**
 * 向注册表 upsert 一条实例记录（best-effort）。
 * ---
 * 同 `path` 覆盖该条（不堆重复）；原子写。
 * 整体 try/catch 吞错：留痕是创建成功后的副作用，[MUST NOT] 因 IO/权限失败回滚或中断主流程。
 */
export const recordCreateInstance = (
  input: RecordCreateInstanceInput,
  baseDir?: string,
): void => {
  try {
    const registry = readRegistry(baseDir);
    const next = registry.instances.filter((item) => item.path !== input.path);
    next.push(buildRecord(input));
    writeRegistryAtomic({ instances: next }, baseDir);
  } catch (error) {
    outputConsole.warn(
      `实例留痕写入失败，已忽略（不影响项目创建）: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/** 列出全部实例，附 `missing`（path 已不存在） */
export const listInstances = (
  baseDir?: string,
): (CreateInstanceRecord & { missing: boolean })[] => {
  return readRegistry(baseDir).instances.map((item) => ({
    ...item,
    missing: !existsSync(item.path),
  }));
};

/** 清理 path 已不存在的条目，返回移除 / 保留计数（仅改注册表，不删项目文件） */
export const pruneInstances = (
  baseDir?: string,
): { removed: number; kept: number } => {
  const registry = readRegistry(baseDir);
  const kept = registry.instances.filter((item) => existsSync(item.path));
  const removed = registry.instances.length - kept.length;
  if (removed > 0) {
    writeRegistryAtomic({ instances: kept }, baseDir);
  }
  return { removed, kept: kept.length };
};
