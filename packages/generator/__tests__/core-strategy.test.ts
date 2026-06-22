/**
 * [T4] strategy core 单测：registry 映射 + resolveStrategy 缺省/未知（design §4.3/§10）。
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STRATEGY,
  resolveStrategy,
  strategyRegistry,
} from "@/core/strategy";
import { OutputModeEnum } from "@done-coding/cli-template";

describe("[T4] strategyRegistry / resolveStrategy", () => {
  it("create→OVERWRITE(可回退) / append→APPEND(可回退) / replace→REPLACE(不可回退)", () => {
    expect(strategyRegistry.create).toEqual({
      mode: OutputModeEnum.OVERWRITE,
      supportsRollback: true,
    });
    expect(strategyRegistry.append).toEqual({
      mode: OutputModeEnum.APPEND,
      supportsRollback: true,
    });
    expect(strategyRegistry.replace).toEqual({
      mode: OutputModeEnum.REPLACE,
      supportsRollback: false,
    });
  });

  it("inject→INSERT(可回退) 已注册（P2）", () => {
    expect(strategyRegistry.inject).toEqual({
      mode: OutputModeEnum.INSERT,
      supportsRollback: true,
    });
    expect(Object.keys(strategyRegistry).sort()).toEqual([
      "append",
      "create",
      "inject",
      "replace",
    ]);
  });

  it("resolveStrategy 缺省回落 create", () => {
    expect(resolveStrategy()).toBe(strategyRegistry[DEFAULT_STRATEGY]);
    expect(resolveStrategy().mode).toBe(OutputModeEnum.OVERWRITE);
  });

  it("resolveStrategy 未知策略 fail-fast", () => {
    expect(() => resolveStrategy("nope" as never)).toThrow(/未知落地策略/);
  });
});
