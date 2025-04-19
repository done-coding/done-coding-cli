import {
  lookForParentTarget,
  decryptAES,
  encryptAES,
} from "@done-coding/node-tools";
import type { GitConfigInfo, GitPlatformEnum } from "./types";
import injectInfo from "@/injectInfo.json";
import fs from "node:fs";
import chalk from "chalk";
import path from "node:path";
const { namespaceDir, moduleName } = injectInfo.cliConfig;

const CONFIG_DIR = `${namespaceDir}/${moduleName}`;

/** 获取平台配置基础路径 */
const getPlatformConfigBasePath = (platform: GitPlatformEnum) => {
  return `${CONFIG_DIR}/.${platform}`;
};

/**
 * 获取配置信息
 */
export const getGitConfigInfo = ({
  secretKey,
  platform,
}: {
  /** 秘钥 */
  secretKey: string;
  /** 平台 */
  platform: GitPlatformEnum;
}): GitConfigInfo | undefined => {
  const platformConfigBasePath = getPlatformConfigBasePath(platform);
  /** 配置目录 */
  const parentGitDir = lookForParentTarget(platformConfigBasePath);
  if (!parentGitDir) {
    console.log(chalk.yellow(`配置文件不存在`));
    return;
  }
  /** 配置文件路径 */
  const configFilePath = `${parentGitDir}/${platformConfigBasePath}`;

  const configStr = fs.readFileSync(configFilePath, "utf-8");

  const configDecrypt = decryptAES({ encryptedText: configStr, secretKey });

  if (!configDecrypt) {
    console.log(chalk.yellow(`配置文件解密失败`));
    return;
  }

  const config: GitConfigInfo = JSON.parse(configDecrypt);

  return config;
};

/**
 * 设置配置信息
 */
export const setGitConfigInfo = ({
  secretKey,
  platform,
  accessToken,
}: {
  accessToken: string;
  /** 秘钥 */
  secretKey: string;
  /** 平台 */
  platform: GitPlatformEnum;
}) => {
  const platformConfigBasePath = getPlatformConfigBasePath(platform);

  const info: GitConfigInfo = {
    accessToken,
  };
  const infoStr = JSON.stringify(info);
  const encryptedInfo = encryptAES({ text: infoStr, secretKey });

  fs.mkdirSync(path.resolve(path.dirname(platformConfigBasePath)), {
    recursive: true,
  });

  fs.writeFileSync(
    path.resolve(platformConfigBasePath),
    encryptedInfo,
    "utf-8",
  );
};
