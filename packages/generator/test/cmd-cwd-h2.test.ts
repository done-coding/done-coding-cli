/**
 * [H2] ctx.cwd 作 execDir：mode:"test" 且 ctx.cwd ≠ process.cwd 时，
 * 在 ctx.cwd 发现批次并把产物落 ctx.cwd（而非 process.cwd）。
 * 真实 handler（不 mock core），夹具落 tmp，afterEach 清理（K7）。
 */
/* eslint-disable no-template-curly-in-string */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handler as addHandler } from "@/handlers/add";
import { handler as listHandler } from "@/handlers/list";

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dc-h2-")));
  tmpRoots.push(dir);
  return dir;
};

afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

/** 在 <base>/.done-coding/<seg> 造合法批次 */
const mkBatch = (base: string, seg: string, configBody: string): void => {
  const dir = path.join(base, ".done-coding", seg);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.json"),
    `{ "config": "./config.json5" }`,
  );
  fs.writeFileSync(path.join(dir, "config.json5"), configBody);
};

describe("[H2] ctx.cwd 作 execDir（ctx.cwd ≠ process.cwd）", () => {
  it("add：产物落 ctx.cwd，不落 process.cwd", async () => {
    const ctxCwd = mkTmp();
    expect(ctxCwd).not.toBe(process.cwd()); // 前置：两者不同

    mkBatch(
      ctxCwd,
      "widget",
      `{ instanceDir: "\${execDir}/src/\${nameKebab}", files: [ { strategy: "create", inputData: "export const \${name}=1;", output: "src/\${nameKebab}/C.ts" } ] }`,
    );

    await addHandler(
      { type: "widget", name: "my-widget" },
      { mode: "test", cwd: ctxCwd, interactive: false },
    );

    // 产物落 ctx.cwd
    const out = path.join(ctxCwd, "src", "my-widget", "C.ts");
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf-8")).toBe("export const MyWidget=1;");
    // 未落 process.cwd
    expect(
      fs.existsSync(path.join(process.cwd(), "src", "my-widget", "C.ts")),
    ).toBe(false);
  });

  it("list -o：实例枚举 + 输出落 ctx.cwd", async () => {
    const ctxCwd = mkTmp();
    mkBatch(
      ctxCwd,
      "widget",
      `{ instanceDir: "\${execDir}/src/\${nameKebab}", list: { mode: "subdir" }, files: [ { strategy: "create", inputData: "x", output: "src/\${nameKebab}/C.ts" } ], listSerializer: { fields: ["name","nameKebab"], sort: true, indent: 2, pathResolveBase: "cwd" } }`,
    );

    await addHandler(
      { type: "widget", name: "alpha" },
      { mode: "test", cwd: ctxCwd, interactive: false },
    );
    await listHandler(
      { type: "widget", output: "out/list.json" },
      { mode: "test", cwd: ctxCwd, interactive: false },
    );

    const listFile = path.join(ctxCwd, "out", "list.json");
    expect(fs.existsSync(listFile)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(listFile, "utf-8")) as Array<{
      nameKebab: string;
    }>;
    expect(parsed.map((p) => p.nameKebab)).toEqual(["alpha"]);
  });
});
