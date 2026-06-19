/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * [C1] engine 集成测试：runPlan/runBuild/runDiff + --all output 冲突校验。
 *  - build：拼装产物落 output + manifest；二次 build 孤儿删除。
 *  - diff/check：无改动 drift=false；改产物 drift=true（content/orphan/mode）。
 *  - 拼装↔裁剪双向产物逐字节一致（A2 子集，纯文本 + jsonMerge）。
 * 沙盒：fixtures 落 os.tmpdir() + afterEach 清理（项目 CLAUDE.md 铁律）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Recipe } from "@/assemble/types";
import {
  assertOutputsCompatible,
  runBuild,
  runDiff,
  runPlan,
  type EngineCtx,
} from "@/assemble/engine";
import { readManifest } from "@/assemble/vfs";
import { unregisterAll } from "@/assemble/registry";

let root: string;
let ctx: EngineCtx;
beforeEach(() => {
  unregisterAll();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-"));
  ctx = { cwd: root };
});
afterEach(() => {
  unregisterAll();
  fs.rmSync(root, { recursive: true, force: true });
});

/** 在 fragmentRoot 下写碎片文件。 */
const frag = (rel: string, content: string): void => {
  const abs = path.join(root, "assemble", "fragments", rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

const outAbs = (rel: string): string => path.join(root, rel);

describe("[C1] runPlan", () => {
  it("plan 返回有序计划（dry-run，不写盘）", () => {
    frag("a.txt", "A=${name}");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      vars: { name: "x" },
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    const p = runPlan(recipe, ctx);
    expect(p.items.map((i) => i.id)).toEqual(["a"]);
    expect(fs.existsSync(outAbs("out"))).toBe(false);
  });

  it("plan 删不存在 → fail-loud", () => {
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [{ type: "deleteFile", id: "d", target: "ghost.txt" }],
    };
    expect(() => runPlan(recipe, ctx)).toThrow(/不存在/);
  });
});

describe("[C1] runBuild", () => {
  it("拼装：渲染落地 output + 写 manifest", () => {
    frag("readme.md", "# ${title}");
    frag("pkg/package.json", '{"name":"${name}","version":"1.0.0"}');
    const recipe: Recipe = {
      id: "foo",
      base: { kind: "empty" },
      output: "out/foo",
      render: true,
      vars: { title: "Foo", name: "foo" },
      ops: [
        {
          type: "addFragment",
          id: "rm",
          source: "readme.md",
          target: "README.md",
        },
        {
          type: "addFragment",
          id: "pk",
          source: "pkg/package.json",
          target: "package.json",
        },
      ],
    };
    const res = runBuild(recipe, ctx);
    expect(fs.readFileSync(outAbs("out/foo/README.md"), "utf-8")).toBe("# Foo");
    expect(res.files).toContain("README.md");
    const mf = readManifest(root, "foo");
    expect(mf?.files).toContain("package.json");
  });

  it('回归：addFragment target:"." 铺根 + jsonMerge 同文件 → base 保留不静默覆盖（VFS 键归一）', () => {
    frag(
      "core/package.json",
      '{"name":"${name}","version":"0.0.0","main":"src/index.ts"}',
    );
    frag("core/src/index.ts", "export const hi = () => 1;");
    frag("tooling/pp.json", '{"scripts":{"lint":"eslint ."}}');
    const recipe: Recipe = {
      id: "reg",
      base: { kind: "empty" },
      output: "out/reg",
      render: true,
      vars: { name: "demo" },
      ops: [
        { type: "addFragment", id: "core", source: "core", target: "." },
        {
          type: "jsonMerge",
          id: "m",
          source: "tooling/pp.json",
          target: "package.json",
        },
      ],
    };
    runBuild(recipe, ctx);
    const pkg = JSON.parse(
      fs.readFileSync(outAbs("out/reg/package.json"), "utf-8"),
    );
    // base（addFragment 整文件）字段保留 + overlay 合并，[MUST NOT] 静默丢数据
    expect(pkg.name).toBe("demo");
    expect(pkg.version).toBe("0.0.0");
    expect(pkg.main).toBe("src/index.ts");
    expect(pkg.scripts.lint).toBe("eslint .");
    // 同一真实路径只一个 VFS 键（无 ./package.json 与 package.json 双键）
    const mf = readManifest(root, "reg");
    expect(mf?.files.filter((f) => f.endsWith("package.json"))).toEqual([
      "package.json",
    ]);
  });

  it("二次 build 删孤儿（manifest 驱动）", () => {
    frag("a.txt", "A");
    frag("b.txt", "B");
    const r1: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [
        { type: "addFragment", id: "a", source: "a.txt", target: "a.txt" },
        { type: "addFragment", id: "b", source: "b.txt", target: "b.txt" },
      ],
    };
    runBuild(r1, ctx);
    expect(fs.existsSync(outAbs("out/b.txt"))).toBe(true);
    const r2: Recipe = { ...r1, ops: [r1.ops[0]] };
    runBuild(r2, ctx);
    expect(fs.existsSync(outAbs("out/a.txt"))).toBe(true);
    expect(fs.existsSync(outAbs("out/b.txt"))).toBe(false);
  });
});

