import {
  execSyncHijack,
  outputConsole,
  pathIsInsideParentDir,
  safeRemoveDirSync,
} from "@done-coding/cli-utils";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { resolve } from "node:path";
import { CreateTemplateSourceTypeEnum } from "@/types";

const TEMPLATE_SOURCE_WORK_DIR = "done-coding-create-template-source";

/**
 * 模板拷贝时需剥离的 VCS 元数据。
 * ---
 * 两条 materialize 路径（`git clone --depth=1` / `git worktree add`）拿到的都是干净的
 * git 检出：被 gitignore 的构建产物（es/lib/types/dist/coverage）与 node_modules 本就
 * 不在追踪内、不会出现，无需再按名过滤；且按 basename 过滤会**误删任意深度的同名源码目录**
 * （如 `src/types`）。唯一需剥离的非内容物是 `.git`（clone 为目录、worktree 为文件，
 * basename 均为 `.git`）。
 */
const TEMPLATE_COPY_IGNORE_SET = new Set([".git"]);

/** 判断模板拷贝时是否应跳过该条目（按顶层 VCS 元数据名匹配） */
export const isTemplateCopyIgnored = (source: string): boolean => {
  return TEMPLATE_COPY_IGNORE_SET.has(path.basename(source));
};

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
  /**
   * 模板友好名（来自模板列表 choice.name）。
   * 仅在「从模板列表选择」时有值；自定义 url / 公共仓 / 直传 url 时为 undefined。
   * 供创建实例留痕的 `template` 标识使用（无名时回落 url）。
   */
  templateName?: string;
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
  /** 模板仓库分支；本机模板仅在显式指定时有值（未指定即取模板仓当前所在分支，不记录） */
  branch?: string;
  /** 实际检出的完整 commit */
  commit: string;
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
  /** 临时检出目录（clone / worktree），模板目录经符号链接解开后不得越出它 */
  checkoutDir: string;
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

/** 读 git 命令输出，失败返回 undefined */
const gitOutput = (repoRoot: string, args: string): string | undefined => {
  try {
    return (
      execSyncHijack(`git ${args}`, { cwd: repoRoot, stdio: "pipe" })
        ?.toString()
        .trim() || undefined
    );
  } catch (error) {
    return undefined;
  }
};

/** 检出里没有模板目录时的报错：点名模板仓、所取分支与目录，不报临时目录路径 */
const missingTemplateError = ({ url, branch, directory }: TemplateSourceInfo) =>
  new Error(
    `模板仓 ${url}（${branch ? `分支 ${branch}` : "当前分支"}，只含已提交内容）里没有模板目录 ${directory}`,
  );

/**
 * 清理本地模板生成时创建的临时 worktree。
 * ---
 * worktree 以 detached 方式检出、不建分支，模板仓里只有 `.git/worktrees/<名>` 一条记录要清；
 * remove 失败（被锁 / 目录已被外部删除 / add 中途失败）时兜底删目录 + prune。
 */
