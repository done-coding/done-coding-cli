import type { ConfigSchema } from "@done-coding/config-ui";
import schema from "../../settings.schema.json";

const { definitions, properties } = schema;
const alias: ConfigSchema = {
  ...definitions.alias,
  type: "string",
  title: "别名",
  description: "用于 profile 名；改名后请同步外部脚本引用。",
};
const textField = (
  source: { minLength?: number },
  title: string,
): ConfigSchema => ({
  type: "string",
  ...(source.minLength !== undefined ? { minLength: source.minLength } : {}),
  title,
});
const apiKey: ConfigSchema = {
  ...definitions.account.properties.apiKey,
  type: "string",
  title: "API 密钥",
};

/**
 * 随包 Schema 的表单视图，仅选取 config-ui 0.1 支持的字段。
 * 不声明 uuid/defaultProfile/envExtraParams/version/$schema，让原值保留机制接管；
 * 数组身份由 config-ui 的 arrayOrigins 随行，新增实体在 onSubmit 补 UUID。
 * oneOf 与引用完整性由现有 v2 校验执行，不能当作已被表单 Schema 校验。
 */
export const settingsFormSchema: ConfigSchema = {
  type: "object",
  title: schema.title,
  description:
    "保存后自动重建 profile。身份、默认引用和额外环境变量原样保留；这些字段仍可在 settings.json 中维护。",
  required: ["providers"],
  properties: {
    providers: {
      type: "array",
      title: "服务商",
      minItems: properties.providers.minItems,
      items: {
        type: "object",
        required: ["alias", "name", "url", "models"],
        properties: {
          alias,
          name: textField(definitions.provider.properties.name, "名称"),
          url: textField(definitions.provider.properties.url, "接口地址"),
          apiKey: {
            ...apiKey,
            description:
              "单密钥模式填写此项；多账号模式清空此项。与非空账号列表只能选择一种。",
          },
          accounts: {
            type: "array",
            title: "账号",
            description: "多账号模式添加账号；单密钥模式保持列表为空。",
            items: {
              type: "object",
              required: ["alias", "apiKey"],
              properties: { alias, apiKey },
            },
          },
          models: {
            type: "array",
            title: "模型",
            minItems: definitions.provider.properties.models.minItems,
            items: {
              type: "object",
              required: ["alias", "name"],
              properties: {
                alias,
                name: textField(
                  definitions.model.properties.name,
                  "实际模型名",
                ),
              },
            },
          },
        },
      },
    },
    disabledDefault: { type: "boolean", title: "忽略默认 profile" },
    output: {
      type: "object",
      title: "输出设置",
      properties: {
        profileName: {
          type: "boolean",
          title: "启动前显示 profile 名",
          default: true,
        },
      },
    },
  },
};
