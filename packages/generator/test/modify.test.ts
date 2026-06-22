/**
 * [T4] generator operate action:modify 单测
 *
 * 覆盖 4 场景：
 *   1. 改值：同 markerKey 块原位替换为新 env 渲染（旧值消失，块计数=1）
 *   2. 目标块不存在 → 默认整体中止、零写盘
 *   3. 零 insert 配方（overwrite/create 策略，无 inject）→ fail-loud
 *   4. skipMissing: true → 缺块跳过、存在块照改
 *
 * 夹具落 tmp，afterEach 清理（K7）。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEnvContext } from "@/core/env-context";
import { operate } from "@/core/operate";
import type { BatchConfig, EnvContext, ResolvedBatch } from "@/types";
import type { DoneCodingDirHit } from "@done-coding/cli-utils";

// ── 临时目录管理 ──────────────────────────────────────────────────────────────
const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-modify-")),
  );
  tmpRoots.push(dir);
  return dir;
};
afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

// ── 夹具 helpers ──────────────────────────────────────────────────────────────
const mkBatch = (
  config: BatchConfig,
  templateDir: string,
  type = "widget",
): ResolvedBatch => {
  const hit: DoneCodingDirHit = {
    segment: type,
    dir: templateDir,
    namespaceDir: path.dirname(templateDir),
    realDir: templateDir,
    layer: "project",
    shadowed: false,
  };
  return { type, hit, config };
};

const mkEnv = (
  execDir: string,
  templateDir: string,
  extra?: Record<string, unknown>,
): EnvContext => {
  const ctx = createEnvContext("my-widget", { execDir, templateDir });
  if (extra) {
    return { ...ctx, ...extra };
  }
  return ctx;
};

const writeFile = (p: string, content: string): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
};

// ── 测试 ───────────────────────────────────────────────────────────────────────
describe("[T4] operate action:modify", () => {
  it("T4-1 改值：同 markerKey 块原位替换为新 env 渲染", async () => {
    const execDir = mkTmp();
    const target = path.join(execDir, "config.ts");
    // 目标文件初始无 marker，需 add 后再 modify
    writeFile(target, "// config\nconst routes = [\n];\n");

    // ghost.ts 是 create 策略文件，modify 必须跳过它（insert-only 过滤）
    // 若 modify 降级执行了 add 逻辑，ghost.ts 将被创建，falsifiability 断言失败
    const ghostFile = path.join(execDir, "ghost.ts");

    // add 阶段只需要 inject 项
    const configAdd: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          // inputData 渲染时从 env 取 v
          inputData: "  const x = ${v};",
          output: "config.ts",
          anchor: { pattern: "const routes = [", position: "after" },
          markerKey: "t:foo",
        },
      ],
    };

    // modify 阶段配方：inject 项（应被处理）+ create 项（应被 modify 过滤跳过）
    const configModify: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "  const x = ${v};",
          output: "config.ts",
          anchor: { pattern: "const routes = [", position: "after" },
          markerKey: "t:foo",
        },
        {
          strategy: "create",
          inputData: "// ghost file — must NOT be created by modify",
          output: "ghost.ts",
        },
      ],
    };

    // step 1: add with v=1
    await operate({
      action: "add",
      batch: mkBatch(configAdd, execDir),
      env: mkEnv(execDir, execDir, { v: 1 }),
    });

    const afterAdd = fs.readFileSync(target, "utf-8");
    expect(afterAdd).toContain("const x = 1");

    // step 2: modify with v=2（混合配方，create 项必须被跳过）
    await operate({
      action: "modify",
      batch: mkBatch(configModify, execDir),
      env: mkEnv(execDir, execDir, { v: 2 }),
    });

    const afterModify = fs.readFileSync(target, "utf-8");
    expect(afterModify).toContain("const x = 2");
    expect(afterModify).not.toContain("const x = 1");
    // 块只有 1 个（未重复插入）
    expect((afterModify.match(/dc-gen:start:/g) ?? []).length).toBe(1);
    // [falsifiability] modify 过滤 insert-only，ghost.ts（create 策略）必须未被创建
    expect(fs.existsSync(ghostFile)).toBe(false);
  });

  it("T4-2 目标块不存在 → 默认整体中止、零写盘", async () => {
    const execDir = mkTmp();
    const target = path.join(execDir, "config.ts");
    writeFile(target, "// config\n");

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "x",
          output: "config.ts",
          anchor: { pattern: "// config", position: "after" },
          markerKey: "t:bar",
        },
      ],
    };

    // 从未 add 过，marker 块不存在
    await expect(
      operate({
        action: "modify",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
      }),
    ).rejects.toThrow(/marker 块不存在|预检失败/);

    // 零写盘：文件内容未变
    expect(fs.readFileSync(target, "utf-8")).toBe("// config\n");
  });

  it("T4-3 零 insert 配方（create 策略，无 inject）→ fail-loud /无 insert/", async () => {
    const execDir = mkTmp();
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "create",
          inputData: "hello",
          output: "foo.ts",
        },
      ],
    };

    await expect(
      operate({
        action: "modify",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
      }),
    ).rejects.toThrow(/无 insert/);
  });

  it("T4-4 skipMissing: true → 缺块跳过、存在块照改", async () => {
    const execDir = mkTmp();
    const target1 = path.join(execDir, "a.ts");
    const target2 = path.join(execDir, "b.ts");
    writeFile(target1, "ANCHOR_A\n");
    writeFile(target2, "ANCHOR_B\n");

    const configAdd: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "val=${v}",
          output: "a.ts",
          anchor: { pattern: "ANCHOR_A", position: "after" },
          markerKey: "t:a",
        },
      ],
    };

    // 只 add a.ts 的块（b.ts 不 add）
    await operate({
      action: "add",
      batch: mkBatch(configAdd, execDir),
      env: mkEnv(execDir, execDir, { v: "old" }),
    });

    // 两个 insert 项的 batch，b.ts 块缺失
    const configModify: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "val=${v}",
          output: "a.ts",
          anchor: { pattern: "ANCHOR_A", position: "after" },
          markerKey: "t:a",
        },
        {
          strategy: "inject",
          inputData: "val=${v}",
          output: "b.ts",
          anchor: { pattern: "ANCHOR_B", position: "after" },
          markerKey: "t:b",
        },
      ],
    };

    // skipMissing=true: b.ts 缺失块跳过，a.ts 照改
    await expect(
      operate({
        action: "modify",
        batch: mkBatch(configModify, execDir),
        env: mkEnv(execDir, execDir, { v: "new" }),
        skipMissing: true,
      }),
    ).resolves.toBeUndefined();

    const contA = fs.readFileSync(target1, "utf-8");
    const contB = fs.readFileSync(target2, "utf-8");

    // a.ts 已更新为 new
    expect(contA).toContain("val=new");
    expect(contA).not.toContain("val=old");

    // b.ts 未创建 marker 块（仅原始内容）
    expect(contB).toBe("ANCHOR_B\n");
  });

  it("T4-5 skipMissing:true + duplicate marker block → throw corrupt、零写盘", async () => {
    const execDir = mkTmp();
    const target = path.join(execDir, "dup.ts");
    // Corrupt file: two start markers for the same key
    writeFile(
      target,
      [
        "// === dc-gen:start:t:dup ===",
        "old-body-1",
        "// === dc-gen:start:t:dup ===",
        "old-body-2",
        "// === dc-gen:end:t:dup ===",
      ].join("\n") + "\n",
    );
    const original = fs.readFileSync(target, "utf-8");

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "new-body",
          output: "dup.ts",
          anchor: {
            pattern: "// === dc-gen:start:t:dup ===",
            position: "after",
          },
          markerKey: "t:dup",
        },
      ],
    };

    // Must throw even with skipMissing:true (corrupt blocks are not merely absent)
    await expect(
      operate({
        action: "modify",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
        skipMissing: true,
      }),
    ).rejects.toThrow(/损坏|非唯一成对|手动清理|corrupt/i);

    // Zero writes: file bytes unchanged
    expect(fs.readFileSync(target, "utf-8")).toBe(original);
  });

  it("T4-6 skipMissing:true + only-start (unpaired) marker → throw corrupt、零写盘", async () => {
    const execDir = mkTmp();
    const target = path.join(execDir, "unpaired.ts");
    writeFile(target, "// === dc-gen:start:t:up ===\nbody\n");
    const original = fs.readFileSync(target, "utf-8");

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "new-body",
          output: "unpaired.ts",
          anchor: { pattern: "body", position: "after" },
          markerKey: "t:up",
        },
      ],
    };

    await expect(
      operate({
        action: "modify",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
        skipMissing: true,
      }),
    ).rejects.toThrow(/损坏|非唯一成对|手动清理|corrupt/i);

    // Zero writes: file bytes unchanged
    expect(fs.readFileSync(target, "utf-8")).toBe(original);
  });
});
