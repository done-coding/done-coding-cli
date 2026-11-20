import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { outputConsole } from "@done-coding/cli-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  materializeTemplateToProject,
  resolveTemplateSourceFromUrl,
} from "@/utils/templateSource";
import {
  completeCreateProject,
  handler,
  prepareCreateProject,
} from "@/handlers/create";
import {
  cleanupCreateDraftParents,
  readTemplateSecretKeys,
  writeTemplateLock,
} from "@/utils/create-artifacts";
import { readTemplateUsageSteps } from "@/utils/usage-steps";
import { getRegistryPath } from "@/utils/instances-registry";
import { CreateTemplateSourceTypeEnum } from "@/types";

/** 本机临时目录所在文件系统是否大小写不敏感（macOS / Windows 默认） */
const caseInsensitiveFs = (() => {
  const dir = mkdtempSync(path.join(tmpdir(), "dc-case-"));
  try {
    writeFileSync(path.join(dir, "probe"), "");
    return existsSync(path.join(dir, "PROBE"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

let scratch: string;
let repo: string;
let work: string;
let oldRegistry: string | undefined;
const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
    },
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const commit = () => {
  git(repo, "add", ".");
  git(
    repo,
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "fixture",
  );
  return git(repo, "rev-parse", "HEAD");
};
const materialize = (branch?: string) =>
  materializeTemplateToProject({
    templateSource: resolveTemplateSourceFromUrl({
      templateUrl: repo,
      templateBranch: branch,
      directory: "template",
    }),
    rootDir: work,
    targetPath: path.join(work, `out-${branch ?? "default"}`),
  });
const argv = () => ({
  rootDir: work,
  projectName: "app",
  templateUrl: repo,
  templateDirectory: "template",
  openGitDetailOptimize: false,
});
const ctx = () => ({ cwd: work, interactive: false });

beforeEach(() => {
  scratch = realpathSync(mkdtempSync(path.join(tmpdir(), "dc-provenance-")));
  repo = path.join(scratch, "repo");
  work = path.join(scratch, "work");
  mkdirSync(path.join(repo, "template/.done-coding"), { recursive: true });
  mkdirSync(work);
  writeFileSync(path.join(repo, "template/content.txt"), "stable");
  writeFileSync(
    path.join(repo, "template/.done-coding/template.json"),
    JSON.stringify({
      collectEnvDataForm: [
        { key: "name", label: "名称" },
        { key: "token", label: "凭证", secret: true },
      ],
      list: [],
    }),
  );
  git(repo, "init", "-q", "-b", "master");
  commit();
  oldRegistry = process.env.DC_CREATE_INSTANCES_BASE_DIR;
  process.env.DC_CREATE_INSTANCES_BASE_DIR = path.join(scratch, "home");
});
afterEach(() => {
  if (oldRegistry === undefined)
    delete process.env.DC_CREATE_INSTANCES_BASE_DIR;
  else process.env.DC_CREATE_INSTANCES_BASE_DIR = oldRegistry;
  rmSync(scratch, { recursive: true, force: true });
});

const originFixture = (defaultBranch = "stable") => {
  git(repo, "branch", defaultBranch);
  const origin = path.join(scratch, "origin.git");
  git(scratch, "init", "--bare", "-q", origin);
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-q", "origin", "master", defaultBranch);
  git(origin, "symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`);
  git(repo, "remote", "set-head", "origin", "-a");
  git(repo, "checkout", "-qb", "development");
  writeFileSync(path.join(repo, "template/content.txt"), "development");
  commit();
  writeFileSync(path.join(repo, "template/content.txt"), "uncommitted");
  return origin;
};

describe("模板实际来源与出生记录", () => {
  it("开发分支检出且有未合入内容：默认读取 origin/HEAD，显式 -b 读取在途分支和标签", () => {
    originFixture();
    const result = materialize();
    expect(result.branch).toBe("origin/stable");
    expect(result.commit).toBe(git(repo, "rev-parse", "origin/stable"));
    expect(
      readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
    ).toBe("stable");
    const explicit = materialize("development");
    expect(
      readFileSync(path.join(explicit.targetPath, "content.txt"), "utf-8"),
    ).toBe("development");
    git(repo, "tag", "v1", "master");
    expect(materialize("v1").commit).toBe(git(repo, "rev-parse", "master"));
  });

  it("fetch 更新跟踪分支；本地与远端都取不到 HEAD 时优先 origin/master", () => {
    const origin = originFixture();
    git(repo, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");
    git(origin, "symbolic-ref", "HEAD", "refs/heads/missing");
    git(repo, "config", "remote.origin.followRemoteHEAD", "never");
    const publisher = path.join(scratch, "publisher");
    git(scratch, "clone", "-q", origin, publisher);
    git(publisher, "checkout", "master");
    writeFileSync(path.join(publisher, "template/content.txt"), "new remote");
    git(publisher, "add", ".");
    git(
      publisher,
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "update",
    );
    git(publisher, "push", "-q", "origin", "master");
    const result = materialize();
    expect(result.branch).toBe("origin/master");
    expect(
      readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
    ).toBe("new remote");
  });

  it("本地 origin/HEAD 过期指向旧分支：按远端实际 HEAD 取默认分支", () => {
    const origin = originFixture();
    const publisher = path.join(scratch, "publisher");
    git(scratch, "clone", "-q", origin, publisher);
    git(publisher, "checkout", "-q", "--orphan", "legacy");
    git(publisher, "rm", "-rqf", ".");
    writeFileSync(path.join(publisher, "legacy.txt"), "legacy");
    git(publisher, "add", ".");
    git(
      publisher,
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "legacy",
    );
    git(publisher, "push", "-q", "origin", "legacy");
    git(repo, "fetch", "-q", "origin");
    git(
      repo,
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/legacy",
    );
    const warn = vi.spyOn(outputConsole, "warn").mockImplementation(() => {});
    const result = materialize();
    expect(result.branch).toBe("origin/stable");
    expect(
      readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
    ).toBe("stable");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("git remote set-head origin -a"),
    );
    warn.mockRestore();
  });

  it("离线且本地 origin/HEAD 过期指向没有模板目录的旧分支：改取含该目录的候选并提示", () => {
    const origin = originFixture();
    const publisher = path.join(scratch, "publisher");
    git(scratch, "clone", "-q", origin, publisher);
    git(publisher, "checkout", "-q", "--orphan", "legacy");
    git(publisher, "rm", "-rqf", ".");
    writeFileSync(path.join(publisher, "legacy.txt"), "legacy");
    git(publisher, "add", ".");
    git(
      publisher,
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "legacy",
    );
    git(publisher, "push", "-q", "origin", "legacy");
    git(repo, "fetch", "-q", "origin");
    git(
      repo,
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/legacy",
    );
    git(repo, "remote", "set-url", "origin", path.join(scratch, "missing.git"));
    const warn = vi.spyOn(outputConsole, "warn").mockImplementation(() => {});
    const result = materialize();
    expect(result.branch).toBe("origin/master");
    expect(
      readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
    ).toBe("stable");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("origin/legacy 里没有模板目录 template"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("已改取 origin/master"),
    );
    warn.mockRestore();
  });

  it("默认分支里没有模板目录：报错点名所取分支，本地分支有该目录时提示 -b", () => {
    originFixture();
    git(repo, "checkout", "-qf", "master");
    mkdirSync(path.join(repo, "extra"));
    writeFileSync(path.join(repo, "extra/content.txt"), "local only");
    commit();
    const run = (branch?: string) =>
      materializeTemplateToProject({
        templateSource: resolveTemplateSourceFromUrl({
          templateUrl: repo,
          templateBranch: branch,
          directory: "extra/",
        }),
        rootDir: work,
        targetPath: path.join(work, `extra-${branch ?? "default"}`),
      });
    expect(() => run()).toThrow(
      /模板目录 extra 在模板仓的 origin\/stable 里不存在。本地 master 分支有该目录，可加 -b master；未传 -b/,
    );
    expect(() => run("stable")).toThrow(
      /stable 里不存在。本地 master 分支有该目录，可加 -b master$/,
    );
    expect(run("master").branch).toBe("master");
    expect(existsSync(path.join(work, "extra-default"))).toBe(false);
  });

  describe("符号链接：生成结果不引用随后清理的临时检出目录", () => {
    const linkFixture = () => {
      symlinkSync("template", path.join(repo, "alias"));
      symlinkSync("content.txt", path.join(repo, "template/inner-link.txt"));
      commit();
    };
    const expectRealCopy = (targetPath: string) => {
      expect(lstatSync(targetPath).isSymbolicLink()).toBe(false);
      expect(readFileSync(path.join(targetPath, "content.txt"), "utf-8")).toBe(
        "stable",
      );
      const inner = path.join(targetPath, "inner-link.txt");
      expect(readlinkSync(inner)).toBe("content.txt");
      expect(readFileSync(inner, "utf-8")).toBe("stable");
    };

    it("本地模板：顶层链接按指向目录复制真实文件，子树链接保留相对文本", () => {
      linkFixture();
      const result = materializeTemplateToProject({
        templateSource: resolveTemplateSourceFromUrl({
          templateUrl: repo,
          directory: "alias",
        }),
        rootDir: work,
        targetPath: path.join(work, "out-alias"),
      });
      // 返回时临时 worktree 已清理，生成结果仍完整可读
      expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1);
      expectRealCopy(result.targetPath);
    });

    it("远程模板（clone）同样复制真实文件", () => {
      linkFixture();
      const origin = path.join(scratch, "remote.git");
      git(scratch, "clone", "-q", "--bare", repo, origin);
      const result = materializeTemplateToProject({
        templateSource: {
          ...resolveTemplateSourceFromUrl({
            templateUrl: repo,
            directory: "alias",
          }),
          type: CreateTemplateSourceTypeEnum.REMOTE,
          url: origin,
        },
        rootDir: work,
        targetPath: path.join(work, "out-remote"),
      });
      expectRealCopy(result.targetPath);
    });

    it("顶层链接指向模板仓之外时拒绝，不把本机目录拷进项目", () => {
      const outside = path.join(scratch, "outside");
      mkdirSync(outside);
      writeFileSync(path.join(outside, "secret.txt"), "secret");
      symlinkSync(outside, path.join(repo, "escape"));
      commit();
      expect(() =>
        materializeTemplateToProject({
          templateSource: resolveTemplateSourceFromUrl({
            templateUrl: repo,
            directory: "escape",
          }),
          rootDir: work,
          targetPath: path.join(work, "out-escape"),
        }),
      ).toThrow(/指向模板仓之外/);
      expect(existsSync(path.join(work, "out-escape"))).toBe(false);
    });
  });

  it("编译阶段不经模板里的链接或路径写到项目目录之外", async () => {
    const outside = path.join(scratch, "outside");
    mkdirSync(outside);
    writeFileSync(path.join(outside, "rc"), "original");
    symlinkSync(path.join(outside, "rc"), path.join(repo, "template/evil"));
    writeFileSync(
      path.join(repo, "template/.done-coding/template.json"),
      JSON.stringify({
        collectEnvDataForm: [{ key: "name", label: "名称" }],
        list: [{ input: "evil", mode: "replace" }],
      }),
    );
    commit();
    await expect(
      handler({ ...argv(), env: '{"name":"app"}' }, ctx()),
    ).rejects.toThrow(/越出项目目录/);
    expect(readFileSync(path.join(outside, "rc"), "utf-8")).toBe("original");
    expect(existsSync(path.join(work, "app"))).toBe(false);
  });

  it("模板配置是指向项目外的链接：预设问题 / 使用步骤 / secret key 都不读，直接拒绝", async () => {
    const outside = path.join(scratch, "outside");
    mkdirSync(outside);
    writeFileSync(
      path.join(outside, "config.json"),
      JSON.stringify({
        collectEnvDataForm: [{ key: "leaked", label: "外部", secret: true }],
        usageSteps: ["outside"],
        list: [],
      }),
    );
    const configRel = ".done-coding/template.json";
    rmSync(path.join(repo, "template", configRel));
    symlinkSync(
      path.join(outside, "config.json"),
      path.join(repo, "template", configRel),
    );
    commit();
    await expect(prepareCreateProject(argv(), ctx())).rejects.toThrow(
      /模板配置 .*template\.json 指向 .*越出项目目录/,
    );
    expect(existsSync(path.join(work, ".done-coding"))).toBe(false);

    const project = path.join(scratch, "project");
    mkdirSync(path.join(project, ".done-coding"), { recursive: true });
    symlinkSync(
      path.join(outside, "config.json"),
      path.join(project, configRel),
    );
    await expect(readTemplateSecretKeys(project, configRel)).rejects.toThrow(
      /越出项目目录/,
    );
    await expect(
      readTemplateUsageSteps({ rootDir: project, configPath: configRel }),
    ).rejects.toThrow(/越出项目目录/);
  });

  it.runIf(caseInsensitiveFs)(
    "大小写不敏感的文件系统上，directory 大小写与仓内不一致照旧可用",
    () => {
      const result = materializeTemplateToProject({
        templateSource: resolveTemplateSourceFromUrl({
          templateUrl: repo,
          directory: "TEMPLATE",
        }),
        rootDir: work,
        targetPath: path.join(work, "out-case"),
      });
      expect(
        readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
      ).toBe("stable");
    },
  );

  it("本地默认分支有未推送提交：仍按远端取，并提示加 -b 用本地内容", () => {
    originFixture();
    git(repo, "checkout", "-qf", "stable");
    writeFileSync(path.join(repo, "template/content.txt"), "unpushed");
    commit();
    const warn = vi.spyOn(outputConsole, "warn").mockImplementation(() => {});
    const result = materialize();
    expect(result.branch).toBe("origin/stable");
    expect(
      readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
    ).toBe("stable");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("本地 stable 领先 origin/stable 1 个提交"),
    );
    warn.mockRestore();
  });

  it("fetch 失败使用已有跟踪分支", () => {
    originFixture();
    git(repo, "remote", "set-url", "origin", path.join(scratch, "missing.git"));
    expect(materialize().branch).toBe("origin/stable");
  });

  it.each(["master", "main"])(
    "无 origin 回落本地 %s，不取开发分支",
    (branch) => {
      git(repo, "branch", "-m", branch);
      git(repo, "checkout", "-qb", "development");
      expect(materialize().branch).toBe(branch);
    },
  );

  it("无默认分支时要求 -b，并清理 prepare 失败草稿", async () => {
    git(repo, "branch", "-m", "development");
    await expect(prepareCreateProject(argv(), ctx())).rejects.toThrow(/-b/);
    expect(existsSync(path.join(work, ".done-coding"))).toBe(false);
  });

  it("complete 写 lock 和注册表：commit 与 origin 一致，secret 仅存 key", async () => {
    const origin = originFixture();
    const prepared = await prepareCreateProject(argv(), ctx());
    const draft = JSON.parse(
      readFileSync(
        path.join(
          work,
          ".done-coding/default/tmp/create",
          prepared.draftId,
          "draft.json",
        ),
        "utf-8",
      ),
    );
    expect(draft.secretKeys).toEqual(["token"]);
    expect(JSON.stringify(draft)).not.toContain("private-value");
    await completeCreateProject(
      {
        rootDir: work,
        draftId: prepared.draftId,
        envData: { name: "app", token: "private-value", extra: "kept" },
      },
      ctx(),
    );
    const raw = readFileSync(
      path.join(work, "app/.done-coding/template.lock.json"),
      "utf-8",
    );
    const lock = JSON.parse(raw);
    expect(lock).toMatchObject({
      version: 1,
      template: repo,
      url: repo,
      remoteUrl: origin,
      directory: "template",
      branch: "origin/stable",
      commit: git(origin, "rev-parse", "stable"),
      answers: { name: "app", extra: "kept" },
      secretKeys: ["token"],
      cli: { name: "create-done-coding", version: expect.any(String) },
      createdAt: expect.any(String),
    });
    expect(raw).not.toContain("private-value");
    expect(raw).toBe(`${JSON.stringify(lock, null, 2)}\n`);
    expect(existsSync(path.join(work, "app/.done-coding/template.json"))).toBe(
      false,
    );
    const registry = JSON.parse(readFileSync(getRegistryPath(), "utf-8"));
    expect(registry.instances[0]).toMatchObject({
      templateDirectory: "template",
      templateBranch: "origin/stable",
      templateCommit: lock.commit,
    });
    expect(existsSync(path.join(work, ".done-coding"))).toBe(false);
  });

  it("非交互编译失败清理空父目录", async () => {
    await expect(handler({ ...argv(), env: "{}" }, ctx())).rejects.toThrow();
    expect(existsSync(path.join(work, ".done-coding"))).toBe(false);
    expect(existsSync(path.join(work, "app"))).toBe(false);
  });

  it("成功时保留原有 .done-coding 内容", async () => {
    mkdirSync(path.join(work, ".done-coding"));
    writeFileSync(path.join(work, ".done-coding/keep"), "keep");
    await handler({ ...argv(), env: '{"name":"app","token":"secret"}' }, ctx());
    expect(readFileSync(path.join(work, ".done-coding/keep"), "utf-8")).toBe(
      "keep",
    );
    expect(existsSync(path.join(work, ".done-coding/default"))).toBe(false);
  });

  it("不写交互答案；清理拒绝 symlink 逃逸", () => {
    writeTemplateLock({
      projectPath: work,
      source: {
        url: repo,
        branch: "master",
        commit: git(repo, "rev-parse", "HEAD"),
      },
      secretKeys: ["token"],
    });
    const lock = JSON.parse(
      readFileSync(path.join(work, ".done-coding/template.lock.json"), "utf-8"),
    );
    expect(lock).not.toHaveProperty("answers");
    const outside = path.join(scratch, "outside");
    mkdirSync(path.join(outside, "tmp/create"), { recursive: true });
    symlinkSync(outside, path.join(work, ".done-coding/default"));
    cleanupCreateDraftParents(work);
    expect(existsSync(path.join(outside, "tmp/create"))).toBe(true);
  });
});
