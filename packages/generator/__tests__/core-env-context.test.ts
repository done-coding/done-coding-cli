/**
 * [T4] env-context core 单测：canonical 集（含 pascalCase helper）、无 nameSnake（K6/K8）。
 */
/* eslint-disable no-template-curly-in-string */
import { describe, expect, it } from "vitest";
import { createEnvContext, createEnvHelpers } from "@/core/env-context";

describe("[T4] createEnvContext canonical 集（K6/K8）", () => {
  const env = createEnvContext("my-widget", {
    execDir: "/abs/project",
    templateDir: "/abs/.done-coding/component",
  });

  it("name = PascalCase（upperFirst∘camelCase），非 rawName 原样（K8）", () => {
    expect(env.name).toBe("MyWidget");
    expect(env.namePascal).toBe("MyWidget");
    expect(env.rawName).toBe("my-widget");
  });

  it("nameCamel / nameLowerFirst / nameKebab 派生正确", () => {
    expect(env.nameCamel).toBe("myWidget");
    expect(env.nameLowerFirst).toBe("myWidget");
    expect(env.nameKebab).toBe("my-widget");
  });

  it("内建路径变量 + $ 转义", () => {
    expect(env.execDir).toBe("/abs/project");
    expect(env.templateDir).toBe("/abs/.done-coding/component");
    expect(env.$).toBe("$");
  });

  it("canonical 集无 nameSnake（K6/Ⓐ）", () => {
    expect("nameSnake" in env).toBe(false);
  });

  it("helper 白名单 5 个（含组合 pascalCase），无 snakeCase/startCase（K6/Ⓓ）", () => {
    const helpers = createEnvHelpers();
    expect(Object.keys(helpers).sort()).toEqual([
      "camelCase",
      "kebabCase",
      "lowerFirst",
      "pascalCase",
      "upperFirst",
    ]);
    expect(helpers.pascalCase("my-widget")).toBe("MyWidget");
    expect("snakeCase" in helpers).toBe(false);
    expect("startCase" in helpers).toBe(false);
  });
});
