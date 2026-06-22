/**
 * [T3 骨架] 占位 smoke 测试 —— 仅验证类型契约与桩文件可被 import（编译/解析不报错）。
 * 真实行为级用例（19 例 + golden harness + 边界）在 T8 实现（design §9）。
 * 沙盒铁律（项目 CLAUDE.md / K7）：T8 所有夹具 [MUST] 落 tmp，afterEach 清理。
 */
/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- 类型存在性占位断言 */
import { describe, expect, it } from "vitest";
import {
  strategyRegistry,
  DEFAULT_STRATEGY,
  NAME_LEGAL_PATTERN,
  type BatchConfig,
  type FileEntry,
  type EnvContext,
  type Strategy,
  type GeneratorHandler,
} from "@/index";
import { OutputModeEnum } from "@done-coding/cli-template";

describe("[T3 骨架] cli-generator 类型契约 + 桩 smoke", () => {
  it("strategyRegistry 注册 4 策略（inject=INSERT，P2）", () => {
    expect(Object.keys(strategyRegistry).sort()).toEqual([
      "append",
      "create",
      "inject",
      "replace",
    ]);
    expect(strategyRegistry.create.mode).toBe(OutputModeEnum.OVERWRITE);
    expect(strategyRegistry.append.mode).toBe(OutputModeEnum.APPEND);
    expect(strategyRegistry.replace.mode).toBe(OutputModeEnum.REPLACE);
    expect(strategyRegistry.replace.supportsRollback).toBe(false);
    expect(strategyRegistry.inject.mode).toBe(OutputModeEnum.INSERT);
    expect(strategyRegistry.inject.supportsRollback).toBe(true);
  });

  it("默认 strategy = create", () => {
    expect(DEFAULT_STRATEGY).toBe<Strategy>("create");
  });

  it("名称合法规则：字母开头 + 字母/数字/中划线", () => {
    expect(NAME_LEGAL_PATTERN.test("my-widget")).toBe(true);
    expect(NAME_LEGAL_PATTERN.test("1bad")).toBe(false);
  });

  it("类型契约可被构造（仅类型层面断言，无运行时逻辑）", () => {
    const file: FileEntry = {
      input: "${templateDir}/template/x.md",
      output: "./src/x.ts",
      strategy: "append",
      dealMarkdown: true,
      rollbackRequireHit: true,
    };
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/components/${nameKebab}",
      files: [file],
    };
    expect(config.files[0].strategy).toBe("append");

    // EnvContext / GeneratorHandler 仅做类型存在性占位
    const _env = {} as EnvContext;
    const _handler = (async () => {}) as unknown as GeneratorHandler;
    expect(typeof _handler).toBe("function");
    expect(_env).toBeDefined();
  });
});
