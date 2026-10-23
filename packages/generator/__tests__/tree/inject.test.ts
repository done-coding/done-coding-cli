/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * [T4] treeHandler 注入编排单测：页面 build + 注入同落（路由 patched + 页面文件 + manifest）/
 * 原子性（注入 compute 失败 → 页面/注入均零落盘）/ check 只门页面漂移（注入块内篡改出范围）/
 * 幂等重 build 单块 / 模块 spec 允许集外 op fail-loud。
 * server-agnostic（ctxInit.cwd 注入）；沙盒：tmpdir git 仓 + afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { treeHandler } from "@/handlers/tree";
import { unregisterAll } from "@/assemble/registry";
import type { DriftResult } from "@/assemble/engine";

let repo: string;
beforeEach(() => {
  unregisterAll();
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "tree-inject-"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
});
afterEach(() => {
  unregisterAll();
  fs.rmSync(repo, { recursive: true, force: true });
});

const write = (rel: string, content: string): void => {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

const frag = (rel: string, content: string): void =>
  write(
    path.join(".done-coding", "generator", "assemble", "fragments", rel),
    content,
  );

const recipeFile = (name: string, content: string): void =>
  write(
    path.join(".done-coding", "generator", "assemble", "recipes", name),
    content,
  );

const ctxInit = (): { cwd: string; interactive: boolean } => ({
  cwd: repo,
  interactive: false,
});

/** 既有路由文件 + 页面模板 + 注入源 + 含 textPatch 的模块 spec。 */
const scaffold = (): void => {
  write("src/router/index.ts", "import x\nconst routes = []\n");
  frag("Page.vue", "<template><h1>${title}</h1></template>\n");
  frag("route.ts", "import Home from '@/views/Home.vue'\n");
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
        { type: "textPatch", id: "route", markerKey: "home-route", source: "route.ts", target: "src/router/index.ts", anchor: { pattern: "const routes = []", position: "after" } },
      ],
    }`,
  );
};

describe("[T4] treeHandler 注入编排", () => {
  it("页面 build + 注入同落：路由 patched + 页面文件 + manifest", async () => {
    scaffold();
    const res = await treeHandler({ action: "build" }, ctxInit());
    expect(res.exitCode).toBe(0);
    expect(
      fs.readFileSync(
        path.join(repo, "src", "modules", "demo", "Page.vue"),
        "utf-8",
      ),
    ).toBe("<template><h1>Demo</h1></template>\n");
    const router = fs.readFileSync(
      path.join(repo, "src", "router", "index.ts"),
      "utf-8",
    );
    expect(router).toContain("// === dc-generator:start:home-route ===");
    expect(router).toContain("import Home from '@/views/Home.vue'");
    expect(router).toContain("// === dc-generator:end:home-route ===");
    expect(
      fs.existsSync(
        path.join(
          repo,
          ".done-coding",
          "generator",
          "assemble",
          "manifests",
          "demo-module.json",
        ),
      ),
    ).toBe(true);
  });

  it("幂等：重 build → 注入单块 + 页面无漂移（check exitCode 0）", async () => {
    scaffold();
    await treeHandler({ action: "build" }, ctxInit());
    await treeHandler({ action: "build" }, ctxInit());
    const router = fs.readFileSync(
      path.join(repo, "src", "router", "index.ts"),
      "utf-8",
    );
    expect(router.match(/=== dc-generator:start:home-route ===/g)?.length).toBe(
      1,
    );
    const res = await treeHandler({ action: "check" }, ctxInit());
    expect(res.exitCode).toBe(0);
  });

  it("原子性：注入 compute 失败（锚点多命中）→ 页面零落盘 + 注入零写 + 无 manifest", async () => {
    // 路由文件含两个相同锚点 → computeInjections 抛错（先于页面 build，ⓒ-5 顺序①）
    write("src/router/index.ts", "const routes = []\nconst routes = []\n");
    frag("Page.vue", "<template><h1>${title}</h1></template>\n");
    frag("route.ts", "X");
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
          { type: "textPatch", id: "route", markerKey: "home-route", source: "route.ts", target: "src/router/index.ts", anchor: { pattern: "const routes = []", position: "after" } },
        ],
      }`,
    );
    await expect(treeHandler({ action: "build" }, ctxInit())).rejects.toThrow(
      /多命中/,
    );
    // 页面未落（runBuild 未执行）
    expect(
      fs.existsSync(path.join(repo, "src", "modules", "demo", "Page.vue")),
    ).toBe(false);
    // 注入未落（原路由文件原样）
    expect(
      fs.readFileSync(path.join(repo, "src", "router", "index.ts"), "utf-8"),
    ).toBe("const routes = []\nconst routes = []\n");
    // manifest 未写
    expect(
      fs.existsSync(
        path.join(
          repo,
          ".done-coding",
          "generator",
          "assemble",
          "manifests",
          "demo-module.json",
        ),
      ),
    ).toBe(false);
  });

  it("check 只门页面漂移：篡改页面 → fail；篡改注入块内 → 出范围不报", async () => {
    scaffold();
    await treeHandler({ action: "build" }, ctxInit());
    // 注入块内篡改（marker 幂等域，非 manifest 产物）→ check 通过（ⓔ 已知边界）
    const routerPath = path.join(repo, "src", "router", "index.ts");
    const tamperedRouter = fs
      .readFileSync(routerPath, "utf-8")
      .replace(
        "import Home from '@/views/Home.vue'",
        "import Tampered from '@/x.vue'",
      );
    fs.writeFileSync(routerPath, tamperedRouter, "utf-8");
    const okAfterInjectTamper = await treeHandler(
      { action: "check" },
      ctxInit(),
    );
    expect(okAfterInjectTamper.exitCode).toBe(0);

    // 页面文件篡改 → check fail（exitCode 1）
    fs.writeFileSync(
      path.join(repo, "src", "modules", "demo", "Page.vue"),
      "tampered",
      "utf-8",
    );
    const drift = await treeHandler({ action: "check" }, ctxInit());
    expect(drift.exitCode).toBe(1);
    expect((drift.payload as DriftResult[])[0].drifted).toBe(true);
  });

  it("模块 spec 允许集外 op（jsonMerge）→ fail-loud", async () => {
    write("src/router/index.ts", "A\n");
    frag("Page.vue", "<template>X</template>\n");
    write("conf.json", "{}");
    recipeFile(
      "bad.json5",
      `{
        id: "bad",
        base: { kind: "empty" },
        output: "src/modules/bad",
        ops: [
          { type: "addFragment", id: "page", source: "Page.vue", target: "Page.vue" },
          { type: "jsonMerge", id: "m", source: "conf.json", target: "conf.json" },
        ],
      }`,
    );
    await expect(treeHandler({ action: "build" }, ctxInit())).rejects.toThrow(
      /不在允许集/,
    );
  });

  it("模块配方携带 createTemplate → fail-loud（不静默丢弃 createSync）", async () => {
    // 控制器裁决：createTemplate 仅项目级模板配方适用，模块配方不同步 create templateList
    write("src/router/index.ts", "A\n");
    frag("Page.vue", "<template>X</template>\n");
    write("create.config.json", "{}");
    recipeFile(
      "proj-template.json5",
      `{
        id: "proj-template",
        base: { kind: "empty" },
        output: "src/modules/t",
        ops: [
          { type: "addFragment", id: "page", source: "Page.vue", target: "Page.vue" },
        ],
        createTemplate: { name: "t", configPath: "create.config.json" },
      }`,
    );
    await expect(treeHandler({ action: "build" }, ctxInit())).rejects.toThrow(
      /不支持 createTemplate/,
    );
    // 页面零落盘（guard 先于 buildOne 任何落盘）
    expect(
      fs.existsSync(path.join(repo, "src", "modules", "t", "Page.vue")),
    ).toBe(false);
  });
});
