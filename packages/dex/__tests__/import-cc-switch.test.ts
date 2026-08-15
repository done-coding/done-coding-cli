import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * cc-switch 导入测试：
 * - translate 纯函数：settings.json → models.json / auth.json 映射（只 anthropic 协议）
 * - 集成：HOME 沙盒（vi.mock node:os homedir，规避 os.homedir 缓存）
 *   + xPrompts 授权 mock → importFromCcSwitch 写入 models.json/auth.json
 */

const h = vi.hoisted(() => ({ tmpHome: "" as string }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => h.tmpHome };
});

vi.mock("@done-coding/cli-utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@done-coding/cli-utils")>();
  return {
    ...actual,
    xPrompts: vi.fn().mockResolvedValue({ confirm: true }),
  };
});

let mod: typeof import("@/import/cc-switch");

const CC_SWITCH_SETTINGS_PATH = () =>
  path.join(h.tmpHome, ".done-coding", "cc-switch", "settings.json");
const DEX_MODELS_PATH = () =>
  path.join(h.tmpHome, ".pi", "agent", "models.json");
const DEX_AUTH_PATH = () => path.join(h.tmpHome, ".pi", "agent", "auth.json");

const FIXTURE_SETTINGS = {
  providers: {
    deepseek: {
      name: "DeepSeek",
      url: "https://api.deepseek.com/anthropic",
      apiKey: "sk-deepseek-test",
      models: [{ id: "flash", name: "deepseek-v4-flash[1m]" }],
    },
    openrouter: {
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/anthropic",
      apiKey: "",
      models: [{ id: "sonnet", name: "anthropic-claude-sonnet-4-5" }],
    },
  },
};

beforeAll(async () => {
  h.tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "dc-dex-cc-"));
  // 构造 cc-switch settings.json fixture
  const ccDir = path.dirname(CC_SWITCH_SETTINGS_PATH());
  fs.mkdirSync(ccDir, { recursive: true });
  fs.writeFileSync(
    CC_SWITCH_SETTINGS_PATH(),
    JSON.stringify(FIXTURE_SETTINGS, null, 2),
    "utf-8",
  );
  // 模拟 coding-agent 首次初始化的空 auth.json（{}）——空文件不得误判为已配置
  fs.mkdirSync(path.dirname(DEX_AUTH_PATH()), { recursive: true });
  fs.writeFileSync(DEX_AUTH_PATH(), "{}", "utf-8");
  mod = await import("@/import/cc-switch");
});

afterAll(() => {
  fs.rmSync(h.tmpHome, { recursive: true, force: true });
});

describe("translate（纯函数）", () => {
  it("providers → models.json（api 固定 anthropic-messages）+ auth.json（api_key）+ 默认模型", () => {
    const { models, auth, defaultProvider, defaultModel } =
      mod.translate(FIXTURE_SETTINGS);
    expect(models).toEqual({
      providers: {
        deepseek: {
          baseUrl: "https://api.deepseek.com/anthropic",
          api: "anthropic-messages",
          // [1m] 上下文标记被剥离（命中内置 1M 档）
          models: [{ id: "deepseek-v4-flash" }],
        },
        openrouter: {
          baseUrl: "https://openrouter.ai/api/v1/anthropic",
          api: "anthropic-messages",
          models: [{ id: "anthropic-claude-sonnet-4-5" }],
        },
      },
    });
    // 空 apiKey 的 provider 不进 auth.json
    expect(auth).toEqual({
      deepseek: { type: "api_key", key: "sk-deepseek-test" },
    });
    // 默认模型 = 第一个有 key 的 provider 的首个模型（剥离后）
    expect(defaultProvider).toBe("deepseek");
    expect(defaultModel).toBe("deepseek-v4-flash");
  });
});

describe("importFromCcSwitch（集成）", () => {
  it("未配置 + 检测到 cc-switch → 授权后写入 models.json/auth.json", async () => {
    const imported = await mod.importFromCcSwitch();
    expect(imported).toBe(true);

    const models = JSON.parse(fs.readFileSync(DEX_MODELS_PATH(), "utf-8"));
    expect(models.providers.deepseek.baseUrl).toBe(
      "https://api.deepseek.com/anthropic",
    );
    expect(models.providers.deepseek.api).toBe("anthropic-messages");
    expect(models.providers.deepseek.models[0].id).toBe("deepseek-v4-flash");

    const auth = JSON.parse(fs.readFileSync(DEX_AUTH_PATH(), "utf-8"));
    expect(auth.deepseek).toEqual({ type: "api_key", key: "sk-deepseek-test" });
    expect(auth.openrouter).toBeUndefined();

    // settings.json 写入默认模型（防默认选中 anthropic）
    const settings = JSON.parse(
      fs.readFileSync(
        path.join(h.tmpHome, ".pi", "agent", "settings.json"),
        "utf-8",
      ),
    );
    expect(settings.defaultProvider).toBe("deepseek");
    expect(settings.defaultModel).toBe("deepseek-v4-flash");
  });

  it("已配置后重复导入跳过（幂等）", async () => {
    const imported = await mod.importFromCcSwitch();
    expect(imported).toBe(false);
  });
});
