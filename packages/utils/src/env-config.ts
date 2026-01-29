import { asyncLog, getLogTime } from "@/_init";
import {
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL,
  DONE_CODING_CONFIG_RELATIVE_DIR,
  DONE_CODING_LOG_OUTPUT_DIR_NAME,
  DONE_CODING_SERIES_DEFAULT,
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL_DESC,
} from "@/const";
import { getSafePath } from "@/path";
import { uuidv4 } from "@/uuid";
import { tmpdir, homedir } from "node:os";
import path from "node:path";

/** 环境配置 - 调用模式枚举 */
export enum EnvConfigCallModeEnum {
  DEFAULT = "DEFAULT",
  MCP = "MCP",
}

/**
 * 环境配置 在进程中 key的初始值枚举
 */
export enum EnvConfigProcessKeyEnum {
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
  /** 系列
   * ----
   * 规划的系列 会有 cli 、server等
   * 默认会是 `${DONE_CODING_SERIES_DEFAULT}`
   */
  series: string;
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
    asyncLog.system(`环境配置已存在: `, globalConfig);
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
  asyncLog.system(`设置环境配置完成: `, config);
  return config;
};

/** 从进程变量获取配置 */
const getEnvConfigFromProcess = () =>
  getProcessEnv<EnvConfig>(EnvConfigProcessKeyEnum.GLOBAL_CONFIG_IMAGE);

/**
 * 当前是子进程
 */
const isChildProcess = typeof process.send === "function";

/** 获取默认环境配置 */
const getDefaultEnvConfig = (
  seriesInit = DONE_CODING_SERIES_DEFAULT,
): EnvConfig => {
  const series = getSafePath(seriesInit);
  return {
    callMode: EnvConfigCallModeEnum.DEFAULT,
    series,
    consoleLog: true,
    logOutputDir: `${DONE_CODING_CONFIG_RELATIVE_DIR}/${series}/${DONE_CODING_LOG_OUTPUT_DIR_NAME}`,
    processLogFileNameList: [],
  };
};

/**
 * 一个进程激活后客观存在
 */
const currentProcessLogFileName = `${getLogTime()}-${uuidv4()}`;

/**
 * 将processConfig设置为全局配置
 */
const setEnvConfigFromProcessConfig = (processConfig: EnvConfig) => {
  const currentGlobalConfig: EnvConfig = {
    ...processConfig,
    processLogFileNameList: [
      currentProcessLogFileName,
      ...processConfig.processLogFileNameList,
    ].slice(0, 10),
  };
  return setEnvConfig(currentGlobalConfig);
};

/**
 * 获取应用的环境配置
 * ---
 * !!! 子进程随时调用 都是幂等 即内部懒设置 即使用时才在查询并在合适时机同步到内存中
 * !!! 顶级进程如果在initEnvConfig之前调用 会导致 initEnvConfig 调用时报错
 * ---
 * 获取了应用配置后即当前进程不可更改 避免多次调用 结果不一致
 */
const getApplyConfig = (): EnvConfig => {
  // 优先从全局内存中读 读不到从process中读
  const globalConfig = getEnvConfigFromGlobal();
  if (globalConfig) {
    return globalConfig;
  }

  /**
   * 走到这里说明两种情况
   * 1. 顶级进程未设置 global config即未调用或者不需要调用 initEnvConfig
   * 2. 子顶级进程
   */

  // 从process那上级进程的全局内存配置副本
  const processConfig = getEnvConfigFromProcess();
  // 不存在说明是情况2 需要抛错
  if (processConfig) {
    return setEnvConfigFromProcessConfig(processConfig);
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

/**
 * 初始化环境配置
 * ---
 * !!! 顶级进程才调用且只能调用一次
 * 非顶级进程调用会忽略入参 即优先使用父级设置的进程配置
 * ---
 * 即顶级进程调用
 * 非顶级进程通过进程环境继承
 */
export const initEnvConfig = ({
  series,
  ...otherConfig
}: Partial<
  Pick<EnvConfig, "callMode" | "consoleLog"> & {
    series: string;
  }
>) => {
  if (isChildProcess) {
    const errMsg = `非顶级进程不允许调用该方法`;
    throw new Error(errMsg);
  }

  /**
   * 全局内存中读
   * ---
   * 如果有globalConfig配置 必有processConfig, 即setEnvConfig会在设置全局配置时同步到processConfig中
   */
  const globalConfig = getEnvConfigFromGlobal();
  if (globalConfig) {
    const errMsg = `内存全局配置存在，说明是以下某个原因:
1. 顶级进程重复调用initEnvConfig
2. 顶级进程在调用该方法之前调用了getApplyConfig, 即获取配置应用的同时会冻结配置 不会后续变化
------
如果是顶级进程 请第一时间调用，请给对应调用包专门顶级进程才会调用的入口 并调用此方法
如 mcp模式入口 需要第一时间调用此方法
`;
    throw new Error(errMsg);
  } else {
    // 从process那上级进程的全局内存配置副本
    const processConfig = getEnvConfigFromProcess();
    // 存在顶级进程且顶级进程设置了 processConfig
    if (processConfig) {
      return setEnvConfigFromProcessConfig(processConfig);
    } else {
      const defaultConfig = getDefaultEnvConfig(series);
      // 自身是顶级进程 但是尚未设置
      const currentGlobalConfig: EnvConfig = {
        ...defaultConfig,
        ...otherConfig,
        processLogFileNameList: [currentProcessLogFileName],
      };
      return setEnvConfig(currentGlobalConfig);
    }
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