describe("[C1] runDiff / check 漂移闸（against=worktree）", () => {
  const recipe: Recipe = {
    id: "r",
    base: { kind: "empty" },
    output: "out",
    vars: { v: "1" },
    ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
  };

  beforeEach(() => frag("a.txt", "content=${v}"));

  it("build 后 diff 无漂移", () => {
    runBuild(recipe, ctx);
    const d = runDiff(recipe, ctx);
    expect(d.drifted).toBe(false);
    expect(d.entries).toHaveLength(0);
  });

  it("人为改产物 → diff content 漂移 exit 信号", () => {
    runBuild(recipe, ctx);
    fs.writeFileSync(outAbs("out/a.txt"), "tampered", "utf-8");
    const d = runDiff(recipe, ctx);
    expect(d.drifted).toBe(true);
    expect(d.entries.some((e) => e.kind === "content")).toBe(true);
  });

  it("产物多出文件 → orphan-actual 漂移", () => {
    runBuild(recipe, ctx);
    fs.writeFileSync(outAbs("out/extra.txt"), "x", "utf-8");
    const d = runDiff(recipe, ctx);
    expect(d.drifted).toBe(true);
    expect(d.entries.some((e) => e.kind === "orphan-actual")).toBe(true);
  });

  it("diff 不写盘到工作区 output（tmp 比对）", () => {
    runBuild(recipe, ctx);
    const before = fs.readFileSync(outAbs("out/a.txt"), "utf-8");
    runDiff(recipe, ctx);
    expect(fs.readFileSync(outAbs("out/a.txt"), "utf-8")).toBe(before);
  });
});

describe("[H2] output 越界守卫", () => {
  it("output 指向仓外（../escape）→ load/plan 期 fail-loud", () => {
    frag("a.txt", "A");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "../escape-out",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    expect(() => runPlan(recipe, ctx)).toThrow(/越界/);
    expect(() => runBuild(recipe, ctx)).toThrow(/越界/);
  });

  it("output 等于 cwd（.）→ fail-loud", () => {
    frag("a.txt", "A");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: ".",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    expect(() => runPlan(recipe, ctx)).toThrow(/等于 cwd/);
  });
});

