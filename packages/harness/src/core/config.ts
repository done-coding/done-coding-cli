import fs from "node:fs";
import path from "node:path";
import injectInfo from "@/injectInfo.json";
import { DEFAULT_DOMAINS_SOURCE, type DomainsSource } from "./check";
import type { InstructionsConfig } from "./instructions";

/** 治理目录默认位置（相对项目根） */
export const DEFAULT_GOVERNANCE_DIR = "docs/governance";

/** 项目本地配置：`<projectRoot>/.done-coding/harness/governance/config.json` */
export interface HarnessConfig {
  /** 治理目录（相对项目根），默认 `docs/governance` */
  governanceDir?: string;
  /** 领域表来源，默认治理目录下 `MODULES.md` 全文 */
  domains?: DomainsSource;
  instructions?: InstructionsConfig;
}

/** 配置特性目录名 */
const CONFIG_FEATURE = "governance";
/** 配置文件名 */
const CONFIG_FILE = "config.json";

/** 项目本地配置文件路径 */
export const getConfigPath = (projectRoot: string): string =>
  path.join(
    projectRoot,
    injectInfo.cliConfig.namespaceDir,
    injectInfo.cliConfig.moduleName,
    CONFIG_FEATURE,
    CONFIG_FILE,
  );

/** 只读当前项目配置，不依赖治理目录存在。 */
export const readConfig = (projectRoot: string): HarnessConfig => {
  const file = getConfigPath(projectRoot);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
};

/** 已解析的治理上下文 */
export interface GovernanceContext {
  /** 治理目录绝对路径 */
  root: string;
  /** 领域表来源 */
  domains: DomainsSource;
  instructions?: InstructionsConfig;
}

/**
 * 解析项目的治理上下文：配置文件可缺省（全走默认），存在则必须是合法 JSON。
 * `dirOverride` 为命令行显式指定的治理目录（优先于配置）。
 */
export const resolveGovernance = (
  projectRoot: string,
  dirOverride?: string,
): GovernanceContext => {
  const config = readConfig(projectRoot);
  const root = path.resolve(
    projectRoot,
    dirOverride ?? config.governanceDir ?? DEFAULT_GOVERNANCE_DIR,
  );
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`治理目录不存在：${root}`);
  }
  return {
    root,
    domains: config.domains ?? DEFAULT_DOMAINS_SOURCE,
    instructions: config.instructions,
  };
};
