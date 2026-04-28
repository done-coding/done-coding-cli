import { xPrompts } from "@done-coding/cli-utils";
import type { Protocol } from "@/types";
import { BUILTIN_PROVIDERS_BY_PROTOCOL } from "@/services/presets";

/** 交互式输入 apiKey（不回显） */
export async function promptApiKey(): Promise<string> {
  const { apiKey } = (await xPrompts([
    {
      type: "password",
      name: "apiKey",
      message: "请输入 API Key:",
      validate: (value: string) => (value.trim() ? true : "API Key 不能为空"),
    },
  ])) as { apiKey: string };
  return apiKey;
}

/** 交互式选择模型列表（多选） */
export async function promptModels(protocol: Protocol): Promise<string[]> {
  const providers = BUILTIN_PROVIDERS_BY_PROTOCOL[protocol];

  const choices: { title: string; value: string }[] = [];
  for (const provider of providers) {
    for (const model of provider.models) {
      choices.push({
        title: `${model} - ${provider.alias}`,
        value: model,
      });
    }
  }

  const { models } = (await xPrompts([
    {
      type: "autocompleteMultiselect",
      name: "models",
      message: "选择该源支持的模型（空格选中，回车确认）:",
      choices,
      min: 1,
    },
  ])) as { models: string[] };
  return models;
}

/** 确认删除 */
export async function promptConfirm(message: string): Promise<boolean> {
  const { confirm } = (await xPrompts([
    {
      type: "confirm",
      name: "confirm",
      message,
      initial: false,
    },
  ])) as { confirm: boolean };
  return confirm;
}

/** 选择一个选项 */
export async function promptSelect<T extends string>(
  message: string,
  choices: { title: string; value: T }[],
): Promise<T> {
  const { selected } = (await xPrompts([
    {
      type: "select",
      name: "selected",
      message,
      choices,
    },
  ])) as { selected: T };
  return selected;
}
