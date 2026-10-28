import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolveGovernance } from "./config";
import { listDirSorted, listSubdirs } from "./fs-entries";
import { GovernanceDirEnum, ListFileEnum, renderLists } from "./lists";

/** 条目 id 字符集（base36 小写） */
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** 条目 id 长度 */
const ID_LENGTH = 6;
/** slug 合法形态：小写字母数字，`-` 连接 */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();

/** 治理目录下已占用的 id（所有条目 / 批次目录名的前缀） */
const usedIds = (root: string): Set<string> => {
  const names = [
    GovernanceDirEnum.ISSUE,
    GovernanceDirEnum.BACKLOG,
    GovernanceDirEnum.DROPPED,
  ].flatMap((d) => listDirSorted(path.join(root, d)));
  for (const d of [GovernanceDirEnum.SCHEDULE, GovernanceDirEnum.ARCHIVE]) {
    for (const batch of listSubdirs(path.join(root, d))) {
      names.push(batch, ...listDirSorted(path.join(root, d, batch)));
    }
  }
  return new Set(names.map((n) => n.split("-")[0]));
};

/** 生成治理目录内不重复的 6 位 base36 随机 id */
export const generateId = (root: string): string => {
  const used = usedIds(root);
  for (;;) {
    const id = Array.from(
      { length: ID_LENGTH },
      () => ID_ALPHABET[randomInt(ID_ALPHABET.length)],
    ).join("");
    if (!used.has(id)) return id;
  }
};

/** 本地日期 YYYY-MM-DD */
const today = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 跨仓提 issue 的入参 */
export interface FileIssueParams {
  /** 目标仓根目录（绝对路径） */
  targetRoot: string;
  /** 来源仓名 */
  from: string;
  /** 标题（单行） */
  title: string;
  /** 语义 slug */
  slug: string;
  /** 正文（现象 + 复现） */
  body: string;
}

/** 提单结果 */
export interface FileIssueResult {
  id: string;
  /** 写入的 issue 文件绝对路径 */
  file: string;
  /** 目标仓提交 sha（短） */
  sha: string;
  /** 标题与正文中替换的本机家目录路径总数 */
  homeReplacements: number;
}

/**
 * 向另一个仓的治理收件箱提 issue：生成 id → 写 issue 文件 → 按目标仓生成器重生 `ISSUE.md`
 * → 在目标仓**只提交这两个文件**（显式 pathspec，不卷入目标仓其它在途改动）。
 */
export const fileIssue = (
  params: FileIssueParams,
  home = os.homedir(),
): FileIssueResult => {
  const { targetRoot, from, slug } = params;
  let homeReplacements = 0;
  const replaceHome = (text: string): string => {
    if (!home) return text;
    return text
      .split(home)
      .map((part, index) => {
        if (index === 0) return part;
        if (part === "" || part.startsWith("/")) {
          homeReplacements++;
          return `~${part}`;
        }
        return home + part;
      })
      .join("");
  };
  const title = replaceHome(params.title).trim();
  const body = replaceHome(params.body).trim();
  if (!title || /[\r\n]/.test(title)) throw new Error("title 须为非空单行");
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`slug 须为小写字母数字、以 - 连接：${slug}`);
  }
  if (!body) throw new Error("正文为空：须写明现象与复现");

  const { root } = resolveGovernance(targetRoot);
  const issueDir = path.join(root, GovernanceDirEnum.ISSUE);
  if (!fs.existsSync(issueDir)) {
    throw new Error(`目标仓未启用 issue/ 收件箱：${issueDir}`);
  }
  const issueListFile = path.join(root, ListFileEnum.ISSUE);
  const listRel = path.relative(targetRoot, issueListFile);
  if (git(targetRoot, ["status", "--porcelain", "--", listRel])) {
    throw new Error(
      `目标仓 ${listRel} 有未提交改动，先处理再提单（避免卷入他人改动）`,
    );
  }

  const id = generateId(root);
  const file = path.join(issueDir, `${id}-${slug}.md`);
  fs.writeFileSync(
    file,
    `---\nid: ${id}\ntitle: ${title}\ncreated: ${today()}\nfrom: ${from}\n---\n\n${body}\n`,
    "utf-8",
  );
  fs.writeFileSync(
    issueListFile,
    renderLists(root).get(ListFileEnum.ISSUE)!,
    "utf-8",
  );

  const fileRel = path.relative(targetRoot, file);
  git(targetRoot, ["add", "--", fileRel, listRel]);
  git(targetRoot, [
    "commit",
    "-m",
    `docs(governance): 收件 issue ${id}（from ${from}）`,
    "--",
    fileRel,
    listRel,
  ]);
  return {
    id,
    file,
    sha: git(targetRoot, ["rev-parse", "--short", "HEAD"]),
    homeReplacements,
  };
};

/** 取某目录所属 git 仓的根目录名（作来源仓名） */
export const getRepoName = (cwd: string): string =>
  path.basename(git(cwd, ["rev-parse", "--show-toplevel"]));