describe("[实1] runBuild 可疑根守卫（修订-1，仅 build 生效）", () => {
  const buildRecipe = (): Recipe => {
    frag("a.txt", "A");
    return {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
  };

  it("cwd = 家目录本体（注入）→ runBuild throw", () => {
    const recipe = buildRecipe();
    // root 即本测试 tmp 目录，注入为家目录使其命中可疑根
    expect(() => runBuild(recipe, { cwd: root, homeDir: root })).toThrow(
      /家目录/,
    );
  });

  it("cwd = 普通项目目录 → runBuild 通过（落盘）", () => {
    const recipe = buildRecipe();
    expect(() => runBuild(recipe, ctx)).not.toThrow();
    expect(fs.existsSync(outAbs("out/a.txt"))).toBe(true);
  });

  it("allowDangerous=true → 即使家目录本体也跳过守卫", () => {
    const recipe = buildRecipe();
    expect(() =>
      runBuild(recipe, { cwd: root, homeDir: root, allowDangerous: true }),
    ).not.toThrow();
  });

  it("plan 不守可疑根（只读，不落盘）", () => {
    const recipe = buildRecipe();
    expect(() => runPlan(recipe, { cwd: root, homeDir: root })).not.toThrow();
  });
});

describe("[M3] plan 期 dry-apply 预检 fail-loud", () => {
  it("plan 即报 jsonMerge 冲突（不延迟到 build）", () => {
    frag("base.json", '{"workspaces":["packages/*"]}');
    frag("patch.json", '{"workspaces":["apps/*"]}');
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [
        {
          type: "addFragment",
          id: "b",
          source: "base.json",
          target: "package.json",
        },
        {
          type: "jsonMerge",
          id: "m",
          source: "patch.json",
          target: "package.json",
        },
      ],
    };
    expect(() => runPlan(recipe, ctx)).toThrow(/冲突/);
  });

  it("plan 即报同 target whole-file 覆盖（addFragment ifExists 默认 error）", () => {
    frag("a.json", '{"x":1}');
    frag("b.json", '{"y":2}');
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [
        { type: "addFragment", id: "a", source: "a.json", target: "dup.json" },
        { type: "addFragment", id: "b", source: "b.json", target: "dup.json" },
      ],
    };
    expect(() => runPlan(recipe, ctx)).toThrow(/已存在/);
  });
});

describe("[M4] 文本碎片 LF 规范化", () => {
  it("render:true CRLF 文本碎片 addFragment → 产物 LF", () => {
    frag("crlf.txt", "line1\r\nline2\r\n");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      render: true,
      ops: [
        { type: "addFragment", id: "a", source: "crlf.txt", target: "o.txt" },
      ],
    };
    runBuild(recipe, ctx);
    expect(fs.readFileSync(outAbs("out/o.txt"), "utf-8")).toBe(
      "line1\nline2\n",
    );
  });
});

describe("[R1⑤] raw addFragment 端到端字节保真（零转义 + CRLF + mode）", () => {
  it("默认 raw：${}/<% + CRLF + 0755 源 → 产物逐字节一致 + mode 保留", () => {
    // 源含 generator 模板语法字面量 + CRLF；默认 raw 不渲染不 normalize。
    const tplSrc = "org=${organization}\r\n<%- title %>\r\n";
    const shSrc = "#!/bin/sh\r\necho ${name}\r\n";
    frag("tpl.txt", tplSrc);
    frag("run.sh", shSrc);
    fs.chmodSync(path.join(root, "assemble", "fragments", "run.sh"), 0o755);
    const recipe: Recipe = {
      id: "raw",
      base: { kind: "empty" },
      output: "out",
      // render 缺省 = false（raw）；vars 存在也不应被消费。
      vars: { organization: "ORG", title: "T", name: "N" },
      ops: [
        { type: "addFragment", id: "t", source: "tpl.txt", target: "tpl.txt" },
        { type: "addFragment", id: "r", source: "run.sh", target: "run.sh" },
      ],
    };
    runBuild(recipe, ctx);
    // 逐字节一致：零转义（${}/<% 原样）、CRLF 保留。
    expect(fs.readFileSync(outAbs("out/tpl.txt"), "utf-8")).toBe(tplSrc);
    expect(fs.readFileSync(outAbs("out/run.sh"), "utf-8")).toBe(shSrc);
    // mode 保留（0755 可执行位不落 umask）。
    expect(fs.statSync(outAbs("out/run.sh")).mode & 0o777).toBe(0o755);
  });
});

