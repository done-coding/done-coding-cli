import type { CliHandlerArgv } from "@done-coding/cli-utils";
import type { InitOptions } from "./types";
import { getRootDirOptions, xPrompts } from "@done-coding/cli-utils";
import { gitAccessTokenForm, gitUsernameForm, platformForm } from "./question";
import { setGitConfigInfo } from "./config";
import os from "node:os";

/** 获取初始化选项 */
export const getInitOptions = () => getRootDirOptions(os.homedir());

/** 初始化命令处理器 */
export const initHandler = async (argv: CliHandlerArgv<InitOptions>) => {
  const { rootDir } = argv;
  const { platform } = await xPrompts(platformForm);
  const { username } = await xPrompts(gitUsernameForm);
  const { accessToken } = await xPrompts(gitAccessTokenForm);

  await setGitConfigInfo({
    rootDir,
    platform,
    username,
    accessToken,
  });
};
