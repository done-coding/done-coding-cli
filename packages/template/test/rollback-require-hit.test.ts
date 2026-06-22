import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileTemplate } from "@/utils";
import { OutputModeEnum } from "@/types";

/**
 * T1：cli-template APPEND rollback 命中检测窄口
 *
 * 所有夹具落临时目录（os.tmpdir()），afterEach 清理，不污染工作树（项目沙盒铁律）。
 */
describe("APPEND rollback rollbackRequireHit 命中检测", () => {
  let rootDir: string;
  const outputRel = "out.txt";
  /** APPEND 追加的内容（= 模板渲染结果，inputData 无 `<%= %>` 占位即原样输出） */
  const appended = "// appended block\n";

  const outputPath = () => path.resolve(rootDir, outputRel);

  /** 构造一次 APPEND rollback 调用（rollback=true） */
  const runRollback = (rollbackRequireHit?: boolean) =>
    compileTemplate(
      {
        inputData: appended,
        output: outputRel,
        mode: OutputModeEnum.APPEND,
        envData: {},
        ...(rollbackRequireHit === undefined ? {} : { rollbackRequireHit }),
      },
      { rootDir, rollback: true },
    );

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-tmpl-rollback-"));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("用例a：内容被手改 + rollbackRequireHit=true → fail-loud 抛错", async () => {
    // 文件存在但不含 appended（模拟 APPEND 后被手动修改）
    fs.writeFileSync(outputPath(), "// human edited content\n", "utf-8");

    await expect(runRollback(true)).rejects.toThrow(
      `APPEND rollback 未命中：${outputPath()}`,
    );

    // 未命中时抛错中止，文件内容不被改动
    expect(fs.readFileSync(outputPath(), "utf-8")).toBe(
      "// human edited content\n",
    );
  });

  it("用例b：缺省（不传 rollbackRequireHit）+ 失配 → 不抛错，走旧 replace 路径（逐字节不变）", async () => {
    const original = "// human edited content\n";
    fs.writeFileSync(outputPath(), original, "utf-8");

    // 不传 rollbackRequireHit：失配也不抛错
    await expect(runRollback()).resolves.not.toThrow();

    // 旧行为：replace 未命中返回原串，原样写回，逐字节不变
    expect(fs.readFileSync(outputPath(), "utf-8")).toBe(original);
  });

  it("用例c：正常命中 + rollbackRequireHit=true → 正常回滚删除追加内容", async () => {
    const base = "// base content\n";
    // 文件 = 基础内容 + 追加块（模拟正常 APPEND 后状态）
    fs.writeFileSync(outputPath(), base + appended, "utf-8");

    await expect(runRollback(true)).resolves.not.toThrow();

    // 命中 → 追加块被删除，仅剩基础内容
    expect(fs.readFileSync(outputPath(), "utf-8")).toBe(base);
  });
});
