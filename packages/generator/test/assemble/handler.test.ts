/**
 * [C3] assembleHandler 单测：action 分发 / --recipe / --all / drift→exitCode=1 /
 * server-agnostic（ctxInit.cwd 注入）。库 throw fail-loud，[MUST NOT] process.exit。
 * 沙盒：tmpdir + afterEach 清理 + non-interactive。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assembleHandler } from "@/handlers/assemble";
import { unregisterAll } from "@/assemble/registry";
import type { DriftResult, BuildResult } from "@/assemble/engine";

let root: string;
beforeEach(() => {
  unregisterAll();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "asm-handler-"));
});
afterEach(() => {
  unregisterAll();
  fs.rmSync(root, { recursive: true, force: true });
});

const frag = (rel: string, content: string): void => {
  const abs = path.join(root, "assemble", "fragments", rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

const recipeFile = (name: string, content: string): string => {
  const dir = path.join(root, "assemble", "recipes");
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, "utf-8");
  return p;
};

const ctxInit = (): { cwd: string; interactive: boolean } => ({
  cwd: root,
  interactive: false,
});

describe("[C3] assembleHandler", () => {
  it("plan：约定目录首个配方（无 --recipe）", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler({ action: "plan" }, ctxInit());
    expect(res.action).toBe("plan");
    expect(res.exitCode).toBe(0);
  });

  it("build：--recipe 显式路径 → 落地", async () => {
    frag("a.txt", "A");
    const p = recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler(
      { action: "build", recipe: p },
      ctxInit(),
    );
    expect(res.exitCode).toBe(0);
    expect(fs.existsSync(path.join(root, "out", "a.txt"))).toBe(true);
  });

  it("check：无漂移 exitCode=0；改产物后 exitCode=1（drift）", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    await assembleHandler({ action: "build" }, ctxInit());
    const ok = await assembleHandler({ action: "check" }, ctxInit());
    expect(ok.exitCode).toBe(0);

    fs.writeFileSync(path.join(root, "out", "a.txt"), "tampered", "utf-8");
    const drift = await assembleHandler({ action: "check" }, ctxInit());
    expect(drift.exitCode).toBe(1);
    expect((drift.payload as DriftResult[])[0].drifted).toBe(true);
  });

  it("--all：两 recipe output 冲突 → fail-loud", async () => {
    frag("a.txt", "A");
    recipeFile(
      "a.json5",
      `{ id:"a", base:{kind:"empty"}, output:"shared", ops:[] }`,
    );
    recipeFile(
      "b.json5",
      `{ id:"b", base:{kind:"empty"}, output:"shared", ops:[] }`,
    );
    await expect(
      assembleHandler({ action: "plan", all: true }, ctxInit()),
    ).rejects.toThrow(/相同|嵌套/);
  });

  it("--json：build 返回 payload（机器可读）", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler(
      { action: "build", json: true },
      ctxInit(),
    );
    expect(
      (res.payload as (BuildResult & { createSync: unknown })[])[0].recipeId,
    ).toBe("r");
  });

  it("无配方且无 --recipe → fail-loud", async () => {
    await expect(
      assembleHandler({ action: "plan" }, ctxInit()),
    ).rejects.toThrow(/配方/);
  });

  it("--all 约定目录无配方 → fail-loud", async () => {
    await expect(
      assembleHandler({ action: "plan", all: true }, ctxInit()),
    ).rejects.toThrow(/--all/);
  });

  it("action 缺省 → 默认 plan", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler({}, ctxInit());
    expect(res.action).toBe("plan");
    expect(res.exitCode).toBe(0);
  });

  it("非法 action → default 分支 throw", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    await expect(
      assembleHandler({ action: "nope" as unknown as "plan" }, ctxInit()),
    ).rejects.toThrow(/未知 assemble action/);
  });

  it("diff（非 json）：无漂移 exitCode=0", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    await assembleHandler({ action: "build" }, ctxInit());
    const res = await assembleHandler({ action: "diff" }, ctxInit());
    expect(res.action).toBe("diff");
    expect(res.exitCode).toBe(0);
  });

  it("diff --json：漂移走 JSON 分支 + exitCode=1", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    await assembleHandler({ action: "build" }, ctxInit());
    fs.writeFileSync(path.join(root, "out", "a.txt"), "tampered", "utf-8");
    const res = await assembleHandler(
      { action: "diff", json: true },
      ctxInit(),
    );
    expect(res.exitCode).toBe(1);
    expect((res.payload as DriftResult[])[0].drifted).toBe(true);
  });

  it("plan --json：走 JSON 分支返回 payload", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler(
      { action: "plan", json: true },
      ctxInit(),
    );
    expect(Array.isArray(res.payload)).toBe(true);
  });

  it("build：--force-clean --allow-untracked-delete 透传到 engine（spread 真分支）", async () => {
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: root });
    execFileSync("git", ["config", "user.name", "t"], { cwd: root });
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler(
      { action: "build", forceClean: true, allowUntrackedDelete: true },
      ctxInit(),
    );
    expect(res.exitCode).toBe(0);
    expect(fs.existsSync(path.join(root, "out", "a.txt"))).toBe(true);
  });

  it("diff：--against worktree + --out-dir 透传到 engine（spread 真分支）", async () => {
    frag("a.txt", "A");
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
        { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    await assembleHandler({ action: "build" }, ctxInit());
    const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "asm-diff-out-"));
    try {
      const res = await assembleHandler(
        { action: "diff", against: "worktree", outDir: tmpOut },
        ctxInit(),
      );
      expect(res.exitCode).toBe(0);
    } finally {
      fs.rmSync(tmpOut, { recursive: true, force: true });
    }
  });

  it("build（非 json）含 createTemplate → 触发 templateList 同步 info 分支", async () => {
    frag("a.txt", "A");
    // create 配置宿主：configPath 指向夹具内一个 create config，name 写入 templateList
    const cfgRel = "create.config.json5";
    // create config 走标准 JSON.parse（非 JSON5），须合法 JSON。
    fs.writeFileSync(
      path.join(root, cfgRel),
      `{ "templateList": [] }`,
      "utf-8",
    );
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out",
         createTemplate: { configPath: "${cfgRel}", name: "demo-tpl" },
         ops:[ { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    const res = await assembleHandler({ action: "build" }, ctxInit());
    expect(res.exitCode).toBe(0);
    expect(
      (res.payload as (BuildResult & { createSync: { synced: boolean } })[])[0]
        .createSync.synced,
    ).toBe(true);
  });

  it("build 二次含同名 createTemplate → 同步走更新分支（inserted=false）", async () => {
    frag("a.txt", "A");
    const cfgRel = "create.config.json5";
    fs.writeFileSync(
      path.join(root, cfgRel),
      `{ "templateList": [] }`,
      "utf-8",
    );
    recipeFile(
      "r.json5",
      `{ id:"r", base:{kind:"empty"}, output:"out",
         createTemplate: { configPath: "${cfgRel}", name: "demo-tpl" },
         ops:[ { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
    );
    await assembleHandler({ action: "build" }, ctxInit()); // 首次：inserted=true
    const res = await assembleHandler({ action: "build" }, ctxInit()); // 二次：更新
    interface Synced {
      createSync: { inserted: boolean };
    }
    expect((res.payload as Synced[])[0].createSync.inserted).toBe(false);
  });
});

describe("[终审M] handler 透传 ctxInit.allowDangerous（programmatic 逃逸）", () => {
  // codex 终审 M：handler 应合并 argv 与 ctxInit 的 allowDangerous，使非 CLI（server/库）
  // 调用传 ctxInit.allowDangerous=true 同样能放行可疑根守卫。
  // 注入 os.homedir()=root 使 cwd 命中"家目录本体"可疑根，从而能观测 allowDangerous 效果。
  it("ctxInit.allowDangerous=true → 可疑根 build 放行；缺省 → fail-loud", async () => {
    const spy = vi.spyOn(os, "homedir").mockReturnValue(root);
    try {
      frag("a.txt", "A");
      const p = recipeFile(
        "r.json5",
        `{ id:"r", base:{kind:"empty"}, output:"out", ops:[
          { type:"addFragment", id:"a", source:"a.txt", target:"a.txt" } ] }`,
      );
      // 无 allowDangerous（cwd=家目录本体）→ runBuild 守卫 throw
      await expect(
        assembleHandler(
          { action: "build", recipe: p },
          { cwd: root, interactive: false },
        ),
      ).rejects.toThrow(/家目录|可疑根/);
      // ctxInit.allowDangerous=true（programmatic，非 CLI argv）→ 合并后放行
      const res = await assembleHandler(
        { action: "build", recipe: p },
        { cwd: root, interactive: false, allowDangerous: true },
      );
      expect(res.exitCode).toBe(0);
      expect(fs.existsSync(path.join(root, "out", "a.txt"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
