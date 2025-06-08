import type {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 初始化工程化配置 */
  INIT = "init",
  /** 添加工程化 */
  ADD = "add",
}

export type InitOptions = InitConfigFileOptions;

export interface AddOptions extends ReadConfigFileOptions {}

/** 工程化包枚举 */
export enum EnginPackageEnum {
  LS_LINT = "@ls-lint/ls-lint",
  ESLINT = "eslint",
  PRETTIER = "prettier",
  LINT_STAGED = "lint-staged",
  HUSKY = "husky",
}

/** lint-staged key */
export enum LintStagedKeyEnum {
  MONOREPO_LINT_STAGED = "packages/**/src/*",
  SINGLE_LINT_STAGED = "src/*",
  FILE_LINT_STAGED = "*.{ts,js,vue,jsx,tsx}",
}

/** 工程化配置 key */
export enum EnginConfigKeyEnum {
  SCRIPTS = "scripts",
  DEV_DEPENDENCIES = "devDependencies",
  LINT_STAGED = "lint-staged",
}

/** 工程化配置 scripts key */
export enum EnginConfigScriptsEnum {
  PREPARE = "prepare",
}

/** 工程化配置 */
export interface EnginConfig {
  [EnginConfigKeyEnum.SCRIPTS]: {
    [EnginConfigScriptsEnum.PREPARE]: string;
  };
  [EnginConfigKeyEnum.DEV_DEPENDENCIES]: {
    "@commitlint/cli": string;
    "@commitlint/config-conventional": string;

    [EnginPackageEnum.LS_LINT]: string;

    "@typescript-eslint/eslint-plugin": string;
    "@typescript-eslint/parser": string;

    [EnginPackageEnum.ESLINT]: string;
    "eslint-config-alloy": string;
    "eslint-plugin-regexp": string;

    [EnginPackageEnum.HUSKY]: string;

    [EnginPackageEnum.PRETTIER]: string;

    [EnginPackageEnum.LINT_STAGED]: string;
  };
  [EnginConfigKeyEnum.LINT_STAGED]: {
    [LintStagedKeyEnum.MONOREPO_LINT_STAGED]: string[];
    [LintStagedKeyEnum.SINGLE_LINT_STAGED]: string[];
    [LintStagedKeyEnum.FILE_LINT_STAGED]: string[];
  };
}