describe("[H5] planner 零改扩展：新 content-model op 自动参与混族互斥", () => {
  it("注册一个新 content-model op（merge-yaml）→ 与 jsonMerge 同 target 混族 fail（未改 planner）", async () => {
    const { registerOp, registerBuiltinOps } =
      await import("@/assemble/registry");
    registerBuiltinOps();
    // 全新扩展 op：声明 content-model + 新 kind（非内建集合），planner 零改即应参与互斥
    registerOp("mergeYaml", {
      effects: (op) => [
        {
          target: op.target,
          kind: "merge-yaml",
          category: "content-model",
          createsTarget: true,
        },
      ],
      apply: () => ({ changed: true, conflicts: [] }),
    });
    frag("p.json", '{"x":1}');
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [
        { type: "jsonMerge", id: "j", source: "p.json", target: "conf.json" },
        { type: "mergeYaml", id: "y", source: "p.yaml", target: "conf.json" },
      ],
    };
    expect(() => runPlan(recipe, ctx)).toThrow(/混用|内容模型/);
  });
});

describe("[C1] assertOutputsCompatible（--all，D-M6）", () => {
  const mk = (id: string, output: string, base?: Recipe["base"]): Recipe => ({
    id,
    base: base ?? { kind: "empty" },
    output,
    ops: [],
  });

  it("相同 output → fail", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [mk("a", "out"), mk("b", "out")]),
    ).toThrow(/相同/);
  });

  it("父子嵌套 output → fail", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [mk("a", "out"), mk("b", "out/sub")]),
    ).toThrow(/嵌套/);
  });

  it("base.from 指向另一 recipe 的 output → fail", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [
        mk("a", "outA"),
        mk("b", "outB", { kind: "dir", from: "outA" }),
      ]),
    ).toThrow(/互指|嵌套/);
  });

  it("互不冲突 output → 通过", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [mk("a", "outA"), mk("b", "outB")]),
    ).not.toThrow();
  });
});

describe("[H4] against=head diff 保留 mode/symlink 元数据", () => {
  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: root });
  };

  /** 用 vfs.flush 直接物化一份含 exec/symlink 的 output，再 git 提交为 head 基准。 */
  const buildExecSymlinkRecipe = (): Recipe => {
    frag("run.sh", "#!/bin/sh\necho hi\n");
    return {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [
        {
          type: "addFragment",
          id: "x",
          source: "run.sh",
          target: "run.sh",
          mode: 0o755,
        },
      ],
    };
  };

  it("head 基准含可执行位 → build 产物同 mode 时 diff 无误报", () => {
    git("init", "-q");
    git("config", "user.email", "t@t.t");
    git("config", "user.name", "t");
    const recipe = buildExecSymlinkRecipe();
    runBuild(recipe, ctx);
    // 追加一个 symlink 到 output 后一并提交（git 记 120000）
    fs.symlinkSync("run.sh", outAbs("out/link.sh"));
    git("add", "-A");
    git("commit", "-q", "-m", "base");

    // 同 recipe 再 diff against head：mode 100755 应被基准正确还原 → 无 mode 漂移误报
    const d = runDiff(recipe, ctx, { against: "head" });
    const modeDrift = d.entries.filter((e) => e.kind === "mode");
    expect(modeDrift).toHaveLength(0);
    // link.sh 在 head 但本次 recipe 不产出 → orphan-actual（基准多余），但 kind 必须识别为 symlink 而非 file
    const linkEntry = d.entries.find((e) => e.file === "link.sh");
    expect(linkEntry?.kind).toBe("orphan-actual");
  });

  it("head 基准可执行位丢失会暴露 mode 漂移（产物降为 644）", () => {
    git("init", "-q");
    git("config", "user.email", "t@t.t");
    git("config", "user.name", "t");
    const recipe = buildExecSymlinkRecipe();
    runBuild(recipe, ctx);
    git("add", "-A");
    git("commit", "-q", "-m", "base");

    // 改 recipe mode 为 644 → 与 head(755) 基准应报 mode 漂移（证基准 mode 未丢）
    const recipe644: Recipe = {
      ...recipe,
      ops: [{ ...recipe.ops[0], mode: 0o644 }],
    };
    const d = runDiff(recipe644, ctx, { against: "head" });
    expect(d.entries.some((e) => e.kind === "mode")).toBe(true);
  });
});

