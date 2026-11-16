import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCatalog,
  catalogScopes,
  checkCatalog,
  inspectInstalled,
  type Fetcher,
} from "@/core/catalog";
import { cleanup, makeRepo } from "./helpers";

const REGISTRY = "https://registry.test";

/** 假 npm 源：本包定组织与维护者，检索结果含组织外的包与弃用包 */
const manifests: Record<string, any> = {
  "@acme/cli-harness": {
    version: "1.0.0",
    repository: { url: "git+https://github.com/acme/acme-cli.git" },
    maintainers: [{ name: "me", email: "me@x" }],
    description: "治理工具",
  },
  "@acme/ui": {
    version: "2.0.0",
    description: "UI 统一入口",
    repository: { url: "git+https://github.com/acme/acme-ui.git" },
    dependencies: { "@acme/ui-core": "2.0.0", "@acme/ui-form": "2.0.0" },
  },
  "@acme/ui-core": {
    version: "2.0.0",
    description: "底座",
    repository: { url: "https://github.com/acme/acme-ui" },
  },
  "@acme/ui-form": {
    version: "2.0.0",
    description: "表单",
    repository: "github.com/acme/acme-ui",
    dependencies: { "@acme/ui-core": "2.0.0" },
  },
  "@acme/ui-kit": {
    version: "2.0.0",
    description: "",
    repository: { url: "git+https://github.com/acme/acme-ui.git" },
    peerDependencies: { "@acme/ui": "2.0.0" },
  },
  "@acme/req-base": {
    version: "0.3.0",
    description: "请求基座",
    repository: { url: "git+https://github.com/acme/acme-request.git" },
    deprecated: "改用 req-next",
  },
  "@other/x": {
    version: "1.0.0",
    description: "组织外",
    repository: { url: "git+https://github.com/other/x.git" },
  },
};

const fakeFetcher: Fetcher = async (url) => {
  if (url.includes("/-/v1/search")) {
    expect(url).toContain(encodeURIComponent("maintainer:me"));
    return {
      total: 7,
      objects: Object.keys(manifests).map((name) => ({
        package: { name, date: "2026-11-01T00:00:00.000Z" },
      })),
    };
  }
  const name = decodeURIComponent(
    url.slice(REGISTRY.length + 1).replace(/\/latest$/, ""),
  );
  if (!manifests[name]) throw new Error(`HTTP 404 ${url}`);
  return manifests[name];
};

let dirs: string[] = [];
afterEach(() => {
  cleanup(...dirs);
  dirs = [];
});

/** 注册表 + 一个本机仓：npm 工作区包（private 但带 publishConfig）、应用、Python 包与模板占位 */
const setupLocal = (extra: Record<string, string> = {}): string => {
  const repo = makeRepo({
    "package.json": '{ "name": "acme-identity", "private": true }\n',
    "pnpm-workspace.yaml":
      "packages:\n  - 'frontend/packages/**'\n  - 'frontend/apps/**'\n",
    "frontend/packages/login/package.json": JSON.stringify({
      name: "@acme-creating/login",
      version: "0.1.0",
      private: true,
      description: "登录 SDK",
      publishConfig: { registry: "http://127.0.0.1:4873/" },
    }),
    "frontend/packages/login/README.md": "# login\n",
    "frontend/apps/admin/package.json":
      '{ "name": "admin", "private": true }\n',
    "backend/packages/verify/pyproject.toml":
      '[project]\nname = "acme-verify"\nversion = "0.4.0"\ndescription = "验票"\n',
    "backend/services/svc/pyproject.toml":
      '[project]\nname = "acme-svc"\nversion = "0.0.0"\n',
    // 模板占位名应被跳过
    "templates/packages/tpl/pyproject.toml":
      // eslint-disable-next-line no-template-curly-in-string -- 字面 `${}` 是模板占位，非 JS 模板串
      '[project]\nname = "${organization}-${name}"\n',
    ...extra,
  });
  const scope = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-"));
  const key = repo.replace(/[^a-zA-Z0-9]/g, "-");
  fs.mkdirSync(path.join(scope, key));
  fs.writeFileSync(
    path.join(scope, key, "repo.json"),
    JSON.stringify({
      name: "acme-identity",
      path: repo,
      positioning: "统一身份",
      accepts: null,
      governance: null,
    }),
  );
  dirs.push(repo, scope);
  return scope;
};

