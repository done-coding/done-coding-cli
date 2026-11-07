import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isCliUserError } from "@done-coding/cli-utils";
import { compileHandler, batchCompileHandler } from "@/handlers";

/**
 * rkacpj：`template init` 后直接 `template` 不应只报「env与envData不能同时为空」。
 * ⓐ 未给单文件参数且存在配置文件 → 按配置批量编译（init 产物可直接运行）；
 * ⓑ 两者都没有 / 单文件参数不全 → 预期错误，写明该在哪里填什么。
 *
 * 夹具落 os.tmpdir()，afterEach 清理；vitest 进程非 TTY，按非交互模式运行。
 */
/** 构造模板占位符 `${key}`（避免源码里出现字面 ${...} 触发 lint） */
const ph = (key: string) => "${" + key + "}";

describe("template 默认命令入口", () => {
  let rootDir: string;

  const writeConfig = (config: Record<string, unknown>) => {
    fs.mkdirSync(path.join(rootDir, ".done-coding"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, ".done-coding", "template.json"),
      JSON.stringify(config, null, 2),
    );
  };

  const catchError = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      return error as Error;
    }
    throw new Error("预期抛错但未抛");
  };

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-tmpl-entry-"));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("无单文件参数 + 有配置文件 → 按配置批量编译", async () => {
    fs.writeFileSync(path.join(rootDir, "a.tpl.txt"), `name=${ph("name")}\n`);
    writeConfig({
      collectEnvDataForm: [{ key: "name", label: "名称", initial: "demo" }],
      list: [{ input: "a.tpl.txt", output: "a.txt", mode: "overwrite" }],
    });

    await compileHandler({ rootDir } as any);

    expect(fs.readFileSync(path.join(rootDir, "a.txt"), "utf-8")).toBe(
      "name=demo\n",
    );
  });

  it("无单文件参数 + 无配置文件 → 预期错误，指出 init / batch 与单文件参数", async () => {
    const error = await catchError(() => compileHandler({ rootDir } as any));
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("template init");
    expect(error.message).toContain(".done-coding/template.json");
    expect(error.message).toContain("-i");
    expect(error.message).toContain("-e");
  });

  it("单文件只给模板、缺环境数据 → 预期错误，写明 -e / -E", async () => {
    const error = await catchError(() =>
      compileHandler({ rootDir, inputData: "x", output: "o.txt" } as any),
    );
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("-e/--env");
    expect(error.message).toContain("-E/--envData");
    expect(fs.existsSync(path.join(rootDir, "o.txt"))).toBe(false);
  });

  it("batch 无配置文件 → 预期错误，指出 template init", async () => {
    const error = await catchError(() =>
      batchCompileHandler({ rootDir, markerNs: "dc" } as any),
    );
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("template init");
  });

  it("batch 非交互缺采集变量 → 预期错误，指出配置文件与 initial", async () => {
    writeConfig({
      collectEnvDataForm: [{ key: "name", label: "名称" }],
      list: [],
    });
    const error = await catchError(() =>
      batchCompileHandler({ rootDir, markerNs: "dc" } as any),
    );
    expect(isCliUserError(error)).toBe(true);
    expect(error.message).toContain("name(名称)");
    expect(error.message).toContain("initial");
    expect(error.message).toContain(".done-coding/template.json");
  });
});
