import fs from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { migrateSettings, SETTINGS_SCHEMA_URL } from "@/utils/migrate";
import pkg from "../../package.json";
const require = createRequire(import.meta.url);
// 仓内 eslint 已安装 Ajv 6（MIT），仅测试使用，不加运行时依赖。
const Ajv = createRequire(require.resolve("eslint"))("ajv");
const schema = JSON.parse(
  fs.readFileSync(
    new URL("../../settings.schema.json", import.meta.url),
    "utf8",
  ),
);
const valid = () =>
  migrateSettings({
    providers: {
      a: { name: "A", url: "u", apiKey: "", models: [{ id: "m", name: "m" }] },
    },
  }).settings;
describe("发布的 settings schema", () => {
  const validate = new Ajv({ allErrors: true }).compile(schema);
  it("接纳迁移结果，Schema 版本 URL 对应包版本且包包含 Schema", () => {
    expect(validate(valid()), JSON.stringify(validate.errors)).toBe(true);
    expect(SETTINGS_SCHEMA_URL).toBe(
      `https://cdn.jsdelivr.net/npm/@done-coding/cli-cc-switch@${pkg.version}/settings.schema.json`,
    );
    expect(pkg.files).toContain("settings.schema.json");
  });
  it("拒绝缺 UUID、非法 alias、混合凭据与空账号；合法多账号可用", () => {
    const s = valid();
    delete s.providers[0].uuid;
    expect(validate(s)).toBe(false);
    const bad = valid();
    bad.providers[0].alias = "a/b";
    expect(validate(bad)).toBe(false);
    const accounts = valid();
    accounts.providers[0].accounts = [];
    expect(validate(accounts)).toBe(false);
    delete accounts.providers[0].apiKey;
    expect(validate(accounts)).toBe(false);
    accounts.providers[0].accounts = [
      {
        uuid: "00000000-0000-4000-8000-000000000002",
        alias: "157",
        apiKey: "",
      },
    ];
    expect(validate(accounts), JSON.stringify(validate.errors)).toBe(true);
  });
  it("凭据标为 secret，UUID 标 readOnly 供表单保留", () => {
    for (const kind of ["provider", "account"])
      expect(schema.definitions[kind].properties.apiKey["x-dc-ui"].secret).toBe(
        true,
      );
    expect(schema.definitions.uuid.readOnly).toBe(true);
    for (const kind of ["provider", "account", "model"])
      expect(schema.definitions[kind].properties.uuid.$ref).toBe(
        "#/definitions/uuid",
      );
  });
});
