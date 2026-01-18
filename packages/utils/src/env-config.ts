import {
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL,
  DONE_CODING_CONFIG_RELATIVE_DIR,
  DONE_CODING_LOG_OUTPUT_DIR_NAME,
  DONE_CODING_SERIES_DEFAULT,
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL_DESC,
} from "./const";
import { getSafePath } from "./path";
import { getLogTime } from "./time";
import { uuidv4 } from "./uuid";
import { tmpdir, homedir } from "node:os";
import path from "node:path";

/** 环境配置 - 调用模式枚举 */
export enum EnvConfigCallModeEnum {
  DEFAULT = "DEFAULT",
  MCP = "MCP",
}

/**
 * 环境配置 在进程中 key的初始值枚举
 * ----
 * 都是从父进程创建子进程时的副本,如果自己就是top进程 则对应值需要现生成或者设置
 */
export enum EnvConfigProcessKeyEnum {
  /**
   *
   * done-coding 日志输出对应的系列key在process.env key的初始值[实际使用会拼接其他东西]
   * ---
   * 规划的系列 会有 cli 、server等
   */
  SERIES = "SERIES",
  /**
   * 全局配置镜像
   */
  GLOBAL_CONFIG_IMAGE = "GLOBAL_CONFIG_IMAGE",
}

/**
 * 环境配置
 * ----
 * !!! 不应包含token等敏感信息， 只作为通过环境变量标识及相关 如标记mcp调用场景及相关日志行为等
 * ----
 * !!! 不作为主要的通信方式
 */
export interface EnvConfig {
  /** 调用模式 */
  callMode: EnvConfigCallModeEnum;
  /** 是否允许日志输出到控制台 */
  consoleLog: boolean;
  /** 日志输出路径 */
  logOutputDir: string;
  /**
   * 进程日志文件名列表
   * ----
   * 新进程的日志从左侧进栈
   */
  processLogFileNameList: string[];
}

export interface XGlobalThis {
  [DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL]: EnvConfig;
}

/** 获取进程环境变量key */
const getProcessEnvKey = (keyInit: EnvConfigProcessKeyEnum) => {
  return `${DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL_DESC}_${keyInit}`;
};

/** 进程值变量初始值 */
export interface ProcessValueInit<T> {
  value: T;
}

/** 获取环境变量 */
export const getProcessEnv = <T>(
  keyInit: EnvConfigProcessKeyEnum,
  defaultValue?: T,
): T | undefined => {
  const valueInitStr = process.env[getProcessEnvKey(keyInit)];
  if (valueInitStr !== undefined) {
    try {
      const valueInit = JSON.parse(valueInitStr) as ProcessValueInit<T>;
      return valueInit.value;
    } catch (error) {
      return defaultValue;
    }
  } else {
    return defaultValue;
  }
};

/**
 * 设置进程环境变量
 * ---
 * !!! 不对外部暴露该方法
 * !!! 设置后不允许更新
 * @returns 是否设置成功
 */
const setProcessEnv = <T>(
  keyInit: EnvConfigProcessKeyEnum,
  value: T,
): boolean => {
  const currentValue = getProcessEnv(keyInit);
  if (currentValue !== undefined) {
    return false;
  }
  const key = getProcessEnvKey(keyInit);
  const valueInit: ProcessValueInit<T> = { value };
  process.env[key] = JSON.stringify(valueInit);
  return true;
};

/** 从全局获取配置 */
const getEnvConfigFromGlobal = () =>
  (globalThis as unknown as XGlobalThis)[DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL];

/**
 * 设置环境配置
 * -----
 * 不对外部暴露方法
 */
const setEnvConfig = (configInit: EnvConfig): EnvConfig => {
  const globalConfig = getEnvConfigFromGlobal();
  if (globalConfig) {
    return globalConfig;
  }
  const config = Object.freeze({
    ...configInit,
  });
  Object.defineProperty(globalThis, DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL, {
    value: config,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  setProcessEnv(EnvConfigProcessKeyEnum.GLOBAL_CONFIG_IMAGE, config);
  return config;
};

/** 从进程变量获取配置 */
const getEnvConfigFromProcess = () =>
  getProcessEnv<EnvConfig>(EnvConfigProcessKeyEnum.GLOBAL_CONFIG_IMAGE);

/** 获取默认环境撇值 */
const getDefaultEnvConfig = (): EnvConfig => {
  const seriesRaw = getProcessEnv(
    EnvConfigProcessKeyEnum.SERIES,
    DONE_CODING_SERIES_DEFAULT,
  );
  const series = getSafePath(seriesRaw);
  return {
    callMode: EnvConfigCallModeEnum.DEFAULT,
    consoleLog: true,
    logOutputDir: `${DONE_CODING_CONFIG_RELATIVE_DIR}/${series}/${DONE_CODING_LOG_OUTPUT_DIR_NAME}`,
    processLogFileNameList: [],
  };
};

/**
 * 获取应用的环境配置
 * ---
 * !!! 内部懒设置 即使用时才在查询并在合适时机同步到内存中
 * !!! 不对外部暴露
 */
const getApplyConfig = (): EnvConfig => {
  // 优先从全局内存中读 读不到从process中读
  const globalConfig = getEnvConfigFromGlobal();
  if (globalConfig) {
    return globalConfig;
  }
  // 从process那上级进程的全局内存配置副本
  const processConfig = getEnvConfigFromProcess();
  /**
   * 走到此处两种情况
   * 1. top进程未设置 global config
   * 2. 子进程只在process中有但是不在global内存中
   */
  const currentProcessLogFileName = `${getLogTime()}-${uuidv4()}`;

  if (processConfig) {
    // 有父进程

    const currentGlobalConfig: EnvConfig = {
      ...processConfig,
      processLogFileNameList: [
        currentProcessLogFileName,
        ...processConfig.processLogFileNameList,
      ].slice(0, 10),
    };
    return setEnvConfig(currentGlobalConfig);
  } else {
    const defaultConfig = getDefaultEnvConfig();
    // 自身是顶级进程 但是尚未设置
    const currentGlobalConfig: EnvConfig = {
      ...defaultConfig,
      processLogFileNameList: [currentProcessLogFileName],
    };
    return setEnvConfig(currentGlobalConfig);
  }
};

/** 获取调用模式 */
export const getCallMode = () => {
  return getApplyConfig().callMode;
};

/** 是mcp模式 */
export const isMcpMode = () => {
  return getCallMode() === EnvConfigCallModeEnum.MCP;
};

/** 允许输出日志到控制台 */
export const allowConsoleLog = () => {
  const isMcp = isMcpMode();
  return isMcp ? false : getApplyConfig().consoleLog;
};

/**
 * 获取日志文件夹
 * ----
 * 绝对路径
 * @param persistent 是否持久话
 */
export const getLogOutputDir = (persistent = false) => {
  return path.resolve(
    persistent ? homedir() : tmpdir(),
    getApplyConfig().logOutputDir,
  );
};

/** 获取自身进程日志文件名 */
export const getCurrentProcessLogFileName = () => {
  return getApplyConfig().processLogFileNameList[0];
};

/** 获取父级进程日志文件名 */
export const getParentProcessLogFileName = (): string | undefined => {
  return getApplyConfig().processLogFileNameList[1];
};
