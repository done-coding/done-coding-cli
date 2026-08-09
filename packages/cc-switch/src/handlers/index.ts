import { spawn } from "node:child_process";
import { parseArgv, selectProfile } from "./profile";
import {
  buildChildEnv,
  hasModelEnvConflict,
  readSettingsEnv,
  SETTINGS_PATH,
} from "@/utils/env-guard";
import {
  addModelEntry,
  generateConfig,
  loadModelConfig,
  loadOrInitConfig,
  loadProviderConfig,
  modelListLines,
  normalizeModelName,
  providerListLines,
  setProviderApiKey,
  writeConfig,
} from "@/utils/config";
import { PROFILE_PATH } from "@/utils/path";
import {
  fillEmptyEnv,
  findEmptyKeys,
  PromptAbortError,
  releaseStdin,
} from "@/utils/prompt";
import {
  pickProfile,
  printMetaHelp,
  printMetaVersion,
  selectProvider,
} from "@/utils/meta";
import injectInfo from "@/injectInfo.json";

export { parseArgv, selectProfile };

/** spawn 目标恒为字面量 "claude"。bin 名为 "cc-router"，与之异名，
 *  PATH 解析 "claude" 不可能命中 cc-router 自身（防自引用，决策 3）。 */
const CLAUDE_BIN = "claude";

/**
 * 路由主流程编排（REQ-1/4/5/6/7 + 决策 3/5 时序）。
 * meta 分发（REQ-4/5/6，help/version 在读配置前拦截）→ parseArgv →
 * loadOrInitConfig → pick（REQ-3 交互，等价 --meta-profile=）→ selectProfile
 * → REQ-5 补全 → 释放 stdin → 层 2 检测（settings.json fail-closed）
 * → 层 1 buildChildEnv → spawn。
 */
export const runRouter = async (argv?: string[]): Promise<never> => {
  // 独立入口：process.argv.slice(2)；主 CLI 子命令入口：命令边界后原始切片
  const { action, profileName, apiKey, modelName, providerId, passthrough } =
    parseArgv(argv ?? process.argv.slice(2));

  // REQ-4/5：自身命令面输出，[MUST NOT] 读/写配置、[MUST NOT] spawn
  if (action === "help") {
    printMetaHelp();
    process.exit(0);
  }
  if (action === "version") {
    printMetaVersion(injectInfo.version);
    process.exit(0);
  }
  if (action === "generate") {
    const cfg = generateConfig();
    process.stdout.write(
      `已生成 ${Object.keys(cfg.profiles).length} 个 profile → ${PROFILE_PATH}\n`,
    );
    process.exit(0);
  }
  if (action === "providerlist" || action === "modellist") {
    const lines =
      action === "providerlist"
        ? providerListLines(loadProviderConfig())
        : modelListLines(loadModelConfig());
    for (const line of lines) {
      process.stdout.write(`${line}\n`);
    }
    process.exit(0);
  }
  if (action === "setkey" || action === "addmodel") {
    // 目标 provider：--meta-provider=<id> 显式，否则交互选择（非 TTY → selectProvider 报错退出）
    const pc = loadProviderConfig();
    const target = providerId ?? (await selectProvider(pc));
    const cfg =
      action === "setkey"
        ? setProviderApiKey(target, apiKey!)
        : addModelEntry(target, modelName!);
    process.stdout.write(
      action === "setkey"
        ? `已更新 provider「${target}」apiKey，重建 ${Object.keys(cfg.profiles).length} 个 profile → ${PROFILE_PATH}\n`
        : `已添加 model「${target}/${normalizeModelName(modelName!).id}」，重建 ${Object.keys(cfg.profiles).length} 个 profile → ${PROFILE_PATH}\n`,
    );
    process.exit(0);
  }

  const cfg = loadOrInitConfig();

  // REQ-3：交互选择结果等价 --meta-profile=<选中名>
  const resolvedName = action === "pick" ? await pickProfile(cfg) : profileName;
  const { profile } = selectProfile(cfg, resolvedName);

  // REQ-5：仅对值严格 === "" 的键交互补全
  const needsFill = findEmptyKeys(profile.env).length > 0;
  if (needsFill) {
    try {
      await fillEmptyEnv(profile);
    } catch (err) {
      if (err instanceof PromptAbortError) {
        // 中断：[MUST NOT] 回写任何部分结果、[MUST NOT] spawn
        process.stderr.write("已取消，未写入配置。\n");
        return process.exit(1);
      }
      throw err;
    }
    // 补全后整体回写 + chmod 600
    writeConfig(cfg);
    // 补全结束、spawn 之前干净释放 stdin（仅补全路径需要）
    releaseStdin();
  }

  // REQ-7 层 2：spawn 前最后一道闸（每次启动都执行，只读检测，fail-closed）
  const settingsEnv = readSettingsEnv();
  const conflicts = hasModelEnvConflict(settingsEnv);
  if (conflicts.length > 0) {
    process.stderr.write(
      `检测到 ${SETTINGS_PATH} 的 env 块含模型路由类 key：` +
        `${conflicts.join(", ")}。请手动清理这些 key 后重试。\n`,
    );
    return process.exit(1);
  }

  // REQ-7 层 1：strip-then-inject（仅子进程作用域，不改自身 process.env）
  const childEnv = buildChildEnv(process.env, profile.env);

  const child = spawn(CLAUDE_BIN, passthrough, {
    stdio: "inherit",
    shell: false,
    env: childEnv,
  });

  // spawn 后由 exit/error 回调驱动 process.exit（生产环境 exit 不返回，
  // promise 永不 settle）；测试中 process.exit 被 mock 抛错 → reject 暴露退出码。
  return new Promise<never>((_resolve, reject) => {
    child.on("error", (err: NodeJS.ErrnoException) => {
      try {
        if (err.code === "ENOENT") {
          process.stderr.write(
            "未找到 claude 可执行文件，请确认 claude-code 已安装并在 PATH 中。\n",
          );
          process.exit(127);
          return;
        }
        process.stderr.write(`启动 claude 失败：${err.message}\n`);
        process.exit(1);
      } catch (e) {
        reject(e);
      }
    });

    child.on("exit", (code, signal) => {
      try {
        if (signal) {
          process.exit(128 + signalNameToNumber(signal));
          return;
        }
        process.exit(code ?? 1);
      } catch (e) {
        reject(e);
      }
    });
  });
};

/** 常见信号名 → 信号号（用于 128+signum 退出码语义；未知按 1）。 */
const signalNameToNumber = (signal: string): number => {
  const map: Record<string, number> = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGQUIT: 3,
    SIGILL: 4,
    SIGABRT: 6,
    SIGFPE: 8,
    SIGKILL: 9,
    SIGSEGV: 11,
    SIGPIPE: 13,
    SIGALRM: 14,
    SIGTERM: 15,
  };
  return map[signal] ?? 1;
};
