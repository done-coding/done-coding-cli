import {
  execSyncHijack,
  outputConsole,
  safeRemoveDirSync,
} from "@done-coding/cli-utils";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { resolve } from "node:path";
import { CreateTemplateSourceTypeEnum } from "@/types";

const TEMPLATE_SOURCE_WORK_DIR = "done-coding-create-template-source";

const TEMPLATE_COPY_IGNORE_SET = new Set([
  ".git",
  "node_modules",
  "dist",
  "es",
  "lib",
  "types",
  "release",
  "coverage",
]);

/** 转义 shell 参数，避免路径或分支名中的特殊字符破坏命令 */
const quoteShellArg = (value: string) => {
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

/** 模板来源解析参数 */
export interface ResolveTemplateSourceOptions {
  /** 模板地址，远程 git 地址或本地绝对路径 */
  templateUrl: string;
  /** 模板仓库分支 */
  templateBranch?: string;
  /** 仓库内模板目录 */
  directory?: string;
}

/** 模板来源信息 */
export interface TemplateSourceInfo {
  /** 模板来源类型 */
  type: CreateTemplateSourceTypeEnum;
  /** 模板地址，远程 git 地址或本地绝对路径 */
  url: string;
  /** 模板仓库分支 */
  branch?: string;
  /** 仓库内模板目录 */
  directory?: string;
}

/** 模板实例生成参数 */
export interface MaterializeTemplateOptions {
  /** 模板来源信息 */
  templateSource: TemplateSourceInfo;
  /** 项目生成目标目录 */
  targetPath: string;
  /** 远程 git 克隆时使用的工作目录 */
  rootDir: string;
}

/** 模板实例生成结果 */
export interface TemplateInstanceInfo {
  /** 模板来源类型 */
  type: CreateTemplateSourceTypeEnum;
  /** 模板地址，远程 git 地址或本地绝对路径 */
  url: string;
  /** 模板仓库分支 */
  branch?: string;
  /** 仓库内模板目录 */
  directory?: string;
  /** 项目生成目标目录 */
  targetPath: string;
}

/** 本地模板 worktree 清理参数 */
interface CleanupLocalTemplateWorktreeOptions {
  /** 本地 git 仓库根目录 */
  repoRoot: string;
  /** 临时 worktree 目录 */
  worktreeDir: string;
  /** 临时 worktree 分支名 */
  worktreeBranch: string;
}

/** 模板复制源目录解析参数 */
interface TemplateSourceRootOptions {
  /** 临时仓库目录 */
  tempRepoDir: string;
  /** 临时仓库内的来源相对路径 */
  sourceRelativePath?: string;
  /** 仓库内模板目录 */
  directory?: string;
}

/** 模板目录复制参数 */
interface CopyTemplateSourceRootOptions {
  /** 模板复制源目录 */
  sourceRoot: string;
  /** 项目生成目标目录 */
  targetPath: string;
}

/** 判断模板地址是否为远程 git 地址 */
export const isRemoteGitTemplateUrl = (templateUrl: string) => {
  return (
    templateUrl.startsWith("http://") ||
    templateUrl.startsWith("https://") ||
    templateUrl.startsWith("git@") ||
    templateUrl.startsWith("git://") ||
    templateUrl.startsWith("ssh://")
  );
};

/** 解析模板地址为统一的模板来源信息 */
export const resolveTemplateSourceFromUrl = ({
  templateUrl,
  templateBranch,
  directory,
}: ResolveTemplateSourceOptions): TemplateSourceInfo => {
  if (directory && path.isAbsolute(directory)) {
    throw new Error(`模板目录 ${directory} 不合法，请传入仓库内相对路径`);
  }

  if (isRemoteGitTemplateUrl(templateUrl)) {
    return {
      type: CreateTemplateSourceTypeEnum.GIT,
      url: templateUrl,
      branch: templateBranch,
      directory,
    };
  }

  if (templateUrl.startsWith("/")) {
    return {
      type: CreateTemplateSourceTypeEnum.LOCAL,
      url: templateUrl,
      branch: templateBranch,
      directory,
    };
  }

  throw new Error(
    `模板地址 ${templateUrl} 不合法，请传入 http(s)/git/ssh 远程仓库地址或 / 开头的本地绝对路径`,
  );
};

/** 获取指定目录所在的 git 仓库根目录 */
const getGitRepoRoot = (currentDir: string) => {
  try {
    return execSyncHijack(`git rev-parse --show-toplevel`, {
      cwd: currentDir,
      stdio: "pipe",
    })
      ?.toString()
      .trim();
  } catch (error) {
    return;
  }
};

/** 清理本地模板生成时创建的临时 worktree 和临时分支 */
const cleanupLocalTemplateWorktree = ({
  repoRoot,
  worktreeDir,
  worktreeBranch,
}: CleanupLocalTemplateWorktreeOptions) => {
  try {
    execSyncHijack(
      `git worktree remove --force ${quoteShellArg(worktreeDir)}`,
      {
        cwd: repoRoot,
        stdio: "ignore",
      },
    );
  } catch (error) {
    // remove 失败（worktree 被锁 / 目录已被外部删除 / 上轮崩在 add 与 remove 之间）：
    // 兜底删目录 + prune 清 stale 元数据，避免在用户模板仓累积 .git/worktrees 残骸
    outputConsole.warn(`临时worktree清理失败，尝试兜底: ${worktreeDir}`);
    try {
      safeRemoveDirSync({
        targetPath: worktreeDir,
        parentDir: path.dirname(worktreeDir),
        label: "临时worktree目录",
      });
    } catch (rmError) {
      outputConsole.warn(`临时worktree目录删除失败: ${worktreeDir}`);
    }
    try {
      execSyncHijack(`git worktree prune`, {
        cwd: repoRoot,
        stdio: "ignore",
      });
    } catch (pruneError) {
      outputConsole.warn(`git worktree prune 失败: ${repoRoot}`);
    }
  }
  try {
    execSyncHijack(`git branch -D ${quoteShellArg(worktreeBranch)}`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch (error) {
    outputConsole.warn(`临时worktree分支清理失败: ${worktreeBranch}`);
  }
};

/** 解析临时仓库中的模板复制源目录 */
const getTemplateSourceRoot = ({
  tempRepoDir,
  sourceRelativePath,
  directory,
}: TemplateSourceRootOptions) => {
  return path.resolve(tempRepoDir, sourceRelativePath ?? "", directory ?? "");
};

/** 将模板复制源目录复制到项目目标目录 */
const copyTemplateSourceRoot = ({
  sourceRoot,
  targetPath,
}: CopyTemplateSourceRootOptions) => {
  if (!existsSync(sourceRoot)) {
    throw new Error(`模板目录不存在: ${sourceRoot}`);
  }
  if (!statSync(sourceRoot).isDirectory()) {
    throw new Error(`模板路径不是目录: ${sourceRoot}`);
  }
  cpSync(sourceRoot, targetPath, {
    recursive: true,
    filter(source) {
      return !TEMPLATE_COPY_IGNORE_SET.has(path.basename(source));
    },
  });
};

/** 通过远程 git clone 生成临时模板仓库并复制模板目录 */
const materializeRemoteGitTemplate = ({
  templateSource,
  targetPath,
  rootDir,
}: MaterializeTemplateOptions) => {
  const tempRepoDir = path.resolve(
    tmpdir(),
    TEMPLATE_SOURCE_WORK_DIR,
    randomUUID(),
  );
  mkdirSync(path.dirname(tempRepoDir), { recursive: true });
  try {
    execSyncHijack(
      `git clone${
        templateSource.branch
          ? ` -b ${quoteShellArg(templateSource.branch)}`
          : ""
      } ${quoteShellArg(templateSource.url)} ${quoteShellArg(tempRepoDir)} --depth=1`,
      { cwd: rootDir, stdio: "inherit" },
    );
    copyTemplateSourceRoot({
      sourceRoot: getTemplateSourceRoot({
        tempRepoDir,
        directory: templateSource.directory,
      }),
      targetPath,
    });
  } finally {
    try {
      safeRemoveDirSync({
        targetPath: tempRepoDir,
        parentDir: path.dirname(tempRepoDir),
        label: "临时模板仓库目录",
      });
    } catch (rmError) {
      outputConsole.warn(`临时模板仓库目录删除失败: ${tempRepoDir}`);
    }
  }
};

/** 通过本地 git worktree 生成临时模板仓库并复制模板目录 */
const materializeLocalGitTemplate = ({
  templateSource,
  targetPath,
}: MaterializeTemplateOptions) => {
  const templatePathResolve = resolve(templateSource.url);
  if (!existsSync(templatePathResolve)) {
    throw new Error(`本地模板仓库不存在: ${templatePathResolve}`);
  }
  const templatePathFinal = realpathSync(templatePathResolve);
  if (!statSync(templatePathFinal).isDirectory()) {
    throw new Error(`本地模板仓库路径不是目录: ${templatePathFinal}`);
  }

  const repoRootInit = getGitRepoRoot(templatePathFinal);
  const repoRoot = repoRootInit ? realpathSync(repoRootInit) : undefined;
  if (!repoRoot) {
    throw new Error(
      `本地模板地址必须是git仓库或属于某个git仓库: ${templatePathFinal}`,
    );
  }
  if (repoRoot !== templatePathFinal) {
    throw new Error(
      `本地模板地址必须是git仓库根路径: ${templatePathFinal}，仓库内模板目录请使用 directory 配置`,
    );
  }

  const tempRepoDir = path.resolve(
    tmpdir(),
    TEMPLATE_SOURCE_WORK_DIR,
    randomUUID(),
  );
  const worktreeBranch = `done-coding-template-${randomUUID()}`;
  const worktreeBaseRef = templateSource.branch ?? "HEAD";
  mkdirSync(path.dirname(tempRepoDir), { recursive: true });
  execSyncHijack(
    `git worktree add -b ${quoteShellArg(worktreeBranch)} ${quoteShellArg(tempRepoDir)} ${quoteShellArg(worktreeBaseRef)}`,
    {
      cwd: repoRoot,
      stdio: "ignore",
    },
  );

  try {
    copyTemplateSourceRoot({
      sourceRoot: getTemplateSourceRoot({
        tempRepoDir,
        directory: templateSource.directory,
      }),
      targetPath,
    });
  } finally {
    cleanupLocalTemplateWorktree({
      repoRoot,
      worktreeDir: tempRepoDir,
      worktreeBranch,
    });
  }
};

/** 将模板来源生成到项目目标目录 */
export const materializeTemplateToProject = (
  options: MaterializeTemplateOptions,
): TemplateInstanceInfo => {
  if (options.templateSource.type === CreateTemplateSourceTypeEnum.LOCAL) {
    materializeLocalGitTemplate(options);
  } else {
    materializeRemoteGitTemplate(options);
  }

  return {
    type: options.templateSource.type,
    url: options.templateSource.url,
    branch: options.templateSource.branch,
    directory: options.templateSource.directory,
    targetPath: options.targetPath,
  };
};
