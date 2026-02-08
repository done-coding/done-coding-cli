import {
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL,
  DONE_CODING_CURRENT_LOG_FILE_NAME_SYMBOL,
  DONE_CODING_CONFIG_RELATIVE_DIR,
  DONE_CODING_LOG_OUTPUT_DIR_NAME,
  DONE_CODING_SERIES_DEFAULT,
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL_DESC,
  DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON_KEY,
} from "@/const";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import {
  createOutputConsole,
  createOutputLogFile,
  OutputConsoleTypeEnum,
} from "@done-coding/output-node";
import { assetIsExits } from "@/file-operate";
import fs from "node:fs";
import { dayjs } from "@/time";

/**
 * 环境配置 在进程中 key的初始值枚举
 */
export enum EnvConfigProcessKeyEnum {
  /**
   * 全局配置镜像
   */
  GLOBAL_CONFIG_IMAGE = "GLOBAL_CONFIG_IMAGE",
}

/** 自身或祖先进程被劫持进程创建 行为预设信息 */
export interface EnvConfigProcessCreateByHijackPresetInfo {
  /** 开始等待用户输入前退出 */
  beforeInputExit?: boolean;
}

/**
 * 环境配置
 * ----
 * !!! 不应包含token等敏感信息， 只作为通过环境变量标识及相关 如标记mcp调用场景及相关日志行为等
 * ----
 * !!! 不作为主要的通信方式
 */
export interface EnvConfig {
  /** 系列
   * ----
   * 规划的系列 会有 cli 、server等
   * 默认会是 `${DONE_CODING_SERIES_DEFAULT}`
   */
  series: string;
  /**
   * 是否允许日志输出到控制台
   * ---
   * boolean 类型 表示是否允许所有类型日志输出到控制台
   * array 类型 表示允许的日志类型
   */
  consoleLog: boolean | OutputConsoleTypeEnum[];
  /** 日志输出路径 */
  logOutputDir: string;
  /**
   * 进程日志文件名列表
   * ----
   * 新进程的日志从左侧进栈
   */
  processLogFileNameList: string[];
  /** 自身或祖先进程是否被劫持进程创建 */
  processCreateByHijack: boolean;
  /** 自身或祖先进程被劫持进程创建 行为预设信息 */
  processCreateByHijackPresetInfo?: EnvConfigProcessCreateByHijackPresetInfo;
}

