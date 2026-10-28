import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { outputConsole, safeCwd } from "@done-coding/cli-utils";
import { fileIssue } from "@/core/issue";
import { handler } from "@/handlers/issue";
import { diffLists, writeLists } from "@/core/lists";
import { cleanup } from "./helpers";

vi.mock("@done-coding/cli-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@done-coding/cli-utils")>()),
  safeCwd: vi.fn(),
}));

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf-8", env: GIT_ENV }).trim();

let repo = "";
afterEach(() => {
  vi.restoreAllMocks();
  cleanup(repo);
});

/** 临时目标仓：启用 issue/ 的治理目录 + 已提交的清单 + 一处他人在途改动 */
const makeTargetRepo = (): string => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "harness-target-"));
  const gov = path.join(repo, "docs/governance");
  for (const d of ["backlog", "dropped", "schedule", "archive", "issue"]) {
    fs.mkdirSync(path.join(gov, d), { recursive: true });
    fs.writeFileSync(path.join(gov, d, ".gitkeep"), "");
  }
  writeLists(gov);
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  fs.writeFileSync(path.join(repo, "other.txt"), "他人在途改动\n");
  return repo;
};

const params = (targetRoot: string) => ({
  targetRoot,
  from: "src-repo",
  title: "某功能坏了",
  slug: "some-bug",
  body: "## 现象\n\nx\n",
});

describe("fileIssue", () => {
  it.each([
    ["/home/test.user/project /home/test.user", "~/project ~", 2],
    [
      "/home/test.userX /home/test.user-old",
      "/home/test.userX /home/test.user-old",
      0,
    ],
    ["/home/testXuser/project", "/home/testXuser/project", 0],
    [
      "/home/other/project 与 ~/existing",
      "/home/other/project 与 ~/existing",
      0,
    ],
    ["/home/test.user\n下一行", "/home/test.user\n下一行", 0],
  ])("按字面与路径边界替换正文：%s", (body, expected, count) => {
    const target = makeTargetRepo();
    Object.assign(process.env, GIT_ENV);
    const result = fileIssue({ ...params(target), body }, "/home/test.user");
    expect(fs.readFileSync(result.file, "utf-8").split("---\n\n")[1]).toBe(
      `${expected}\n`,
    );
    expect(result.homeReplacements).toBe(count);
  });

  it("标题同样替换，生成的清单也使用替换后的标题", () => {
    const target = makeTargetRepo();
    Object.assign(process.env, GIT_ENV);
    const result = fileIssue(
      { ...params(target), title: "/home/test/project 与 /home/test" },
      "/home/test",
    );
    expect(fs.readFileSync(result.file, "utf-8")).toContain(
      "title: ~/project 与 ~\n",
    );
    expect(
      fs.readFileSync(path.join(target, "docs/governance/ISSUE.md"), "utf-8"),
    ).toContain("~/project 与 ~");
    expect(result.homeReplacements).toBe(2);
  });

  it("写 issue 文件 + 重生 ISSUE.md，且只提交这两个文件", () => {
    const target = makeTargetRepo();
    Object.assign(process.env, GIT_ENV);
    const { id, file, sha } = fileIssue(params(target));

    expect(id).toMatch(/^[a-z0-9]{6}$/);
    expect(path.basename(file)).toBe(`${id}-some-bug.md`);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toMatch(
      new RegExp(
        `^---\\nid: ${id}\\ntitle: 某功能坏了\\ncreated: \\d{4}-\\d{2}-\\d{2}\\nfrom: src-repo\\n---\\n\\n## 现象\\n\\nx\\n$`,
      ),
    );

    expect(git(target, "rev-parse", "--short", "HEAD")).toBe(sha);
    expect(
      git(target, "show", "--name-only", "--format=", "HEAD")
        .split("\n")
        .sort(),
    ).toEqual(
      [
        `docs/governance/issue/${id}-some-bug.md`,
        "docs/governance/ISSUE.md",
      ].sort(),
    );
    expect(git(target, "status", "--porcelain")).toBe("?? other.txt");
    expect(diffLists(path.join(target, "docs/governance"))).toEqual([]);
  });

  it("拒绝：非法 slug / 多行标题 / 空正文 / 目标 ISSUE.md 有未提交改动", () => {
    const target = makeTargetRepo();
    Object.assign(process.env, GIT_ENV);
    expect(() => fileIssue({ ...params(target), slug: "Bad_Slug" })).toThrow(
      /slug/,
    );
    expect(() => fileIssue({ ...params(target), title: "a\nb" })).toThrow(
      /单行/,
    );
    expect(() => fileIssue({ ...params(target), body: "  " })).toThrow(
      /正文为空/,
    );

    fs.appendFileSync(path.join(target, "docs/governance/ISSUE.md"), "手改\n");
    expect(() => fileIssue(params(target))).toThrow(/未提交改动/);
    expect(fs.readdirSync(path.join(target, "docs/governance/issue"))).toEqual([
      ".gitkeep",
    ]);
  });

  it("拒绝：目标仓未启用 issue/", () => {
    const target = makeTargetRepo();
    fs.rmSync(path.join(target, "docs/governance/issue"), { recursive: true });
    expect(() => fileIssue(params(target))).toThrow(/未启用 issue/);
  });
});

describe("issue handler", () => {
  it.each([true, false])(
    "源文件不变，仅有替换时提示（替换=%s）",
    async (replace) => {
      const target = makeTargetRepo();
      Object.assign(process.env, GIT_ENV);
      vi.mocked(safeCwd).mockReturnValue(target);
      vi.spyOn(os, "homedir").mockReturnValue("/home/test");
      const log = vi.spyOn(outputConsole, "info").mockImplementation(() => {});
      const body = replace ? "记录 /home/test/project\n" : "记录 ~/project\n";
      const bodyFile = path.join(target, "body.md");
      fs.writeFileSync(bodyFile, body);
      const result = await handler({
        ...params(target),
        target,
        title: replace ? "查看 /home/test" : "查看项目",
        bodyFile,
      } as Parameters<typeof handler>[0]);
      expect(fs.readFileSync(bodyFile, "utf-8")).toBe(body);
      expect(fs.readFileSync(result.file, "utf-8")).toContain(
        "记录 ~/project\n",
      );
      expect(
        log.mock.calls
          .flat()
          .filter((line) => String(line).includes("处本机家目录路径")),
      ).toEqual(replace ? ["已将 2 处本机家目录路径替换为 ~"] : []);
    },
  );
});
