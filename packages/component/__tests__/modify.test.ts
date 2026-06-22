/**
 * [T6] component modifyCommandHandler 包装集成测试
 *
 * 验证 dc-component modify <name> 正确透传到 modifyHandler（batchType 钉死为 component）。
 *
 * 场景：
 *   MOD-1 addCommandHandler(v1) → modifyCommandHandler(v2) →
 *         目标文件 inject 块原位替换为 v2、dc-gen:start: 块仅出现一次。
 *
 * 夹具约定（项目 CLAUDE.md 沙盒规则）：
 *   - 临时目录通过 os.tmpdir() + mkdtempSync 创建
 *   - 批次配置落 <cwd>/.done-coding/component/（discoverBatch 可发现，batchType="component"）
 *   - afterEach 清理，[MUST NOT] 写入 packages/*\/src
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { addCommandHandler, modifyCommandHandler } from "@/handlers";

const tmpRoots: string[] = [];

const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-component-modify-")),
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
 * 在 <cwd>/.done-coding/component/ 建合法批次目录（index.json + config.json5），
 * 使用 inject 策略以验证 modify 的替换语义。
 */
const mkComponentBatch = (cwd: string, configJson5: string): void => {
  const batchDir = path.join(cwd, ".done-coding", "component");
  fs.mkdirSync(batchDir, { recursive: true });
  fs.writeFileSync(
    path.join(batchDir, "index.json"),
    `{ "config": "./config.json5" }`,
    "utf-8",
  );
  fs.writeFileSync(path.join(batchDir, "config.json5"), configJson5, "utf-8");
};

describe("[T6] dc-component modifyCommandHandler 包装", () => {
  it("MOD-1 addCommandHandler(v1) → modifyCommandHandler(v2)：inject 块原位替换、仅一个 dc-gen:start: 块", async () => {
    const cwd = mkTmp();

    // 目标文件：inject 策略锚点在 "const routes = [" 之后
    const targetFile = path.join(cwd, "config.ts");
    fs.writeFileSync(targetFile, "// config\nconst routes = [\n];\n", "utf-8");

    // 批次配置：inject 策略，markerKey 固定（组件场景，batchType=component）
    const configJson5 = `{
  instanceDir: "\${execDir}/src/\${nameKebab}",
  files: [
    {
      strategy: "inject",
      inputData: "  const x = \${v};",
      output: "config.ts",
      anchor: { pattern: "const routes = [", position: "after" },
      markerKey: "t:comp-foo",
    },
  ],
}`;

    mkComponentBatch(cwd, configJson5);

    const ctx = { mode: "test" as const, cwd, interactive: false };

    // step 1: addCommandHandler with v=v1（batchType 自动钉死为 component）
    await addCommandHandler(
      { type: "component", name: "my-widget", env: '{"v":"v1"}' },
      ctx,
    );

    const afterAdd = fs.readFileSync(targetFile, "utf-8");
    expect(afterAdd).toContain("const x = v1");
    expect(afterAdd).toContain("=== dc-gen:start:t:comp-foo ===");

    // step 2: modifyCommandHandler with v=v2
    await modifyCommandHandler(
      { type: "component", name: "my-widget", env: '{"v":"v2"}' },
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
