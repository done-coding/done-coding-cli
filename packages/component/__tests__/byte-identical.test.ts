/**
 * [T8] component 逐字节 golden 回归（design §6.5 / §9 用例8，R5 核心验收）。
 *
 * 验收口径：新 dc-component（cli-generator 的 component 预设薄包装）跑
 *   add Alpha → add BetaBox → list -o → remove Alpha
 * 的全部落地产物（含 list -o 的 component-name-list.json），与冻结在
 *   __tests__/golden/src/** 下的旧 dc-component 产物 **逐字节一致**。
 *
 * golden 来源（committed 夹具）：在旧 worktree（git 4087989，旧码 + 旧 config）
 *   用旧 dc-component 跑同序同名操作收得的产物树，存为 __tests__/golden/src/**。
 *   其 SHA 已与新产物核对一致（见 RETROSPECTIVE）。
 *
 * 沙盒铁律（项目 CLAUDE.md / K7）：spawn 真实 bin 落 tmp 项目，afterEach 清理；
 *   golden 夹具只读，[MUST NOT] 写工作树。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
/** 已构建的 dc-component bin（test 前 build：see beforeAll 守卫） */
const BIN = path.join(pkgRoot, "es", "cli.mjs");
/** 该包随包发行的 component 预设（新 config + 零改 template/*.md） */
const SRC_DONE_CODING = path.join(pkgRoot, ".done-coding");
/** committed golden 产物树 */
const GOLDEN_SRC = path.join(here, "golden", "src");

/** 收集某目录下所有文件相对路径（POSIX 分隔，稳定排序） */
function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else out.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}

let projDir: string;

beforeAll(() => {
  if (!fs.existsSync(BIN)) {
    throw new Error(
      `dc-component 未构建：${BIN} 不存在。请先 \`pnpm --filter @done-coding/cli-component build\`（含依赖链）后再跑 test。`,
    );
  }
});

afterEach(() => {
  if (projDir) fs.rmSync(projDir, { recursive: true, force: true });
});

describe("[T8] dc-component 逐字节 golden 回归（R5）", () => {
  it("add Alpha → add BetaBox → list -o → remove Alpha 产物与 golden 逐字节一致", () => {
    projDir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-byte-identical-"));
    // 放入随包发行的 component 预设（新 config），确保解析到 .done-coding/component
    fs.cpSync(SRC_DONE_CODING, path.join(projDir, ".done-coding"), {
      recursive: true,
    });

    const run = (args: string[]) =>
      execFileSync("node", [BIN, ...args], {
        cwd: projDir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });

    run(["add", "Alpha"]);
    run(["add", "BetaBox"]);
    run(["list", "-o"]);
    run(["remove", "Alpha"]);

    const producedSrc = path.join(projDir, "src");

    // ① 文件存在性 + 文件树完全一致（含 remove 后的删除/回滚态）
    const goldenFiles = listFiles(GOLDEN_SRC);
    const producedFiles = listFiles(producedSrc);
    expect(producedFiles).toEqual(goldenFiles);

    // ② 每个文件逐字节一致（含换行/缩进/字段序/无尾换行）
    for (const rel of goldenFiles) {
      const goldenBuf = fs.readFileSync(path.join(GOLDEN_SRC, rel));
      const producedBuf = fs.readFileSync(path.join(producedSrc, rel));
      // 先比内容文本（失败时 diff 可读），再断言字节相等
      expect(producedBuf.toString("utf-8"), `内容差异：${rel}`).toBe(
        goldenBuf.toString("utf-8"),
      );
      expect(producedBuf.equals(goldenBuf), `字节差异：${rel}`).toBe(true);
    }

    // ③ remove 后 alpha 实例目录已删（removeEmptyDir）；beta-box 保留
    expect(fs.existsSync(path.join(producedSrc, "components", "alpha"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(producedSrc, "components", "beta-box")),
    ).toBe(true);
  });
});
