import {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 检测工程化配置*/
  CHECK = "check",
  /** 添加工程化配置 */
  ADD = "add",
}

/** (工程化)配置模块枚举 */
export enum ConfigModuleEnum {
  /** eslint 配置 */
  ESLINT = "eslint",
  /** prettier 配置 */
  PRETTIER = "prettier",
  /** 提交配置 */
  COMMITLINT = "commitlint",
  /** 文件配置 */
  LSLINT = "ls-lint",
  /** (git)合并检测 */
  MERGELINT = "merge-lint",
}

/** config命令的配置 */
export interface ConfigConfig {
  moduleList?: ConfigModuleEnum[];
}

/** 初始化配置选项 */
export interface initConfigOptions extends InitConfigFileOptions {}

/** 检测配置选项 */
export interface CheckConfigOptions
  extends ReadConfigFileOptions,
    Partial<ConfigConfig> {}

/** 添加配置选项 */
export interface AddConfigOptions
  extends ReadConfigFileOptions,
    Partial<ConfigConfig> {
  /** 是否直接提交git */
  commitGit?: boolean;
}

/** 各类型工程化配置信息 */
export type TypeConfigInfo = {
  [key in ConfigModuleEnum]?: {
    version: string;
    /** 配置文件相对路径 */
    configFileRelativePathList: string[];
  };
};

/** 配置文件信息 */
export interface ConfigConfigFileInfo {
  /**
   * 待复制的配置文件路径
   * ---
   * 相对于当前工程化模块目录对应的版本目录
   */
  sourceFile: string;
  /**
   * 目标配置文件路径
   * ---
   * 相对于命令运行目录
   */
  targetFile: string;
  /** 描述 */
  description?: string;
  /** 当前配置依赖的额外包 */
  relyPackages?: string[];
}

/** 项目配置单项 */
export interface ConfigProjectConfigItem {
  version: string;
  /** 配置文件配置列表 */
  configFileInfoList: ConfigConfigFileInfo[];
  /** 依赖的包 */
  relyPackages?: string[];
  /** package.json需要添加的配置 */
  packageJson?: {
    scripts?: Record<string, string>;
    "lint-staged"?: Record<string, string[]>;
  };
  /** husky需要添加的配置 */
  husky?: {
    hooks?: Record<string, string>;
  };
  /** 运行脚本 */
  runScripts?: string[];
}

/**
 * 项目配置
 * ---
 * value 为 string时则是该模块对应的预置列表json文件名【相对于所属工程化模块目录】，如 reset-list.json
 */
export type ConfigProject = Record<string, ConfigProjectConfigItem[] | string>;

/** 工程化配置 */
export interface ConfigConfigJson {
  project: ConfigProject;
}
