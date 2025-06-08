import type { EnginConfig } from "@/types";
import {
  EnginConfigKeyEnum,
  EnginPackageEnum,
  LintStagedKeyEnum,
} from "@/types";

const config: EnginConfig = {
  [EnginConfigKeyEnum.DEV_DEPENDENCIES]: {
    "@commitlint/cli": "^16.3.0",
    "@commitlint/config-conventional": "^16.2.4",
    [EnginPackageEnum.LS_LINT]: "^2.2.3",
    "@typescript-eslint/eslint-plugin": "^6.7.0",
    "@typescript-eslint/parser": "^6.7.0",
    [EnginPackageEnum.ESLINT]: "^8.49.0",
    "eslint-config-alloy": "^5.1.2",
    "eslint-plugin-regexp": "^2.7.0",
    [EnginPackageEnum.HUSKY]: "^8.0.3",
    [EnginPackageEnum.PRETTIER]: "^3.0.3",
    [EnginPackageEnum.LINT_STAGED]: "^12.5.0",
  },
  [EnginConfigKeyEnum.LINT_STAGED]: {
    [LintStagedKeyEnum.MONOREPO_LINT_STAGED]: ["ls-lint"],
    [LintStagedKeyEnum.SINGLE_LINT_STAGED]: ["ls-lint"],
    [LintStagedKeyEnum.FILE_LINT_STAGED]: ["eslint --fix", "prettier --write"],
  },
};

export default config;