const cleanupLocalTemplateWorktree = ({
  repoRoot,
  worktreeDir,
}: CleanupLocalTemplateWorktreeOptions) => {
  if (existsSync(worktreeDir)) {
    try {
      execSyncHijack(
        `git worktree remove --force ${quoteShellArg(worktreeDir)}`,
        {
          cwd: repoRoot,
          stdio: "ignore",
        },
      );
      return;
    } catch (error) {
      outputConsole.warn(`临时worktree清理失败，尝试兜底: ${worktreeDir}`);
    }
    try {
      safeRemoveDirSync({
        targetPath: worktreeDir,
        parentDir: path.dirname(worktreeDir),
        label: "临时worktree目录",
      });
    } catch (rmError) {
      outputConsole.warn(`临时worktree目录删除失败: ${worktreeDir}`);
    }
  }
  try {
    execSyncHijack(`git worktree prune`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch (pruneError) {
    outputConsole.warn(`git worktree prune 失败: ${repoRoot}`);
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

/**
 * 模板目录的真实路径：解开顶层（及途经）符号链接；解开后越出检出目录即拒绝——模板仓内容不可信，
 * 不能借符号链接把本机任意目录拷进项目。
 */
const resolveTemplateRealRoot = (sourceRoot: string, checkoutDir: string) => {
  const realRoot = realpathSync(sourceRoot);
  const checkoutReal = realpathSync(checkoutDir);
  if (
    realRoot !== checkoutReal &&
    !pathIsInsideParentDir({ targetPath: realRoot, parentDir: checkoutReal })
  ) {
    throw new Error(
      `模板目录经符号链接指向模板仓之外，已拒绝: ${sourceRoot} -> ${realRoot}`,
    );
  }
  return realRoot;
};

/**
 * 将模板复制源目录复制到项目目标目录。
 * ---
 * 检出目录随后即被清理，复制结果不能引用它：
 * - 顶层是符号链接时按其指向的目录复制真实文件（否则目标是指向临时目录的悬空链接）；
 * - 子树内的符号链接原样保留链接文本（`verbatimSymlinks`）。cpSync 缺省会把相对链接改写成
 *   指向临时目录的绝对路径，清理后同样悬空；保留相对文本则模板内互指的链接在项目里照样成立，
 *   也不把链接目标的内容复制一份或读到模板之外。
 */
const copyTemplateSourceRoot = ({
  sourceRoot,
  checkoutDir,
  targetPath,
}: CopyTemplateSourceRootOptions) => {
  if (!existsSync(sourceRoot)) {
    throw new Error(`模板目录不存在: ${sourceRoot}`);
  }
  const realRoot = resolveTemplateRealRoot(sourceRoot, checkoutDir);
  if (!statSync(realRoot).isDirectory()) {
    throw new Error(`模板路径不是目录: ${sourceRoot}`);
  }
  cpSync(realRoot, targetPath, {
    recursive: true,
    verbatimSymlinks: true,
    filter(source) {
      return !isTemplateCopyIgnored(source);
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
      checkoutDir: tempRepoDir,
      targetPath,
    });
    return {
      branch:
        templateSource.branch ??
        gitOutput(tempRepoDir, "symbolic-ref --short HEAD")!,
      commit: gitOutput(tempRepoDir, "rev-parse HEAD")!,
    };
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
  // 本机路径就是模板仓本身：取它当前所在的分支（HEAD），显式指定了分支才用该分支；不联网、不推断远端分支
  const worktreeBaseRef = templateSource.branch ?? "HEAD";
  mkdirSync(path.dirname(tempRepoDir), { recursive: true });

  try {
    // detached 检出：不在模板仓建临时分支；add 放进 try，中途失败也走清理
    execSyncHijack(
      `git worktree add --detach ${quoteShellArg(tempRepoDir)} ${quoteShellArg(worktreeBaseRef)}`,
      {
        cwd: repoRoot,
        stdio: "ignore",
      },
    );
    const sourceRoot = getTemplateSourceRoot({
      tempRepoDir,
      directory: templateSource.directory,
    });
    if (!existsSync(sourceRoot)) {
      throw missingTemplateError(templateSource);
    }
    copyTemplateSourceRoot({
      sourceRoot,
      checkoutDir: tempRepoDir,
      targetPath,
    });
    return {
      branch: templateSource.branch,
      commit: gitOutput(tempRepoDir, "rev-parse HEAD")!,
    };
  } finally {
    cleanupLocalTemplateWorktree({
      repoRoot,
      worktreeDir: tempRepoDir,
    });
  }
};

/** 将模板来源生成到项目目标目录 */
export const materializeTemplateToProject = (
  options: MaterializeTemplateOptions,
): TemplateInstanceInfo => {
  const actual =
    options.templateSource.type === CreateTemplateSourceTypeEnum.LOCAL
      ? materializeLocalGitTemplate(options)
      : materializeRemoteGitTemplate(options);
  if (!actual.commit) {
    throw new Error("无法读取模板实际 commit");
  }
  outputConsole.stage(
    `模板来源：${options.templateSource.url}${actual.branch ? ` @ ${actual.branch}` : ""} (${actual.commit.slice(0, 7)})`,
  );

  return {
    type: options.templateSource.type,
    url: options.templateSource.url,
    ...actual,
    directory: options.templateSource.directory,
    targetPath: options.targetPath,
  };
};