describe("buildCatalog：npm 已发布 + 注册表本机仓", () => {
  it("按组织过滤、按仓分系列，给出聚合 / 已含 / 需单独装 / 须搭配", async () => {
    const scopeDir = setupLocal();
    const catalog = await buildCatalog({
      selfName: "@acme/cli-harness",
      registry: REGISTRY,
      fetcher: fakeFetcher,
      scopeDir,
    });
    expect(catalog.npm).toEqual({
      state: "ok",
      registry: REGISTRY,
      failures: [],
    });
    expect(
      catalog.series.map((s) => [s.name, s.overview, s.overviewSource]),
    ).toEqual([
      ["acme-cli", undefined, undefined],
      ["acme-identity", "统一身份", "registry"],
      ["acme-request", undefined, undefined],
      ["acme-ui", "UI 统一入口", "aggregate"],
    ]);
    const ui = catalog.series.find((s) => s.name === "acme-ui")!.packages;
    expect(ui.map((p) => [p.name, p.bundles, p.includedIn, p.peers])).toEqual([
      ["@acme/ui", ["@acme/ui-core", "@acme/ui-form"], [], []],
      ["@acme/ui-core", [], ["@acme/ui"], []],
      ["@acme/ui-form", ["@acme/ui-core"], ["@acme/ui"], []],
      ["@acme/ui-kit", [], [], ["@acme/ui"]],
    ]);
    const local = catalog.series.find((s) => s.name === "acme-identity")!;
    expect(
      local.packages.map((p) => [
        p.name,
        p.ecosystem,
        p.localVersion,
        p.registry,
        path.basename(p.docs),
      ]),
    ).toEqual([
      [
        "@acme-creating/login",
        "npm",
        "0.1.0",
        "http://127.0.0.1:4873/",
        "README.md",
      ],
      ["acme-verify", "python", "0.4.0", undefined, "pyproject.toml"],
    ]);
    expect(
      catalog.series.find((s) => s.name === "acme-request")!.packages[0]
        .deprecated,
    ).toBe("改用 req-next");
  });

  it("--check：缺概述 / 缺描述 / 本机落后 npm 即报；离线报未比对", async () => {
    const scopeDir = setupLocal({
      "frontend/packages/core/package.json": JSON.stringify({
        name: "@acme/ui-core",
        version: "1.9.0",
        description: "底座",
      }),
    });
    const catalog = await buildCatalog({
      selfName: "@acme/cli-harness",
      registry: REGISTRY,
      fetcher: fakeFetcher,
      scopeDir,
    });
    const problems = checkCatalog(catalog);
    expect(problems.map((p) => p.replace(/（.*$/, ""))).toEqual([
      "系列 acme-cli 缺概述：仓未登记仓库注册表，也没有同名聚合包",
      "系列 acme-request 缺概述：仓未登记仓库注册表，也没有同名聚合包",
      "@acme/ui-core 本机 1.9.0 落后 npm 2.0.0",
      "@acme/ui-kit 缺 description",
    ]);

    const offline = await buildCatalog({
      selfName: "@acme/cli-harness",
      registry: REGISTRY,
      fetcher: async () => {
        throw new Error("fetch failed");
      },
      scopeDir,
    });
    expect(offline.npm.state).toBe("offline");
    expect(checkCatalog(offline)[0]).toBe(
      "npm 未比对（取数失败：fetch failed），已发布版本与本机克隆无法核对",
    );
    expect(offline.series.map((s) => s.name)).toEqual(["acme-identity"]);
  });

  it("单包清单读取失败只记入 failures，不拖垮整源", async () => {
    const scopeDir = setupLocal();
    const catalog = await buildCatalog({
      selfName: "@acme/cli-harness",
      registry: REGISTRY,
      fetcher: async (url) => {
        if (url.includes("ui-kit")) throw new Error("ECONNRESET");
        return fakeFetcher(url);
      },
      scopeDir,
    });
    expect(catalog.npm.state).toBe("ok");
    expect(catalog.npm.failures).toEqual(["@acme/ui-kit（ECONNRESET）"]);
    expect(checkCatalog(catalog)).toContain(
      "npm 清单读取失败：@acme/ui-kit（ECONNRESET）",
    );
  });
});

