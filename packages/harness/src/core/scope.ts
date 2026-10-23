import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listSubdirs } from "./fs-entries";

/**
 * 仓库注册表（`~/.done-coding/harness/scope/`）：记录各仓是谁、受理什么、收件箱在哪，
 * 供跨仓提 issue 时按名寻址。格式说明见注册表根 `README.md`。
 *
 * 布局：一仓一目录、平铺一层；目录名 = 转义键（仓根绝对路径的非字母数字字符替换为 `-`，
 * 与 `~/.claude/projects/` 同规则）。转义不可逆 ⇒ 寻址一律读 `repo.json.path`，[MUST NOT] 由键反推。
 */

/** 注册表目录覆盖（测试沙盒 / 非默认位置） */
export const SCOPE_DIR_ENV = "DC_HARNESS_SCOPE_DIR";
/** 单仓登记文件名 */
const REPO_FILE = "repo.json";

/** 注册表目录：环境变量优先，缺省 `~/.done-coding/harness/scope` */
export const getScopeDir = (): string =>
  process.env[SCOPE_DIR_ENV] ??
  path.join(os.homedir(), ".done-coding", "harness", "scope");

/** 仓的治理信息；未建治理目录为 null */
export interface RepoGovernance {
  /** 治理目录（相对仓根） */
  dir: string;
  /** 裁剪档位 */
  tier: string | null;
  /** issue 收件箱（相对仓根）；null = 不接收 issue */
  issueInbox: string | null;
}

/** 单仓登记（`<键>/repo.json`） */
export interface RepoEntry {
  name: string;
  /** 仓根绝对路径（寻址唯一依据） */
  path: string;
  positioning: string;
  /** 受理范围；null = 不接收 */
  accepts: string | null;
  governance: RepoGovernance | null;
}

/** 已读取的登记项（附所在目录名） */
export interface ScopeRecord {
  key: string;
  entry: RepoEntry;
}

/** 转义键：非字母数字字符替换为 `-` */
export const toScopeKey = (repoRoot: string): string =>
  repoRoot.replace(/[^a-zA-Z0-9]/g, "-");

/** 读全部登记（目录名升序）；无 repo.json 的目录跳过，JSON 非法 → throw */
export const readScope = (scopeDir = getScopeDir()): ScopeRecord[] =>
  listSubdirs(scopeDir).flatMap((key) => {
    const file = path.join(scopeDir, key, REPO_FILE);
    if (!fs.existsSync(file)) return [];
    try {
      return [{ key, entry: JSON.parse(fs.readFileSync(file, "utf-8")) }];
    } catch (err) {
      throw new Error(`注册表登记 JSON 非法：${file}（${String(err)}）`);
    }
  });

/** 校验单条登记，返回违规描述（空 = 通过） */
const checkRecord = ({ key, entry }: ScopeRecord): string[] => {
  const where = `${key}/${REPO_FILE}`;
  const errors: string[] = [];
  if (typeof entry.name !== "string" || !entry.name) {
    errors.push(`${where}：缺 name`);
  }
  if (typeof entry.path !== "string" || !path.isAbsolute(entry.path)) {
    errors.push(`${where}：path 须为绝对路径`);
    return errors;
  }
  if (toScopeKey(entry.path) !== key) {
    errors.push(
      `${where}：目录名与 path 的转义键不符（仓搬家后旧目录未删？应为 ${toScopeKey(entry.path)}）`,
    );
  }
  if (!fs.existsSync(entry.path)) {
    errors.push(`${where}：path 不存在 ${entry.path}`);
    return errors;
  }
  const inbox = entry.governance?.issueInbox;
  if (inbox && !fs.existsSync(path.join(entry.path, inbox))) {
    errors.push(
      `${where}：issueInbox 目录不存在 ${path.join(entry.path, inbox)}`,
    );
  }
  return errors;
};

/** 校验整个注册表：逐条字段 / 路径 / 键 / 收件箱 + name 唯一 */
export const checkScope = (scopeDir = getScopeDir()): string[] => {
  const records = readScope(scopeDir);
  const errors = records.flatMap(checkRecord);
  const seen = new Map<string, string>();
  for (const { key, entry } of records) {
    const prev = seen.get(entry.name);
    if (prev) errors.push(`name「${entry.name}」重复：${prev} 与 ${key}`);
    else seen.set(entry.name, key);
  }
  return errors;
};

/** 按 name 查登记；查不到 → throw 并列出全部可选名 */
export const findRepo = (name: string, scopeDir = getScopeDir()): RepoEntry => {
  const records = readScope(scopeDir);
  const hit = records.find((r) => r.entry.name === name);
  if (!hit) {
    const names = records.map((r) => r.entry.name).join(" / ") || "（空）";
    throw new Error(`注册表中无仓「${name}」；已登记：${names}`);
  }
  return hit.entry;
};

/**
 * 解析 issue 目标：已存在的目录按路径用；否则按注册表 name 寻址，
 * 目标未开收件箱（issueInbox 为 null）→ throw。
 */
export const resolveIssueTarget = (
  target: string,
  cwd: string,
  scopeDir = getScopeDir(),
): string => {
  const asPath = path.resolve(cwd, target);
  if (fs.existsSync(asPath) && fs.statSync(asPath).isDirectory()) return asPath;
  const entry = findRepo(target, scopeDir);
  if (!entry.governance?.issueInbox) {
    throw new Error(`仓「${entry.name}」不接收 issue（issueInbox 为 null）`);
  }
  return entry.path;
};

/** register 入参：未给的字段沿用已有登记，新登记缺省见各字段 */
export interface RegisterParams {
  /** 仓根绝对路径 */
  repoRoot: string;
  /** 缺省仓根目录名 */
  name?: string;
  positioning?: string;
  accepts?: string;
  /** 缺省 null */
  tier?: string;
  /** 治理目录绝对路径；不存在则 governance 记 null */
  governanceRoot?: string;
}

/**
 * 登记 / 更新当前仓：键目录已存在但其 path ≠ 本仓 → 撞键，throw 不覆盖。
 * governance 由治理目录现状推出（有 issue/ 即收件箱）。返回写入的登记。
 */
export const registerRepo = (
  params: RegisterParams,
  scopeDir = getScopeDir(),
): RepoEntry => {
  const { repoRoot, governanceRoot } = params;
  const key = toScopeKey(repoRoot);
  const file = path.join(scopeDir, key, REPO_FILE);
  const prev: Partial<RepoEntry> = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf-8"))
    : {};
  if (prev.path && prev.path !== repoRoot) {
    throw new Error(
      `撞键：${key} 已登记 ${prev.path}，与 ${repoRoot} 冲突，未覆盖`,
    );
  }
  const governance: RepoGovernance | null = governanceRoot
    ? {
        dir: path.relative(repoRoot, governanceRoot),
        tier: params.tier ?? prev.governance?.tier ?? null,
        issueInbox: fs.existsSync(path.join(governanceRoot, "issue"))
          ? path.relative(repoRoot, path.join(governanceRoot, "issue"))
          : null,
      }
    : null;
  const entry: RepoEntry = {
    name: params.name ?? prev.name ?? path.basename(repoRoot),
    path: repoRoot,
    positioning: params.positioning ?? prev.positioning ?? "",
    accepts: params.accepts ?? prev.accepts ?? null,
    governance,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, "utf-8");
  return entry;
};
