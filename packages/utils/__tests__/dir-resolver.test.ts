import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDoneCodingDir, listDoneCodingDirs } from "@/dir-resolver";

/**
 * 全部夹具落临时目录（mkdtempSync），afterEach 清理。
 * global 层用 fake HOME（opts.home 指向临时目录），[MUST NOT] 污染真实 ~/.done-coding。
 */

const tmpRoots: string[] = [];

const mkTmp = (prefix = "dc-resolver-"): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  // macOS /var → /private/var 软链，统一 realpath 便于断言相等
  const real = fs.realpathSync(dir);
  tmpRoots.push(real);
  return real;
};

/** 在 <base>/.done-coding/<segment>/ 造一个批次目录，返回该目录绝对路径 */
const mkSegment = (
  base: string,
  segment: string,
  namespace = ".done-coding",
): string => {
  const dir = path.join(base, namespace, segment);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

afterEach(() => {
  while (tmpRoots.length) {
    const dir = tmpRoots.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveDoneCodingDir — 就近优先 + 整体覆盖", () => {
  it("三层同名 segment → 就近(project)层命中、整体覆盖", () => {
    // parent/child 形成 cwd 链；fake HOME 为独立临时目录充当 global
    const parent = mkTmp();
    const cwd = path.join(parent, "child");
    fs.mkdirSync(cwd, { recursive: true });
    const home = mkTmp("dc-home-");

    const projectDir = mkSegment(cwd, "component");
    mkSegment(parent, "component");
    mkSegment(home, "component");

    const hit = resolveDoneCodingDir("component", { cwd, home });
    expect(hit).toBeDefined();
    expect(hit!.layer).toBe("project");
    expect(hit!.dir).toBe(projectDir);
    expect(hit!.segment).toBe("component");
    expect(hit!.shadowed).toBe(false);
    // 整体覆盖：只返回单层目录，不与父/全局合并
    expect(hit!.namespaceDir).toBe(path.join(cwd, ".done-coding"));
  });

  it("project 缺失 → 落到 parent 层", () => {
    const parent = mkTmp();
    const cwd = path.join(parent, "child");
    fs.mkdirSync(cwd, { recursive: true });
    const home = mkTmp("dc-home-");

    const parentDir = mkSegment(parent, "page");

    const hit = resolveDoneCodingDir("page", { cwd, home });
    expect(hit!.layer).toBe("parent");
    expect(hit!.dir).toBe(parentDir);
  });

  it("仅 global(fake HOME) 命中 → layer=global", () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    const globalDir = mkSegment(home, "widget");

    const hit = resolveDoneCodingDir("widget", { cwd, home });
    expect(hit!.layer).toBe("global");
    expect(hit!.dir).toBe(globalDir);
  });

  it("缺失 segment → 返回 undefined", () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    const hit = resolveDoneCodingDir("nope", { cwd, home });
    expect(hit).toBeUndefined();
  });

  it("自定义 namespace 生效", () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    const dir = mkSegment(cwd, "component", ".custom-ns");
    const hit = resolveDoneCodingDir("component", {
      cwd,
      home,
      namespace: ".custom-ns",
    });
    expect(hit!.dir).toBe(dir);
  });
});

describe("listDoneCodingDirs — 并集 + layer + 遮蔽标注", () => {
  it("同名 segment 跨层 → 并集，就近命中有效、其余 shadowed + shadowedBy", () => {
    const parent = mkTmp();
    const cwd = path.join(parent, "child");
    fs.mkdirSync(cwd, { recursive: true });
    const home = mkTmp("dc-home-");

    mkSegment(cwd, "component");
    mkSegment(parent, "component");
    mkSegment(home, "component");

    const hits = listDoneCodingDirs("component", { cwd, home });
    expect(hits).toHaveLength(3);

    const byLayer = Object.fromEntries(hits.map((h) => [h.layer, h]));
    expect(byLayer.project.shadowed).toBe(false);
    expect(byLayer.parent.shadowed).toBe(true);
    expect(byLayer.global.shadowed).toBe(true);
    // 遮蔽者均指向就近 project 命中
    expect(byLayer.parent.shadowedBy).toBe(byLayer.project);
    expect(byLayer.global.shadowedBy).toBe(byLayer.project);
  });

  it('segment="*" → 枚举各层全部批次，跳过隐藏目录', () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    mkSegment(cwd, "component");
    mkSegment(cwd, "page");
    // 隐藏目录应被跳过
    fs.mkdirSync(path.join(cwd, ".done-coding", ".hidden"), {
      recursive: true,
    });
    mkSegment(home, "widget");

    const hits = listDoneCodingDirs("*", { cwd, home });
    const segs = hits.map((h) => h.segment).sort();
    // resolver 按设计 §5.1 会向上走 cwd 祖先链，临时目录之上（如 $TMPDIR）若存在真实
    // .done-coding 会被合法枚举进来。本用例只断言「本夹具造的 segment 全部出现」+「隐藏目录被跳过」，
    // 不对祖先链上的环境态做全等断言（那会让用例耦合宿主机磁盘状态）。
    expect(segs).toEqual(
      expect.arrayContaining(["component", "page", "widget"]),
    );
    expect(segs).not.toContain(".hidden");
  });
});

describe("错误聚合 + 软链（M6/M7）", () => {
  it("缺失 segment → list 返回空数组（无命中即无错误）", () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    const hits = listDoneCodingDirs("ghost", { cwd, home });
    expect(hits).toEqual([]);
  });

  it("悬空软链 segment → list-all 不中断、errors 聚合在该 hit 上", () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    const ns = path.join(cwd, ".done-coding");
    fs.mkdirSync(ns, { recursive: true });
    // 一个正常批次 + 一个指向不存在目标的软链批次
    mkSegment(cwd, "ok");
    fs.symlinkSync(path.join(cwd, "no-such-target"), path.join(ns, "broken"));

    const hits = listDoneCodingDirs("*", { cwd, home });
    const broken = hits.find((h) => h.segment === "broken");
    const ok = hits.find((h) => h.segment === "ok");
    expect(ok).toBeDefined();
    expect(ok!.errors).toBeUndefined();
    expect(broken).toBeDefined();
    expect(broken!.errors?.length).toBeGreaterThan(0);
  });

  it("软链 segment 指向真实目录 → realDir 解析到目标真实路径", () => {
    const cwd = mkTmp();
    const home = mkTmp("dc-home-");
    const ns = path.join(cwd, ".done-coding");
    fs.mkdirSync(ns, { recursive: true });

    // 真实目标在 cwd 外
    const target = mkTmp("dc-link-target-");
    const linkPath = path.join(ns, "linked");
    fs.symlinkSync(target, linkPath);

    const hit = resolveDoneCodingDir("linked", { cwd, home });
    expect(hit).toBeDefined();
    expect(hit!.dir).toBe(linkPath);
    // realDir 解析软链后 = 目标真实路径
    expect(hit!.realDir).toBe(fs.realpathSync(target));
    expect(hit!.errors).toBeUndefined();
  });
});