describe("[D-M8] against=index diff + orphan-expected + base 越界", () => {
  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: root });
  };
  const initGit = (): void => {
    git("init", "-q");
    git("config", "user.email", "t@t.t");
    git("config", "user.name", "t");
  };

  it("against=index：暂存基准与产物一致 → 无漂移", () => {
    initGit();
    frag("a.txt", "A");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    runBuild(recipe, ctx);
    git("add", "out"); // 入暂存区（index 基准）
    const d = runDiff(recipe, ctx, { against: "index" });
    expect(d.against).toBe("index");
    expect(d.drifted).toBe(false);
  });

  it("against=index：产物比 index 基准多文件 → orphan-expected（基准缺失）", () => {
    initGit();
    frag("a.txt", "A");
    const r1: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    runBuild(r1, ctx);
    git("add", "out");
    // 再加一个碎片：产物将比 index 基准多 b.txt → orphan-expected
    frag("b.txt", "B");
    const r2: Recipe = {
      ...r1,
      ops: [
        ...r1.ops,
        { type: "addFragment", id: "b", source: "b.txt", target: "b.txt" },
      ],
    };
    const d = runDiff(r2, ctx, { against: "index" });
    expect(d.drifted).toBe(true);
    expect(d.entries.some((e) => e.kind === "orphan-expected")).toBe(true);
  });

  it("forceClean build：git clean 仓内 → 不抛（命中 isGitPathClean 真路径）", () => {
    initGit();
    frag("a.txt", "A");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    expect(() =>
      runBuild(recipe, ctx, { forceClean: true, allowUntrackedDelete: true }),
    ).not.toThrow();
    expect(fs.existsSync(outAbs("out/a.txt"))).toBe(true);
  });

  it("base.from 越界 cwd（../）→ build fail-loud", () => {
    const recipe: Recipe = {
      id: "r",
      base: { kind: "dir", from: "../outside" },
      output: "out",
      ops: [],
    };
    expect(() => runBuild(recipe, ctx)).toThrow(/越界/);
  });
});

describe("[D-M6] assertOutputsCompatible base↔output 双向嵌套", () => {
  const mk = (id: string, output: string, base?: Recipe["base"]): Recipe => ({
    id,
    base: base ?? { kind: "empty" },
    output,
    ops: [],
  });

  it("base.from 是另一 recipe output 的父目录 → fail（isInside 反向）", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [
        mk("a", "nested/outA"),
        mk("b", "outB", { kind: "dir", from: "nested" }),
      ]),
    ).toThrow(/互指|嵌套/);
  });

  it("base.from 是另一 recipe output 的子目录 → fail（isInside 正向）", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [
        mk("a", "outA"),
        mk("b", "outB", { kind: "dir", from: "outA/sub" }),
      ]),
    ).toThrow(/互指|嵌套/);
  });

  it("empty base 的 recipe 不参与 base↔output 校验（跳过 continue）", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [mk("a", "outA"), mk("b", "outB")]),
    ).not.toThrow();
  });

  it("dir base 与各 output 互不嵌套 → 全过（循环正常收尾）", () => {
    expect(() =>
      assertOutputsCompatible(ctx, [
        mk("a", "outA"),
        mk("b", "outB", { kind: "dir", from: "sources/from-b" }),
      ]),
    ).not.toThrow();
  });
});

