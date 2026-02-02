/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-29 23:15:27
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:47:55
 */
import {
  lookForParentTarget,
  decryptAES,
  encryptAES,
  outputConsole,
} from "@done-coding/cli-utils";
import type { GitConfigInfo, GitParamsInfo, GitPlatformEnum } from "@/types";
import fs from "node:fs";
import path from "node:path";
import { MODULE_CONFIG_RELATIVE_PATH } from "./path";

/** 获取平台配置基础路径 */
const getPlatformConfigBasePath = (platform: GitPlatformEnum) => {
  return `${MODULE_CONFIG_RELATIVE_PATH}/.${platform}`;
};

/** 获取git配置文件密钥 */
const getGitConfigFileSecretKey = ({ platform, username }: GitParamsInfo) => {
  return `${platform}/${username}`;
};

/**
 * 获取配置信息
 */
export const getGitConfigInfo = (
  params: GitParamsInfo,
): GitConfigInfo | undefined => {
  const { platform } = params;
  const platformConfigBasePath = getPlatformConfigBasePath(platform);
  /** 配置目录 */
  const parentGitDir = lookForParentTarget(platformConfigBasePath, {
    isFindFarthest: false,
  });
  if (!parentGitDir) {
    outputConsole.warn(`配置文件不存在`);
    return;
  }
  // outputConsole.info(`配置文件目录 ${parentGitDir}`);
  /** 配置文件路径 */
  const configFilePath = `${parentGitDir}/${platformConfigBasePath}`;

  const configStr = fs.readFileSync(configFilePath, "utf-8");

  const secretKey = getGitConfigFileSecretKey(params);
  // outputConsole.info(`配置文件解密密钥 ${secretKey}`);

  const configDecrypt = decryptAES({ encryptedText: configStr, secretKey });

  if (!configDecrypt) {
    outputConsole.warn(`配置文件解密失败`);
    return;
  }

  const config: GitConfigInfo = JSON.parse(configDecrypt);

  return config;
};

/**
 * 设置配置信息
 */
export const setGitConfigInfo = ({
  rootDir,
  username,
  platform,
  accessToken,
}: {
  /** 根目录 */
  rootDir: string;
  /** 访问令牌 */
  accessToken: string;
} & GitParamsInfo) => {
  const platformConfigBasePath = getPlatformConfigBasePath(platform);

  const info: GitConfigInfo = {
    accessToken,
  };
  const infoStr = JSON.stringify(info);

  const secretKey = getGitConfigFileSecretKey({ platform, username });

  // outputConsole.info(`配置文件加密密钥 ${secretKey}`);

  const encryptedInfo = encryptAES({ text: infoStr, secretKey });

  const configFilePath = path.join(rootDir, platformConfigBasePath);

  fs.mkdirSync(path.dirname(configFilePath), {
    recursive: true,
  });

  fs.writeFileSync(configFilePath, encryptedInfo, "utf-8");

  outputConsole.success(`配置信息保存成功 ${configFilePath}`);
};
