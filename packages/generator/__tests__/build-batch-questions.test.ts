/**
 * [P3 B6] buildBatchQuestions 纯函数 + listBatchQuestions 逐字节 stdout 不变。
 * 抽取后 CLI `--list-questions` 行为须与抽取前一致（updateEnvConfig 时机 / JSON 格式 / 尾换行）。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBatchQuestions, listBatchQuestions } from "@/handlers/shared";
import type { BatchConfig } from "@/types";

const config: BatchConfig = {
  instanceDir: "${execDir}/x",
  collectEnvDataForm: [{ name: "series", initial: "Dc" }, { name: "desc" }],
  files: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("[P3] buildBatchQuestions / listBatchQuestions", () => {
  it("buildBatchQuestions 纯函数：required 由 initial 缺省判定，无 stdout", () => {
    const spy = vi.spyOn(process.stdout, "write");
    const questions = buildBatchQuestions(config);
    expect(spy).not.toHaveBeenCalled();
    expect(questions).toEqual([
      { key: "series", required: false, default: "Dc" },
      { key: "desc", required: true },
    ]);
  });

  it("listBatchQuestions：stdout 输出 JSON(null,2) + 尾换行（逐字节）", () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const questions = listBatchQuestions(config);
    expect(spy).toHaveBeenCalledWith(`${JSON.stringify(questions, null, 2)}\n`);
  });

  it("两者数据一致（listBatchQuestions 委托 buildBatchQuestions）", () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(listBatchQuestions(config)).toEqual(buildBatchQuestions(config));
  });
});
