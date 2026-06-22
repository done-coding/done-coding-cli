/**
 * [T5-INT] modify handler 真实文件集成测试
 *
 * 测命令面 handler → 真实 operate → 真实文件系统的全链路，
 * 不使用任何 vi.mock（handler/operate/discoverBatch 全走真实路径）。
 *
 * 场景：
 *   INT-1 addHandler 造块(v1) → modifyHandler(v2) → 断言目标文件块原位替换为 v2、
 *         且 === dc-gen:start: 块仅出现一次。
 *
 * 夹具约定（CLAUDE.md 沙盒规则，K7）：
 *   - 临时目录通过 os.tmpdir() + mkdtempSync 创建
 *   - 批次配置落 <cwd>/.done-coding/<type>/（discoverBatch 可发现）
 *   - afterEach 清理，[MUST NOT] 写入 packages/*\/src
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── 直接导入真实 handlers（不经 vi.mock） ──────────────────────────────────────
import { handler as addHandler } from "@/handlers/add";
import { handler as modifyHandler } from "@/handlers/modify";

// ── 临时目录管理 ──────────────────────────────────────────────────────────────
const tmpRoots: string[] = [];

const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-int-modify-")),
  );
  tmpRoots.push(dir);
  return dir;
};

afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

/**
 * 在 <cwd>/.done-coding/<type>/ 建合法批次目录（index.json + config.json5），
 * 与 core-batch-discovery.test.ts 中 mkBatch 保持一致，确保 discoverBatch 能发现。
 */
const mkOnDiskBatch = (
  cwd: string,
  type: string,
  configJson5: string,
): void => {
  const batchDir = path.join(cwd, ".done-coding", type);
  fs.mkdirSync(batchDir, { recursive: true });
  fs.writeFileSync(
    path.join(batchDir, "index.json"),
    `{ "config": "./config.json5" }`,
    "utf-8",
  );
  fs.writeFileSync(path.join(batchDir, "config.json5"), configJson5, "utf-8");
};

// ── 集成测试 ──────────────────────────────────────────────────────────────────
describe("[T5-INT] modify handler → 真实 operate → 文件系统", () => {
  it("INT-1 addHandler(v1) → modifyHandler(v2)：块原位替换、仅一个 dc-gen:start: 块", async () => {
    const cwd = mkTmp();

    // 目标文件：inject 策略锚点在 "const routes = [" 之后
    const targetFile = path.join(cwd, "config.ts");
    fs.writeFileSync(targetFile, "// config\nconst routes = [\n];\n", "utf-8");

    // 批次配置：inject 策略，markerKey 固定（避免依赖 name 的 PascalCase 计算）
    const configJson5 = `{
  instanceDir: "\${execDir}/src/\${nameKebab}",
  files: [
    {
      strategy: "inject",
      inputData: "  const x = \${v};",
      output: "config.ts",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "t:int-foo",
    },
  ],
}`;

    mkOnDiskBatch(cwd, "widget", configJson5);

    const ctx = { mode: "test" as const, cwd, interactive: false };

    // step 1: addHandler with v=v1
    await addHandler(
      { type: "widget", name: "my-widget", env: '{"v":"v1"}' },
      ctx,
    );

    const afterAdd = fs.readFileSync(targetFile, "utf-8");
    expect(afterAdd).toContain("const x = v1");
    expect(afterAdd).toContain("=== dc-gen:start:t:int-foo ===");

    // step 2: modifyHandler with v=v2
    await modifyHandler(
      { type: "widget", name: "my-widget", env: '{"v":"v2"}' },
      ctx,
    );

    const afterModify = fs.readFileSync(targetFile, "utf-8");

    // 新值存在，旧值消失
    expect(afterModify).toContain("const x = v2");
    expect(afterModify).not.toContain("const x = v1");

    // 块仅出现一次（原位替换，未重复插入）
    expect((afterModify.match(/dc-gen:start:/g) ?? []).length).toBe(1);
  });
});
