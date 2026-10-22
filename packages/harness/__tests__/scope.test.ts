import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkScope,
  findRepo,
  readScope,
  registerRepo,
  resolveIssueTarget,
  toScopeKey,
  type RepoEntry,
} from "@/core/scope";
import { cleanup } from "./helpers";

let tmp = "";
let scopeDir = "";
beforeEach(() => {
  tmp = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-")),
  );
  scopeDir = path.join(tmp, "scope");
  fs.mkdirSync(scopeDir);
});
afterEach(() => cleanup(tmp));

/** 建一个仓目录（可选带 issue/ 收件箱） */
const makeRepo = (name: string, inbox = true): string => {
  const root = path.join(tmp, name);
  fs.mkdirSync(path.join(root, "docs/governance", inbox ? "issue" : ""), {
    recursive: true,
  });
  return root;
};

/** 直接写一条登记（模拟手工维护） */
const writeEntry = (entry: RepoEntry, key = toScopeKey(entry.path)) => {
  fs.mkdirSync(path.join(scopeDir, key), { recursive: true });
  fs.writeFileSync(
    path.join(scopeDir, key, "repo.json"),
    JSON.stringify(entry),
  );
};

const entryOf = (root: string, over: Partial<RepoEntry> = {}): RepoEntry => ({
  name: path.basename(root),
  path: root,
  positioning: "p",
  accepts: "a",
  governance: {
    dir: "docs/governance",
    tier: "medium",
    issueInbox: "docs/governance/issue",
  },
  ...over,
});

describe("scope 注册表", () => {
  it("转义键：非字母数字替换为 -（与 ~/.claude/projects 同规则）", () => {
    expect(toScopeKey("/Users/u/.claude")).toBe("-Users-u--claude");
    expect(toScopeKey("/a/b_c-d")).toBe("-a-b-c-d");
  });

  it("readScope 读全部登记，跳过无 repo.json 的目录", () => {
    const a = makeRepo("repo-a");
    writeEntry(entryOf(a));
    fs.mkdirSync(path.join(scopeDir, "empty-dir"));
    expect(readScope(scopeDir).map((r) => r.entry.name)).toEqual(["repo-a"]);
  });

  it("checkScope：合法登记零违规", () => {
    writeEntry(entryOf(makeRepo("repo-a")));
    expect(checkScope(scopeDir)).toEqual([]);
  });

  it("checkScope：path 不存在 / 键不符 / 收件箱缺失 / name 重复 均报出", () => {
    const a = makeRepo("repo-a");
    const b = makeRepo("repo-b", false);
    writeEntry(entryOf(path.join(tmp, "gone")));
    writeEntry(entryOf(a), "stale-key");
    writeEntry(entryOf(b));
    writeEntry(entryOf(makeRepo("repo-c"), { name: "repo-b" }));
    const errs = checkScope(scopeDir).join("\n");
    expect(errs).toMatch(/path 不存在/);
    expect(errs).toMatch(/stale-key.*转义键不符/);
    expect(errs).toMatch(/issueInbox 目录不存在/);
    expect(errs).toMatch(/name「repo-b」重复/);
  });

  it("findRepo：按 name 命中；查不到列出已登记名", () => {
    const a = makeRepo("repo-a");
    writeEntry(entryOf(a));
    expect(findRepo("repo-a", scopeDir).path).toBe(a);
    expect(() => findRepo("nope", scopeDir)).toThrow(/无仓「nope」.*repo-a/);
  });

  it("resolveIssueTarget：路径直用；名字走注册表；不收 issue 的仓拒绝", () => {
    const a = makeRepo("repo-a");
    const b = makeRepo("repo-b", false);
    writeEntry(entryOf(a, { name: "alpha" }));
    writeEntry(
      entryOf(b, {
        name: "beta",
        governance: { dir: "docs/governance", tier: null, issueInbox: null },
      }),
    );
    expect(resolveIssueTarget("repo-a", tmp, scopeDir)).toBe(a);
    expect(resolveIssueTarget("alpha", "/", scopeDir)).toBe(a);
    expect(() => resolveIssueTarget("beta", "/", scopeDir)).toThrow(
      /不接收 issue/,
    );
  });

  it("registerRepo：新登记推出收件箱；更新保留未给字段；撞键拒绝覆盖", () => {
    const a = makeRepo("repo-a");
    const gov = path.join(a, "docs/governance");
    const first = registerRepo(
      { repoRoot: a, governanceRoot: gov, positioning: "定位" },
      scopeDir,
    );
    expect(first).toEqual({
      name: "repo-a",
      path: a,
      positioning: "定位",
      accepts: null,
      governance: {
        dir: "docs/governance",
        tier: null,
        issueInbox: "docs/governance/issue",
      },
    });
    const second = registerRepo(
      { repoRoot: a, governanceRoot: gov, accepts: "缺陷" },
      scopeDir,
    );
    expect(second.positioning).toBe("定位");
    expect(second.accepts).toBe("缺陷");
    expect(checkScope(scopeDir)).toEqual([]);

    // 未建治理目录 → governance 记 null
    const n = makeRepo("repo-n", false);
    expect(registerRepo({ repoRoot: n }, scopeDir).governance).toBeNull();

    // 撞键：/x/a-b 与 /x/a/b 同键
    const collide = path.join(tmp, "k-1");
    fs.mkdirSync(collide);
    writeEntry(entryOf(path.join(tmp, "k/1")), toScopeKey(collide));
    expect(() => registerRepo({ repoRoot: collide }, scopeDir)).toThrow(/撞键/);
  });
});
