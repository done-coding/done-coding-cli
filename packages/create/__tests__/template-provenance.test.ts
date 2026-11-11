import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  writeTemplateLock,
} from "@/utils/create-artifacts";
import { getRegistryPath } from "@/utils/instances-registry";

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

  it("fetch 更新跟踪分支；无 origin/HEAD 时优先 origin/master", () => {
    const origin = originFixture();
    git(repo, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");
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
