import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRegistryPath,
  listInstances,
  pruneInstances,
  readRegistry,
  recordCreateInstance,
} from "../src/utils/instances-registry";

/**
 * 中央实例注册表单测（沙盒）。
 * ---
 * 每例用 os.tmpdir 建临时 baseDir 注入，[MUST NOT] 碰真实 ~/.done-coding。
 * 覆盖：record/upsert/list-missing/prune/原子完整性/失败不抛（R1/R3/R4/R5/R7）。
 */
describe("instances-registry", () => {
  let baseDir: string;
  /** 在沙盒里造一个"已存在的项目目录"，返回其绝对路径 */
  const makeProjectDir = (name: string) => {
    const p = path.resolve(baseDir, "projects", name);
    mkdirSync(p, { recursive: true });
    return p;
  };

  beforeEach(() => {
    baseDir = mkdtempSync(path.join(tmpdir(), "dc-create-instances-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("record 后注册表出现该条，字段正确 (R1/R6)", () => {
    const projectPath = makeProjectDir("proj-a");
    recordCreateInstance(
      {
        path: projectPath,
        template: "admin-app-vue3-member",
        templateUrl: "https://example.com/repo.git",
        templateBranch: "main",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
      baseDir,
    );

    const registry = readRegistry(baseDir);
    expect(registry.instances).toHaveLength(1);
    expect(registry.instances[0]).toMatchObject({
      path: projectPath,
      template: "admin-app-vue3-member",
      templateUrl: "https://example.com/repo.git",
      templateBranch: "main",
      createdAt: "2026-06-24T00:00:00.000Z",
    });
    // R6：无业务敏感字段
    expect(Object.keys(registry.instances[0]).sort()).toEqual(
      ["createdAt", "path", "template", "templateBranch", "templateUrl"].sort(),
    );
  });

  it("同 path 二次 record = upsert，不堆重复 (R5)", () => {
    const projectPath = makeProjectDir("proj-a");
    recordCreateInstance(
      {
        path: projectPath,
        template: "tpl-old",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
      baseDir,
    );
    recordCreateInstance(
      {
        path: projectPath,
        template: "tpl-new",
        createdAt: "2026-06-24T01:00:00.000Z",
      },
      baseDir,
    );

    const registry = readRegistry(baseDir);
    expect(registry.instances).toHaveLength(1);
    expect(registry.instances[0].template).toBe("tpl-new");
    expect(registry.instances[0].createdAt).toBe("2026-06-24T01:00:00.000Z");
  });

  it("不同 path → listInstances 列出全部，标 missing (R3)", () => {
    const a = makeProjectDir("proj-a");
    const b = makeProjectDir("proj-b");
    recordCreateInstance(
      { path: a, template: "ta", createdAt: "2026-06-24T00:00:00.000Z" },
      baseDir,
    );
    recordCreateInstance(
      { path: b, template: "tb", createdAt: "2026-06-24T00:00:00.000Z" },
      baseDir,
    );

    // 删掉 b 对应目录 → 该条应标 missing
    rmSync(b, { recursive: true, force: true });

    const list = listInstances(baseDir);
    expect(list).toHaveLength(2);
    expect(list.find((r) => r.path === a)?.missing).toBe(false);
    expect(list.find((r) => r.path === b)?.missing).toBe(true);
  });

  it("prune 移除失效条目、保留存在条目，返回计数 (R4)", () => {
    const a = makeProjectDir("proj-a");
    const b = makeProjectDir("proj-b");
    recordCreateInstance(
      { path: a, template: "ta", createdAt: "2026-06-24T00:00:00.000Z" },
      baseDir,
    );
    recordCreateInstance(
      { path: b, template: "tb", createdAt: "2026-06-24T00:00:00.000Z" },
      baseDir,
    );
    rmSync(b, { recursive: true, force: true });

    const result = pruneInstances(baseDir);
    expect(result.removed).toBe(1);
    expect(result.kept).toBe(1);

    const registry = readRegistry(baseDir);
    expect(registry.instances).toHaveLength(1);
    expect(registry.instances[0].path).toBe(a);
  });

  it("注册表损坏/不存在 → readRegistry 回落空、不抛", () => {
    expect(readRegistry(baseDir).instances).toEqual([]);
    // 写入损坏内容
    const registryPath = getRegistryPath(baseDir);
    mkdirSync(path.dirname(registryPath), { recursive: true });
    writeFileSync(registryPath, "{ not json ");
    expect(readRegistry(baseDir).instances).toEqual([]);
  });

  it("record 写入失败 → 不抛异常，不影响主流程 (R7)", () => {
    // 用文件占位注册表所在的父目录链，使 mkdir/写入失败
    const blocker = path.resolve(baseDir, ".done-coding");
    // 把 .done-coding 造成一个文件（而非目录）→ 其下 create/ 无法创建
    writeFileSync(blocker, "i am a file, not a dir");

    expect(() =>
      recordCreateInstance(
        {
          path: makeProjectDir("proj-a"),
          template: "ta",
          createdAt: "2026-06-24T00:00:00.000Z",
        },
        baseDir,
      ),
    ).not.toThrow();
    // 注册表确实没写成
    expect(existsSync(getRegistryPath(baseDir))).toBe(false);
  });

  it("原子写：record 后文件完整可解析", () => {
    const a = makeProjectDir("proj-a");
    recordCreateInstance(
      { path: a, template: "ta", createdAt: "2026-06-24T00:00:00.000Z" },
      baseDir,
    );
    const registryPath = getRegistryPath(baseDir);
    expect(existsSync(registryPath)).toBe(true);
    // 不残留 tmp 文件
    const dir = path.dirname(registryPath);
    const leftovers = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.includes(".tmp-"))
      : [];
    expect(leftovers).toEqual([]);
  });
});
