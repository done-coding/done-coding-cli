/**
 * [T2/P2] generator inject 策略接线单测（design §5/§12）。
 *
 * 聚焦 generator 层接线（引擎级 INSERT 边界已在 packages/template/test/insert.test.ts 覆盖）：
 *  - markerKey 缺省 = `${batchType}:${name}`（A3，operate 内部算，不污染 env）
 *  - anchor.pattern / markerKey 的 `${}` 预渲染（K2 时机）
 *  - inject add/remove 经 operate 串行落地 + 回退
 *  - E6 同文件同 markerKey 冲突 fail-loud
 *  - P5 remove dry-run 事务边界：inject marker 未命中先中止、不留半删
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

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-inject-")),
  );
  tmpRoots.push(dir);
  return dir;
};
afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

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

const mkEnv = (execDir: string, templateDir: string): EnvContext =>
  createEnvContext("my-widget", { execDir, templateDir });

const writeFile = (p: string, content: string): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
};

describe("[T2] generator inject 接线", () => {
  it("U14 markerKey 缺省 = `${batchType}:${name}`，anchor/inputData 的 ${} 预渲染", async () => {
    const execDir = mkTmp();
    const routes = path.join(execDir, "src", "router", "routes.ts");
    writeFile(routes, "const routes = [\n];\n");

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "  ${nameCamel}Route,",
          output: "src/router/routes.ts",
          anchor: { pattern: "const routes = [", position: "after" },
        },
      ],
    };
    await operate({
      action: "add",
      batch: mkBatch(config, execDir, "route"),
      env: mkEnv(execDir, execDir),
    });

    const content = fs.readFileSync(routes, "utf-8");
    expect(content).toContain("// === dc-gen:start:route:MyWidget ===");
    expect(content).toContain("// === dc-gen:end:route:MyWidget ===");
    expect(content).toContain("  myWidgetRoute,");
  });

  it("inject add → remove 往返：回退按 marker 删块，回到原样", async () => {
    const execDir = mkTmp();
    const routes = path.join(execDir, "src", "router", "routes.ts");
    const original = "const routes = [\n];\n";
    writeFile(routes, original);

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "  ${nameCamel}Route,",
          output: "src/router/routes.ts",
          anchor: { pattern: "const routes = [", position: "after" },
        },
      ],
    };
    const batch = mkBatch(config, execDir, "route");
    await operate({ action: "add", batch, env: mkEnv(execDir, execDir) });
    await operate({ action: "remove", batch, env: mkEnv(execDir, execDir) });
    expect(fs.readFileSync(routes, "utf-8")).toBe(original);
  });

  it("自定义 markerKey 支持 ${} 渲染", async () => {
    const execDir = mkTmp();
    const target = path.join(execDir, "a.ts");
    writeFile(target, "ANCHOR\n");
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "x",
          output: "a.ts",
          anchor: { pattern: "ANCHOR", position: "after" },
          markerKey: "custom-${nameKebab}",
        },
      ],
    };
    await operate({
      action: "add",
      batch: mkBatch(config, execDir, "route"),
      env: mkEnv(execDir, execDir),
    });
    expect(fs.readFileSync(target, "utf-8")).toContain(
      "// === dc-gen:start:custom-my-widget ===",
    );
  });

  it("E6 同文件同 markerKey 冲突 → fail-loud", async () => {
    const execDir = mkTmp();
    writeFile(path.join(execDir, "shared.ts"), "X\n");
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "a",
          output: "shared.ts",
          anchor: { pattern: "X", position: "after" },
        },
        {
          strategy: "inject",
          inputData: "b",
          output: "shared.ts",
          anchor: { pattern: "X", position: "after" },
        },
      ],
    };
    await expect(
      operate({
        action: "add",
        batch: mkBatch(config, execDir, "route"),
        env: mkEnv(execDir, execDir),
      }),
    ).rejects.toThrow(/同一文件同 markerKey 冲突/);
  });

  it("P5 remove dry-run：inject marker 未命中 → 执行前整体中止，不留半删", async () => {
    const execDir = mkTmp();
    const present = path.join(execDir, "present.ts");
    const missing = path.join(execDir, "missing.ts");
    // present 有 k1 块；missing 文件存在但无 k2 块
    writeFile(
      present,
      "head\n// === dc-gen:start:k1 ===\nbody\n// === dc-gen:end:k1 ===\ntail\n",
    );
    writeFile(missing, "no marker here\n");

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "body",
          output: "present.ts",
          markerKey: "k1",
        },
        {
          strategy: "inject",
          inputData: "body2",
          output: "missing.ts",
          markerKey: "k2",
        },
      ],
    };
    await expect(
      operate({
        action: "remove",
        batch: mkBatch(config, execDir, "route"),
        env: mkEnv(execDir, execDir),
      }),
    ).rejects.toThrow(/预检未通过|未命中 marker/);

    // 中止前 present 的 k1 块未被删（不留半删，M1/P5）
    expect(fs.readFileSync(present, "utf-8")).toContain(
      "// === dc-gen:start:k1 ===",
    );
  });

  it("strategy=inject 已注册（resolveStrategy 不再报保留）", async () => {
    const execDir = mkTmp();
    const target = path.join(execDir, "ok.ts");
    writeFile(target, "ANCHOR\n");
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "inject",
          inputData: "x",
          output: "ok.ts",
          anchor: { pattern: "ANCHOR", position: "after" },
        },
      ],
    };
    await expect(
      operate({
        action: "add",
        batch: mkBatch(config, execDir, "route"),
        env: mkEnv(execDir, execDir),
      }),
    ).resolves.toBeUndefined();
  });
});
