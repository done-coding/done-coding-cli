import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileTemplate } from "@/utils";
import { handler as batchCompileHandler } from "@/handlers/batch-compile";
import { OutputModeEnum } from "@/types";

/**
 * 受限编译（confineToRootDir）：读写目标解开符号链接后须在 rootDir 内。
 * 夹具全落临时目录，afterEach 清理。
 */
describe("受限编译 confineToRootDir", () => {
  let scratch: string;
  let rootDir: string;
  let outside: string;

  const confined = { confineToRootDir: true };
  type Item = Pick<
    Parameters<typeof compileTemplate>[0],
    "mode" | "input" | "inputData" | "output"
  >;
  const run = (
    item: Item,
    publicConfig: { confineToRootDir?: boolean } = confined,
  ) =>
    compileTemplate(
      { envData: { name: "demo" }, ...item },
      { rootDir, ...publicConfig },
    );

  beforeEach(() => {
    scratch = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "dc-tmpl-confine-")),
    );
    rootDir = path.join(scratch, "project");
    outside = path.join(scratch, "outside");
    fs.mkdirSync(rootDir);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "rc"), "original", "utf-8");
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it("input 是指向项目外的链接（replace）：拒绝，项目外文件不被读写", async () => {
    fs.symlinkSync(path.join(outside, "rc"), path.join(rootDir, "evil"));
    await expect(
      run({ input: "evil", mode: OutputModeEnum.REPLACE }),
    ).rejects.toThrow(/越出项目目录/);
    expect(fs.readFileSync(path.join(outside, "rc"), "utf-8")).toBe("original");
  });

  it.each([
    ["相对路径 ../", "../outside/new.txt"],
    ["绝对路径", "OUTSIDE_ABS"],
    ["经指向项目外的目录链接", "linked/new.txt"],
    ["悬空链接（目标尚不存在）", "dangling"],
  ])("output 越出项目（%s）：拒绝，不建目录不写文件", async (_, target) => {
    fs.symlinkSync(outside, path.join(rootDir, "linked"));
    fs.symlinkSync(
      path.join(outside, "created-by-link"),
      path.join(rootDir, "dangling"),
    );
    const output =
      target === "OUTSIDE_ABS" ? path.join(outside, "abs.txt") : target;
    await expect(
      run({ inputData: "x", output, mode: OutputModeEnum.OVERWRITE }),
    ).rejects.toThrow(/越出项目目录/);
    expect(fs.readdirSync(outside).sort()).toEqual(["rc"]);
  });

  it("replace 编译后的文件名越出项目：拒绝，原文件保留", async () => {
    fs.writeFileSync(path.join(rootDir, "<%= name %>.txt"), "hi", "utf-8");
    await expect(
      compileTemplate(
        {
          input: "<%= name %>.txt",
          mode: OutputModeEnum.REPLACE,
          envData: { name: "../outside/escaped" },
        },
        { rootDir, ...confined },
      ),
    ).rejects.toThrow(/越出项目目录/);
    expect(fs.existsSync(path.join(rootDir, "<%= name %>.txt"))).toBe(true);
    expect(fs.readdirSync(outside)).toEqual(["rc"]);
  });

  it("项目内读写（含指向项目内的链接）照常", async () => {
    fs.writeFileSync(path.join(rootDir, "tpl.txt"), "<%= name %>", "utf-8");
    fs.symlinkSync("tpl.txt", path.join(rootDir, "tpl-link.txt"));
    await run({
      input: "tpl-link.txt",
      output: "sub/out.txt",
      mode: OutputModeEnum.OVERWRITE,
    });
    expect(fs.readFileSync(path.join(rootDir, "sub/out.txt"), "utf-8")).toBe(
      "demo",
    );
  });

  it("未开启时行为不变：仍可写到项目外", async () => {
    await run(
      {
        inputData: "x",
        output: "../outside/new.txt",
        mode: OutputModeEnum.OVERWRITE,
      },
      {},
    );
    expect(fs.readFileSync(path.join(outside, "new.txt"), "utf-8")).toBe("x");
  });

  it("batch：配置文件是指向项目外的链接时拒绝；配置项写 confineToRootDir:false 不能关掉", async () => {
    const config = {
      list: [
        {
          inputData: "x",
          output: "../outside/new.txt",
          mode: OutputModeEnum.OVERWRITE,
          confineToRootDir: false,
        },
      ],
    };
    fs.writeFileSync(
      path.join(outside, "config.json"),
      JSON.stringify(config),
      "utf-8",
    );
    fs.symlinkSync(
      path.join(outside, "config.json"),
      path.join(rootDir, "linked-config.json"),
    );
    const ctx = { cwd: rootDir, interactive: false };
    await expect(
      batchCompileHandler(
        {
          rootDir,
          configPath: "linked-config.json",
          confineToRootDir: true,
        },
        undefined,
        ctx,
      ),
    ).rejects.toThrow(/配置文件 linked-config\.json 指向 .*越出项目目录/);

    fs.writeFileSync(
      path.join(rootDir, "config.json"),
      JSON.stringify(config),
      "utf-8",
    );
    await expect(
      batchCompileHandler(
        {
          rootDir,
          configPath: "config.json",
          confineToRootDir: true,
        },
        undefined,
        ctx,
      ),
    ).rejects.toThrow(/output .*new\.txt 指向 .*越出项目目录/);
    expect(fs.readdirSync(outside).sort()).toEqual(["config.json", "rc"]);
  });
});
