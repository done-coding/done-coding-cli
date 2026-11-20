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
  /** 模板仓库分支 */
  branch: string;
  /** 实际检出的完整 commit */
  commit: string;
  /** 本地模板仓的 origin 地址 */
  remoteUrl?: string;
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

/** 所有 ref 查询都通过既有命令入口，失败返回 undefined 供有序回落。 */
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

/** fetch 远端；失败只告警，返回是否成功 */
const fetchOrigin = (repoRoot: string): boolean => {
  try {
    execSyncHijack("git fetch origin", { cwd: repoRoot, stdio: "pipe" });
    return true;
  } catch (error) {
    outputConsole.warn("模板仓 git fetch origin 失败，将使用已有远端跟踪分支");
    return false;
  }
};

/**
 * 远端默认分支对应的跟踪 ref 候选（按优先级）。
 * ---
 * 本地 `refs/remotes/origin/HEAD` 只在 clone / `remote set-head` 时写入，`git fetch` 不更新，
 * 远端改过默认分支后它会一直指着旧分支；故联网时先问远端实际 HEAD（`ls-remote --symref`，只读），
 * 本地 origin/HEAD 只作离线回落，两者不一致时提示更新。
 */
const resolveOriginHeadCandidates = (
  repoRoot: string,
): { refs: string[]; verified?: string } => {
  const fetched = fetchOrigin(repoRoot);
  const localHead = gitOutput(
    repoRoot,
    "symbolic-ref --quiet refs/remotes/origin/HEAD",
  );
  const remoteBranch = fetched
    ? gitOutput(repoRoot, "ls-remote --symref origin HEAD")?.match(
        /^ref: refs\/heads\/(\S+)\s+HEAD$/m,
      )?.[1]
    : undefined;
  const remoteHead = remoteBranch && `refs/remotes/origin/${remoteBranch}`;
  if (remoteHead && localHead && remoteHead !== localHead) {
    outputConsole.warn(
      `模板仓本地 origin/HEAD 指向 ${localHead}，与远端默认分支 ${remoteHead} 不一致，已按远端取；可在模板仓执行 git remote set-head origin -a 更新`,
    );
  }
  return {
    refs: [
      remoteHead,
      localHead,
      "refs/remotes/origin/master",
      "refs/remotes/origin/main",
    ].filter((ref): ref is string => Boolean(ref)),
    verified: remoteHead,
  };
};