describe("[D-M8] symlink 漂移识别（diffNode/readNodeMeta symlink 分支）", () => {
  /** 在 cwd 下造一个含 symlink 的 base 目录，返回 recipe。 */
  const symlinkBaseRecipe = (): Recipe => {
    const baseDir = path.join(root, "src-base");
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(path.join(baseDir, "real.txt"), "real", "utf-8");
    fs.symlinkSync("real.txt", path.join(baseDir, "link.txt"));
    return {
      id: "r",
      base: { kind: "dir", from: "src-base" },
      output: "out",
      ops: [],
    };
  };

  it("base 含 symlink → build 产物保留 symlink；worktree diff 无漂移（symlink 同目标）", () => {
    const recipe = symlinkBaseRecipe();
    runBuild(recipe, ctx);
    expect(fs.lstatSync(outAbs("out/link.txt")).isSymbolicLink()).toBe(true);
    const d = runDiff(recipe, ctx);
    expect(d.drifted).toBe(false);
  });

  it("worktree symlink 目标被改 → link 漂移（diffNode symlink 不等分支）", () => {
    const recipe = symlinkBaseRecipe();
    runBuild(recipe, ctx);
    fs.rmSync(outAbs("out/link.txt"));
    fs.symlinkSync("other.txt", outAbs("out/link.txt"));
    const d = runDiff(recipe, ctx);
    expect(d.drifted).toBe(true);
    expect(d.entries.some((e) => e.kind === "link")).toBe(true);
  });

  it("worktree symlink 被替换为普通文件 → kind 漂移（diffNode kind 不等分支）", () => {
    const recipe = symlinkBaseRecipe();
    runBuild(recipe, ctx);
    fs.rmSync(outAbs("out/link.txt"));
    fs.writeFileSync(outAbs("out/link.txt"), "now-a-file", "utf-8");
    const d = runDiff(recipe, ctx);
    expect(d.drifted).toBe(true);
    expect(d.entries.some((e) => e.kind === "kind")).toBe(true);
  });
});

describe("[D-H1] 非 git 仓 forceClean → isGitPathClean catch 回退 false", () => {
  it("非 git 工作目录 forceClean+allowUntrackedDelete → 不抛（catch 回退保守 false）", () => {
    frag("a.txt", "A");
    const recipe: Recipe = {
      id: "r",
      base: { kind: "empty" },
      output: "out",
      ops: [{ type: "addFragment", id: "a", source: "a.txt", target: "a.txt" }],
    };
    expect(() =>
      runBuild(recipe, ctx, { forceClean: true, allowUntrackedDelete: true }),
    ).not.toThrow();
  });
});

describe("[C1] 拼装↔裁剪双向产物一致（A2 子集）", () => {
  it("同一对变体：拼装配方与裁剪配方产物逐字节一致", () => {
    // 共享碎片
    frag("readme.md", "# Shared");
    frag(
      "base/package.json",
      '{"name":"pkg","version":"1.0.0","scripts":{"build":"x"}}',
    );
    frag("ws.partial.json", '{"scripts":{"test":"y"}}');

    // 拼装方向：empty + addFragment(readme,pkg) + jsonMerge(ws)
    const assembleRecipe: Recipe = {
      id: "asm",
      base: { kind: "empty" },
      output: "out-assemble",
      ops: [
        {
          type: "addFragment",
          id: "rm",
          source: "readme.md",
          target: "README.md",
        },
        {
          type: "addFragment",
          id: "pk",
          source: "base/package.json",
          target: "package.json",
        },
        {
          type: "jsonMerge",
          id: "ws",
          source: "ws.partial.json",
          target: "package.json",
        },
      ],
    };
    runBuild(assembleRecipe, ctx);

    // 裁剪方向：以拼装产物为 base（dir），不做减法 → 应与拼装产物一致
    const trimRecipe: Recipe = {
      id: "trim",
      base: { kind: "dir", from: "out-assemble" },
      output: "out-trim",
      ops: [],
    };
    runBuild(trimRecipe, ctx);

    const a = fs.readFileSync(outAbs("out-assemble/package.json"));
    const b = fs.readFileSync(outAbs("out-trim/package.json"));
    expect(a.equals(b)).toBe(true);
    const ra = fs.readFileSync(outAbs("out-assemble/README.md"));
    const rb = fs.readFileSync(outAbs("out-trim/README.md"));
    expect(ra.equals(rb)).toBe(true);
  });
});