describe("inspectInstalled：当前项目装了哪些、同版本系列是否一致", () => {
  it("同版本发布的系列装得不一致即提示；独立定版的系列不提示", async () => {
    const scopeDir = setupLocal();
    const catalog = await buildCatalog({
      selfName: "@acme/cli-harness",
      registry: REGISTRY,
      fetcher: fakeFetcher,
      scopeDir,
    });
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "harness-proj-"));
    dirs.push(project);
    const write = (rel: string, json: unknown) => {
      fs.mkdirSync(path.dirname(path.join(project, rel)), { recursive: true });
      fs.writeFileSync(path.join(project, rel), JSON.stringify(json));
    };
    write("package.json", {
      dependencies: { "@acme/ui": "^2.0.0", "@acme/ui-kit": "^1.0.0" },
      devDependencies: { "@acme/cli-harness": "1.0.0" },
    });
    write("node_modules/@acme/ui/package.json", { version: "2.0.0" });
    write("node_modules/@acme/ui-kit/package.json", { version: "1.5.0" });
    const { rows, warnings } = inspectInstalled(project, catalog);
    expect(rows.map((r) => [r.name, r.declared, r.installed])).toEqual([
      ["@acme/cli-harness", "1.0.0", undefined],
      ["@acme/ui", "^2.0.0", "2.0.0"],
      ["@acme/ui-kit", "^1.0.0", "1.5.0"],
    ]);
    expect(warnings).toEqual([
      "系列 acme-ui 各包同版本发布，当前项目装的版本不一致：@acme/ui@2.0.0、@acme/ui-kit@1.5.0",
    ]);
  });

  it("npm 未比对：按本包与本机仓的作用域补列项目依赖，系列取包内 repository，并写明未核对", async () => {
    const scopeDir = setupLocal();
    const offline = await buildCatalog({
      selfName: "@acme/cli-harness",
      registry: REGISTRY,
      fetcher: async () => {
        throw new Error("fetch failed");
      },
      scopeDir,
    });
    const scopes = catalogScopes(offline, "@acme/cli-harness");
    expect(scopes).toEqual(["@acme", "@acme-creating"]);
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "harness-proj-"));
    dirs.push(project);
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ dependencies: { "@acme/ui": "^2.0.0", vue: "^3" } }),
    );
    fs.mkdirSync(path.join(project, "node_modules/@acme/ui"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(project, "node_modules/@acme/ui/package.json"),
      JSON.stringify({
        version: "2.0.0",
        repository: { url: "git+https://github.com/acme/acme-ui.git" },
      }),
    );
    const { rows, warnings } = inspectInstalled(project, offline, scopes);
    expect(rows).toEqual([
      {
        name: "@acme/ui",
        series: "acme-ui",
        declared: "^2.0.0",
        installed: "2.0.0",
      },
    ]);
    expect(warnings).toEqual([
      "npm 未比对：目录外的依赖按作用域 @acme、@acme-creating 补列，最新版本与同系列版本一致性未核对",
    ]);
  });
});