export interface XGlobalThis {
  /** 全局配置 */
  [DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL]?: EnvConfig;
  /** 当前进程日志文件名 */
  [DONE_CODING_CURRENT_LOG_FILE_NAME_SYMBOL]?: string;
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
const setProcessEnv = <T>(keyInit: EnvConfigProcessKeyEnum, value: T) => {
  const currentValue = getProcessEnv(keyInit);
  if (currentValue !== undefined) {
    //     asyncLog.system(
    //       `${keyInit} 已存在，将覆盖:
    // `,
    //       JSON.stringify(currentValue, null, 2),
    //       `
    //     =>
    // `,
    //       JSON.stringify(value, null, 2),
    //     );
    // return false;
  }
  const key = getProcessEnvKey(keyInit);
  const valueInit: ProcessValueInit<T> = { value };
  process.env[key] = JSON.stringify(valueInit);
  // asyncLog.system(`${keyInit} 设置完成: `, JSON.stringify(valueInit, null, 2));
  // return true;
};

/** 从全局获取配置 */
const getEnvConfigFromGlobal = () =>
  (globalThis as unknown as XGlobalThis)[DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL];

/** 获取当前进程日志文件名 */
export const getCurrentProcessLogFileName = () => {
  const value = (globalThis as unknown as XGlobalThis)[
    DONE_CODING_CURRENT_LOG_FILE_NAME_SYMBOL
  ];
  if (value) {
    return value;
  } else {
    const newFileName = `${dayjs().format("YYYY-MM-DD_HH-mm-ss")}_${process.pid}.log`;
    (globalThis as unknown as XGlobalThis)[
      DONE_CODING_CURRENT_LOG_FILE_NAME_SYMBOL
    ] = newFileName;
    // asyncLog.system(`设置当前进程日志文件名为: `, newFileName);
    return newFileName;
  }
};

/**
 * 设置环境配置
 * -----
 * 不对外部暴露方法
 */
const setEnvConfig = (configInit: EnvConfig): EnvConfig => {
  const globalConfig = getEnvConfigFromGlobal();
  const config = {
    ...(globalConfig || {}),
    ...configInit,
  };
  setProcessEnv(EnvConfigProcessKeyEnum.GLOBAL_CONFIG_IMAGE, config);
  (globalThis as unknown as XGlobalThis)[DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL] =
    config;
  // asyncLog.system(`设置环境配置完成: `, JSON.stringify(config, null, 2));
  return config;
};

/** 从进程变量获取配置 */
const getEnvConfigFromProcess = () =>
  getProcessEnv<EnvConfig>(EnvConfigProcessKeyEnum.GLOBAL_CONFIG_IMAGE);

/** 获取配置的日志输出目录 - 相对路径 */
const getEnvConfigLogOutputDir = (series: string) => {
  return `${DONE_CODING_CONFIG_RELATIVE_DIR}/${series}/${DONE_CODING_LOG_OUTPUT_DIR_NAME}`;
};

/**
 * 当前是子进程
 */

/** 获取继承的环境配置
 * ------
 * 即上一级进程的配置 如果没有或上级未设置则内部shim一个默认值
 */
const getInheritEnvConfig = (): EnvConfig => {
  const processConfig = getEnvConfigFromProcess();

  let configInit: Omit<
    EnvConfig,
    "processCreateByHijack" | "processCreateByHijackPresetJson"
  >;
  if (processConfig) {
    configInit = processConfig;
  } else {
    const series = DONE_CODING_SERIES_DEFAULT;

    configInit = {
      series,
      consoleLog: true,
      logOutputDir: getEnvConfigLogOutputDir(series),
      processLogFileNameList: [],
    };
  }
  const {
    series,
    consoleLog,
    logOutputDir,
    processLogFileNameList: processLogFileNameListInit,
  } = configInit;

  const currentProcessLogFileName = getCurrentProcessLogFileName();

  const processLogFileNameList = (
    processLogFileNameListInit[0] === currentProcessLogFileName
      ? processLogFileNameListInit
      : [currentProcessLogFileName, ...processLogFileNameListInit]
  ).slice(0, 10);

  const processCreateByHijackPresetJson =
    process.env[DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON_KEY];

  /** 自身或祖先进程被劫持进程创建 行为预设信息 */
  let processCreateByHijackPresetInfo:
    | EnvConfigProcessCreateByHijackPresetInfo
    | undefined;
  if (processCreateByHijackPresetJson) {
    try {
      processCreateByHijackPresetInfo = JSON.parse(
        processCreateByHijackPresetJson,
      ) as EnvConfigProcessCreateByHijackPresetInfo;
    } catch (error) {}
  }

  return {
    series,
    consoleLog,
    logOutputDir,
    processLogFileNameList,
    /** 自身或祖先进程是否被劫持进程创建 */
    processCreateByHijack: !!processCreateByHijackPresetInfo,
    /** 自身或祖先进程被劫持进程创建 行为预设信息 */
    processCreateByHijackPresetInfo,
  };
};

/**
 * 获取应用的环境配置
 */
const getApplyConfig = (): EnvConfig => {
  return getEnvConfigFromGlobal() || getInheritEnvConfig();
};

/**
 * 更新环境配置
 * ---
 * 可以多次调用 不限制进程层级
 */
export const updateEnvConfig = ({
  series = DONE_CODING_SERIES_DEFAULT,
  consoleLog = true,
}: Partial<Pick<EnvConfig, "consoleLog" | "series">>) => {
  const logOutputDir = getEnvConfigLogOutputDir(series);

  const nextConfig = {
    ...getApplyConfig(),
    series,
    consoleLog,
    logOutputDir,
  };

  return setEnvConfig(nextConfig);
};

/** 是否被劫持进程创建 */
export const processIsHijacked = (): boolean => {
  return getApplyConfig().processCreateByHijack;
};

/** 获取自身或祖先进程被劫持进程创建 行为预设信息 */
export const getProcessCreateByHijackPresetInfo = () => {
  return getApplyConfig().processCreateByHijackPresetInfo;
};

/**
 * 获取日志文件夹
 * ----
 * 绝对路径
 * @param persistent 是否持久话
 */
export const getLogOutputDir = (persistent = false) => {
  const dir = path.resolve(
    persistent ? homedir() : tmpdir(),
    getApplyConfig().logOutputDir,
  );
  if (!assetIsExits(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/** 获取父级进程日志文件名 */
export const getParentProcessLogFileName = (): string | undefined => {
  return getApplyConfig().processLogFileNameList[1];
};

/** 日志文件输出实例 */
export const logger = (() => {
  const instance = createOutputLogFile({
    logFilePath: path.resolve(
      getLogOutputDir(),
      getCurrentProcessLogFileName(),
    ),
  });
  /** 标记当前进程是否已写入过文件头 */
  let isHeaderWritten = false;
  /** 写入文件头 */
  if (!isHeaderWritten) {
    const parentLogName = getParentProcessLogFileName();
    if (parentLogName) {
      instance.info(`父进程日志文件: ${parentLogName}`);
      isHeaderWritten = true;
    }
  }
  return instance;
})();

/** 是否允许控制台输出 */
export const isAllowOutputConsole = () => {
  const config = getApplyConfig();
  if (typeof config.consoleLog === "boolean") {
    return config.consoleLog;
  } else {
    return !!config.consoleLog.length;
  }
};

/** 是否允许控制台输出类型 */
const isAllowOutputConsoleType = (type: OutputConsoleTypeEnum) => {
  /** 如果进程被劫持，则允许所有类型输出到控制台 */
  if (processIsHijacked()) {
    return true;
  }
  const config = getApplyConfig();
  if (typeof config.consoleLog === "boolean") {
    return config.consoleLog;
  } else {
    return config.consoleLog.includes(type);
  }
};

/** 控制台输出实例 */
export const outputConsole = createOutputConsole({
  isSwitchLogFile: (type) => {
    if ([OutputConsoleTypeEnum.DEBUG].includes(type)) {
      return true;
    }
    return !isAllowOutputConsoleType(type);
  },
  enableColor: true,
  outputFileFn: (consoleType, ...consoleMessages) => {
    return logger.info({
      consoleType: OutputConsoleTypeEnum[consoleType],
      consoleMessages,
    });
  },
});
