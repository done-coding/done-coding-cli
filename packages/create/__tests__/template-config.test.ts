import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getLocalPointerConfigPath,
  readTemplateConfigPointer,
  setTemplateConfigPointer,
  unsetTemplateConfigPointer,
} from "../src/utils/local-config";

/**
 * 模板清单指针（`~/.done-coding/create/index.json`）读写单测（沙盒）。
 * ---
 * baseDir 注入临时目录，[MUST NOT] 碰真实家目录。
 */
describe("template-config 指针", () => {
  let baseDir: string;
  let workDir: string;

  /** 在 workDir 下写一份模板清单，返回绝对路径 */
  const writeManifest = (name: string, body: unknown) => {
    const p = path.join(workDir, name);
    writeFileSync(p, JSON.stringify(body));
    return p;
  };
  const readPointerFile = () =>
    JSON.parse(readFileSync(getLocalPointerConfigPath(baseDir), "utf-8"));

  beforeEach(() => {
    baseDir = mkdtempSync(path.join(tmpdir(), "dc-create-home-"));
    workDir = mkdtempSync(path.join(tmpdir(), "dc-create-work-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(workDir, { recursive: true, force: true });
  });

  it("未设置时：读取返回未配置", async () => {
    const info = await readTemplateConfigPointer({ baseDir });
    expect(info.configPath).toBeUndefined();
    expect(info.pointerPath).toBe(getLocalPointerConfigPath(baseDir));
  });

  it("set：相对路径按 cwd 解析为绝对路径，校验通过后写入并回报模板数", async () => {
    writeManifest("templates.manifest.json", {
      templateList: [{ name: "a" }, { name: "b" }],
    });
    const result = await setTemplateConfigPointer("./templates.manifest.json", {
      cwd: workDir,
      baseDir,
    });
    const expected = path.join(workDir, "templates.manifest.json");
    expect(result).toMatchObject({ configPath: expected, templateCount: 2 });
    expect(readPointerFile()).toEqual({ configPath: expected });

    const info = await readTemplateConfigPointer({ baseDir });
    expect(info).toMatchObject({
      configPath: expected,
      valid: true,
      templateCount: 2,
    });
  });

  it("set：文件不存在 / 非 JSON / templateList 非数组均拒绝，且不改动已有指针", async () => {
    const good = writeManifest("good.json", { templateList: [] });
    await setTemplateConfigPointer(good, { cwd: workDir, baseDir });

    await expect(
      setTemplateConfigPointer("./nope.json", { cwd: workDir, baseDir }),
    ).rejects.toThrow(/不存在/);
    writeFileSync(path.join(workDir, "broken.json"), "{ not json");
    await expect(
      setTemplateConfigPointer("./broken.json", { cwd: workDir, baseDir }),
    ).rejects.toThrow(/JSON/);
    writeManifest("bad.json", { templateList: {} });
    await expect(
      setTemplateConfigPointer("./bad.json", { cwd: workDir, baseDir }),
    ).rejects.toThrow(/templateList/);

    expect(readPointerFile()).toEqual({ configPath: good });
  });

  it("set：保留指针文件里的其它字段", async () => {
    const pointerPath = getLocalPointerConfigPath(baseDir);
    mkdirSync(path.dirname(pointerPath), { recursive: true });
    writeFileSync(pointerPath, JSON.stringify({ keep: 1, configPath: "/old" }));
    const next = writeManifest("next.json", { templateList: [] });
    await setTemplateConfigPointer(next, { cwd: workDir, baseDir });
    expect(readPointerFile()).toEqual({ keep: 1, configPath: next });
  });

  it("读取：指向的清单已失效时标记 valid=false 并给出原因", async () => {
    const p = writeManifest("gone.json", { templateList: [] });
    await setTemplateConfigPointer(p, { cwd: workDir, baseDir });
    rmSync(p);
    const info = await readTemplateConfigPointer({ baseDir });
    expect(info).toMatchObject({ configPath: p, valid: false });
    expect(info.reason).toMatch(/不存在/);
  });

  it("unset：清除 configPath、保留其它字段；未配置时为无操作", async () => {
    expect((await unsetTemplateConfigPointer({ baseDir })).removed).toBe(false);

    const pointerPath = getLocalPointerConfigPath(baseDir);
    mkdirSync(path.dirname(pointerPath), { recursive: true });
    writeFileSync(pointerPath, JSON.stringify({ keep: 1, configPath: "/x" }));
    expect((await unsetTemplateConfigPointer({ baseDir })).removed).toBe(true);
    expect(readPointerFile()).toEqual({ keep: 1 });
  });
});
