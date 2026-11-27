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
import { cleanupCreateDraftParents } from "@/utils/create-artifacts";
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

/** 模板仓 origin 指向不存在的地址：任何联网动作都会失败 */
const unreachableOrigin = () =>
  git(repo, "remote", "add", "origin", path.join(scratch, "missing.git"));
/** 模板仓里没有 create 留下的临时 worktree 记录和临时分支 */
const expectNoResidue = () => {
  expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1);
  expect(git(repo, "branch", "--list", "done-coding-template-*")).toBe("");
};

describe("模板来源与创建产物", () => {
  it("本机模板取模板仓当前所在分支的已提交内容，不联网；显式分支 / 标签照用", () => {
    unreachableOrigin();
    git(repo, "branch", "stable");
    git(repo, "checkout", "-qb", "development");
    writeFileSync(path.join(repo, "template/content.txt"), "development");
    const head = commit();
    writeFileSync(path.join(repo, "template/content.txt"), "uncommitted");
    const warn = vi.spyOn(outputConsole, "warn").mockImplementation(() => {});

    const result = materialize();
    expect(result.branch).toBeUndefined();
    expect(result.commit).toBe(head);
    expect(
      readFileSync(path.join(result.targetPath, "content.txt"), "utf-8"),
    ).toBe("development");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();

    const explicit = materialize("stable");
    expect(explicit.branch).toBe("stable");
    expect(
      readFileSync(path.join(explicit.targetPath, "content.txt"), "utf-8"),
    ).toBe("stable");
    git(repo, "tag", "v1", "stable");
    expect(materialize("v1").commit).toBe(git(repo, "rev-parse", "stable"));
    expectNoResidue();
  });

  it("模板目录不存在：报错点名模板仓与目录，模板仓不留临时 worktree / 分支", () => {
    const run = (branch?: string) =>
      materializeTemplateToProject({
        templateSource: resolveTemplateSourceFromUrl({
          templateUrl: repo,
          templateBranch: branch,
          directory: "missing",
        }),
        rootDir: work,
        targetPath: path.join(work, `missing-${branch ?? "default"}`),
      });
    expect(() => run()).toThrow(
      `模板仓 ${repo}（当前分支，只含已提交内容）里没有模板目录 missing`,
    );
    expect(() => run("master")).toThrow(/（分支 master，只含已提交内容）/);
    expect(() => run("no-such-branch")).toThrow();
    expect(existsSync(path.join(work, "missing-default"))).toBe(false);
    expectNoResidue();
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

  it("模板配置是指向项目外的链接：预设问题 / 使用步骤都不读，直接拒绝", async () => {
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

  it("complete 不写 template.lock；注册表记目录与 commit，未指定分支不记分支", async () => {
    const prepared = await prepareCreateProject(argv(), ctx());
    await completeCreateProject(
      {
        rootDir: work,
        draftId: prepared.draftId,
        envData: { name: "app", token: "private-value" },
      },
      ctx(),
    );
    expect(existsSync(path.join(work, "app/content.txt"))).toBe(true);
    expect(
      existsSync(path.join(work, "app/.done-coding/template.lock.json")),
    ).toBe(false);
    expect(existsSync(path.join(work, "app/.done-coding/template.json"))).toBe(
      false,
    );
    const registry = JSON.parse(readFileSync(getRegistryPath(), "utf-8"));
    expect(registry.instances[0]).toMatchObject({
      templateDirectory: "template",
      templateCommit: git(repo, "rev-parse", "HEAD"),
    });
    expect(registry.instances[0]).not.toHaveProperty("templateBranch");
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

  it("清理空父目录拒绝 symlink 逃逸", () => {
    mkdirSync(path.join(work, ".done-coding"));
    const outside = path.join(scratch, "outside");
    mkdirSync(path.join(outside, "tmp/create"), { recursive: true });
    symlinkSync(outside, path.join(work, ".done-coding/default"));
    cleanupCreateDraftParents(work);
    expect(existsSync(path.join(outside, "tmp/create"))).toBe(true);
  });
});
