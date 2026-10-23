/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * [T3] treeHandler 单测：gitRoot 锚定委托 assemble / build 落盘 gitRoot 内 + manifest /
 * check 项目内漂移闸（改产物→1，还原→0）/ 幂等 / 非 git 仓 fail-loud。
 * server-agnostic（ctxInit.cwd 注入）；沙盒：tmpdir + afterEach 清理 + non-interactive。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveGitRoot, treeHandler } from "@/handlers/tree";
import { unregisterAll } from "@/assemble/registry";
import type { DriftResult } from "@/assemble/engine";

let repo: string;
beforeEach(() => {
  unregisterAll();
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "tree-handler-"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
});
afterEach(() => {
  unregisterAll();
  fs.rmSync(repo, { recursive: true, force: true });
});

const frag = (rel: string, content: string): void => {
  const abs = path.join(
    repo,
    ".done-coding",
    "generator",
    "assemble",
    "fragments",
    rel,
  );
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

const recipeFile = (name: string, content: string): void => {
  const dir = path.join(
    repo,
    ".done-coding",
    "generator",
    "assemble",
    "recipes",
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content, "utf-8");
};

/** 标准模块 spec = assemble Recipe：addFragment（仓内 fragments/）+ writeFile（内联字面）。 */
const scaffold = (): void => {
  frag("Page.vue", "<template><h1>${title}</h1></template>\n");
  recipeFile(
    "demo-module.json5",
    `{
      id: "demo-module",
      base: { kind: "empty" },
      output: "src/modules/demo",
      render: true,
      vars: { title: "Demo" },
      ops: [
        { type: "addFragment", id: "page", source: "Page.vue", target: "Page.vue" },
        { type: "writeFile", id: "readme", target: "README.md", content: "# demo-module\\n" },
      ],
    }`,
  );
};

const ctxInit = (): { cwd: string; interactive: boolean } => ({
  cwd: repo,
  interactive: false,
});

describe("[T3] treeHandler", () => {
  it("build：gitRoot 锚定 → 产物落 gitRoot 内 + manifest 写入 + exitCode 0", async () => {
    scaffold();
    const res = await treeHandler({ action: "build" }, ctxInit());
    expect(res.exitCode).toBe(0);
    const outDir = path.join(repo, "src", "modules", "demo");
    expect(fs.readFileSync(path.join(outDir, "Page.vue"), "utf-8")).toBe(
      "<template><h1>Demo</h1></template>\n",
    );
    expect(fs.readFileSync(path.join(outDir, "README.md"), "utf-8")).toBe(
      "# demo-module\n",
    );
    const manifestPath = path.join(
      repo,
      ".done-coding",
      "generator",
      "assemble",
      "manifests",
      "demo-module.json",
    );
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it("幂等：build 二次 → check 无漂移 exitCode 0", async () => {
    scaffold();
    await treeHandler({ action: "build" }, ctxInit());
    await treeHandler({ action: "build" }, ctxInit());
    const res = await treeHandler({ action: "check" }, ctxInit());
    expect(res.exitCode).toBe(0);
  });

  it("check：手改产物 → 漂移 exitCode 1；还原 → 通过", async () => {
    scaffold();
    await treeHandler({ action: "build" }, ctxInit());
    const target = path.join(repo, "src", "modules", "demo", "Page.vue");
    fs.writeFileSync(target, "tampered", "utf-8");
    const drift = await treeHandler({ action: "check" }, ctxInit());
    expect(drift.exitCode).toBe(1);
    expect((drift.payload as DriftResult[])[0].drifted).toBe(true);

    fs.writeFileSync(target, "<template><h1>Demo</h1></template>\n", "utf-8");
    const ok = await treeHandler({ action: "check" }, ctxInit());
    expect(ok.exitCode).toBe(0);
  });

  it("非 git 仓（plain tmpdir）→ build fail-loud", async () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), "tree-nogit-"));
    try {
      await expect(
        treeHandler({ action: "build" }, { cwd: plain, interactive: false }),
      ).rejects.toThrow(/不在 git 仓内/);
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  it("gitRoot 锚定：ctxInit.cwd=仓内子目录 → 产物落 gitRoot 而非子目录", async () => {
    scaffold();
    const sub = path.join(repo, "apps", "web");
    fs.mkdirSync(sub, { recursive: true });
    const res = await treeHandler(
      { action: "build" },
      { cwd: sub, interactive: false },
    );
    expect(res.exitCode).toBe(0);
    expect(
      fs.existsSync(path.join(repo, "src", "modules", "demo", "Page.vue")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(sub, "src", "modules", "demo", "Page.vue")),
    ).toBe(false);
  });

  it("resolveGitRoot：仓内任意 cwd 返回仓根绝对路径（realpath，macOS /tmp→/private/tmp）", async () => {
    const sub = path.join(repo, "apps", "web");
    fs.mkdirSync(sub, { recursive: true });
    expect(resolveGitRoot(sub)).toBe(fs.realpathSync(repo));
  });

  it("[T5 ⓔ] 模板资产根：addFragment source=<base>/<template>/fragments/<file> 就近解析 templates 根", async () => {
    // 项目层 `.done-coding/templates/admin-core/list-page/fragments/`
    const tplFrag = path.join(
      repo,
      ".done-coding",
      "templates",
      "admin-core",
      "list-page",
      "fragments",
    );
    fs.mkdirSync(tplFrag, { recursive: true });
    fs.writeFileSync(
      path.join(tplFrag, "Index.vue.vm"),
      "<template><h1>${title}</h1></template>\n",
      "utf-8",
    );
    fs.writeFileSync(
      path.join(
        repo,
        ".done-coding",
        "templates",
        "admin-core",
        "list-page",
        "schema.json",
      ),
      JSON.stringify({
        whenToUse: "标准列表页",
        params: { type: "object", properties: { title: { type: "string" } } },
      }),
      "utf-8",
    );
    recipeFile(
      "tpl-module.json5",
      `{
        id: "tpl-module",
        base: { kind: "empty" },
        output: "src/modules/tpl",
        render: true,
        vars: { title: "TPL" },
        ops: [
          { type: "addFragment", id: "page", source: "admin-core/list-page/fragments/Index.vue.vm", target: "Index.vue" },
        ],
      }`,
    );

    const res = await treeHandler({ action: "build" }, ctxInit());
    expect(res.exitCode).toBe(0);
    const outDir = path.join(repo, "src", "modules", "tpl");
    expect(fs.readFileSync(path.join(outDir, "Index.vue"), "utf-8")).toBe(
      "<template><h1>TPL</h1></template>\n",
    );
    // 漂移闸仍生效（产物来自 templates 根，check 无漂移）
    const check = await treeHandler({ action: "check" }, ctxInit());
    expect(check.exitCode).toBe(0);
  });
});