const shortRef = (ref: string) => ref.replace(/^refs\/(remotes|heads)\//, "");

/** 模板目录在仓内的路径（git tree 路径）；未给、指仓根或越出仓外时返回 undefined（不做按目录挑选） */
const toRepoTreePath = (directory?: string): string | undefined => {
  if (!directory) return undefined;
  const treePath = path.posix
    .normalize(directory.replace(/\\/g, "/"))
    .replace(/\/+$/, "");
  if (!treePath || treePath === ".") return undefined;
  if (treePath === ".." || treePath.startsWith("../")) return undefined;
  return path.posix.isAbsolute(treePath) ? undefined : treePath;
};

const isCommitRef = (repoRoot: string, ref: string) =>
  Boolean(
    gitOutput(
      repoRoot,
      `rev-parse --verify ${quoteShellArg(`${ref}^{commit}`)}`,
    ),
  );

/** ref 里有该路径（目录 / 符号链接等任意对象；大小写按 git 精确匹配，只作挑选与提示依据） */
const hasTemplatePath = (repoRoot: string, ref: string, treePath: string) =>
  Boolean(
    gitOutput(repoRoot, `cat-file -t ${quoteShellArg(`${ref}:${treePath}`)}`),
  );

/**
 * 未传 -b 时的默认 ref。
 * ---
 * 远端实际 HEAD 经 `ls-remote` 核实时以它为准；拿不到（离线 / 无凭据）时首选只是本地猜测，
 * 本地 `origin/HEAD` 可能过期指着没有模板的旧分支（studio 走查实测），故按模板目录挑第一个含它的候选并提示。
 */
const resolveLocalDefaultRef = (
  repoRoot: string,
  remoteUrl?: string,
  directory?: string,
): string => {
  const origin = remoteUrl
    ? resolveOriginHeadCandidates(repoRoot)
    : { refs: [], verified: undefined };
  const candidates = [
    ...origin.refs,
    "refs/heads/master",
    "refs/heads/main",
  ].filter((ref) => isCommitRef(repoRoot, ref));
  const [first] = candidates;
  if (!first) {
    throw new Error("模板仓没有可用的默认分支，请用 -b 显式指定分支或标签");
  }
  const treePath = toRepoTreePath(directory);
  if (!treePath || first === origin.verified) return first;
  const found = candidates.find((ref) =>
    hasTemplatePath(repoRoot, ref, treePath),
  );
  if (!found || found === first) return first;
  outputConsole.warn(
    `模板仓 ${shortRef(first)} 里没有模板目录 ${treePath}（远端默认分支未能核实），已改取 ${shortRef(found)}；联网后可在模板仓执行 git remote set-head origin -a 更新，或用 -b 指定分支`,
  );
  return found;
};

/** 默认取的是远端跟踪分支、而本地同名分支有未推送提交时提示：这些改动不会用到 */
const warnLocalAhead = (repoRoot: string, ref: string) => {
  const branch = ref.match(/^refs\/remotes\/origin\/(.+)$/)?.[1];
  if (!branch || branch === "HEAD") return;
  const ahead = Number(
    gitOutput(
      repoRoot,
      `rev-list --count ${quoteShellArg(`${ref}..refs/heads/${branch}`)}`,
    ) ?? 0,
  );
  if (ahead > 0) {
    outputConsole.warn(
      `模板仓本地 ${branch} 领先 origin/${branch} ${ahead} 个提交（未推送），默认按远端取，这些改动不会用到；要用本地内容请加 -b ${branch}`,
    );
  }
};

/**
 * 检出后模板目录不存在时的报错：点名所取 ref 并给出处理办法（原先只报临时目录路径）。
 * 判定仍是检出目录上的 existsSync（与改动前同一条件），这里只换说明。
 */
const missingTemplateError = (
  repoRoot: string,
  source: { ref: string; explicit: boolean; directory?: string },
) => {
  const treePath = toRepoTreePath(source.directory);
  const local =
    treePath &&
    ["master", "main"].find((branch) =>
      hasTemplatePath(repoRoot, `refs/heads/${branch}`, treePath),
    );
  return new Error(
    `模板目录 ${treePath ?? source.directory} 在模板仓的 ${shortRef(source.ref)} 里不存在。` +
      (local
        ? `本地 ${local} 分支有该目录，可加 -b ${local}`
        : "请核对模板 directory，或用 -b 指定含该目录的分支") +
      (source.explicit
        ? ""
        : "；未传 -b 时默认取远端默认分支，本地 origin/HEAD 过期可在模板仓执行 git remote set-head origin -a"),
  );
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
  const worktreeBranch = `done-coding-template-${randomUUID()}`;
  const remoteUrl = gitOutput(repoRoot, "remote get-url origin");
  const worktreeBaseRef =
    templateSource.branch ??
    resolveLocalDefaultRef(repoRoot, remoteUrl, templateSource.directory);
  if (!templateSource.branch) warnLocalAhead(repoRoot, worktreeBaseRef);
  mkdirSync(path.dirname(tempRepoDir), { recursive: true });
  execSyncHijack(
    `git worktree add -b ${quoteShellArg(worktreeBranch)} ${quoteShellArg(tempRepoDir)} ${quoteShellArg(worktreeBaseRef)}`,
    {
      cwd: repoRoot,
      stdio: "ignore",
    },
  );

  try {
    const sourceRoot = getTemplateSourceRoot({
      tempRepoDir,
      directory: templateSource.directory,
    });
    if (!existsSync(sourceRoot)) {
      throw missingTemplateError(repoRoot, {
        ref: worktreeBaseRef,
        explicit: Boolean(templateSource.branch),
        directory: templateSource.directory,
      });
    }
    copyTemplateSourceRoot({
      sourceRoot,
      checkoutDir: tempRepoDir,
      targetPath,
    });
    return {
      branch:
        templateSource.branch ??
        worktreeBaseRef.replace(/^refs\/(remotes|heads)\//, ""),
      commit: gitOutput(tempRepoDir, "rev-parse HEAD")!,
      remoteUrl,
    };
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
  const actual =
    options.templateSource.type === CreateTemplateSourceTypeEnum.LOCAL
      ? materializeLocalGitTemplate(options)
      : materializeRemoteGitTemplate(options);
  if (!actual.commit || !actual.branch) {
    throw new Error("无法读取模板实际 ref 或 commit");
  }
  outputConsole.stage(
    `模板来源：${options.templateSource.url} @ ${actual.branch} (${actual.commit.slice(0, 7)})`,
  );

  return {
    type: options.templateSource.type,
    url: options.templateSource.url,
    ...actual,
    directory: options.templateSource.directory,
    targetPath: options.targetPath,
  };
};
