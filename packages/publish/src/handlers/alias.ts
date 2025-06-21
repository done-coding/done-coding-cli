import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import type { AliasOptions, ConfigInfo } from "@/types";
import { PublishModeEnum, SubcommandEnum } from "@/types";
import {
  getConfigFileCommonOptions,
  getPackageJson,
  log,
  readConfigFile,
} from "@done-coding/cli-utils";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";
import { v4 } from "uuid";
import path from "node:path";
import fs, { rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

/** 获取别名发布选项 */
export const getAliasOptions = () =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

/** 别名发布命令处理器 */
export const aliasHandler = async (argv: CliHandlerArgv<AliasOptions>) => {
  const configInfo = await readConfigFile<ConfigInfo>(argv, () => {
    return {};
  });
  const aliasInfoList = configInfo[PublishModeEnum.NPM]?.aliasInfo || [];
  if (!aliasInfoList.length) {
    log.warn("没有配置别名发布信息");
    return;
  }

  const { rootDir } = argv;
  const packageJson = getPackageJson({ rootDir });

  const { name, version } = packageJson;

  const nodeModulesDir = `${homedir()}/.DONE_CODING_CLI_PUBLISH_ALIAS`;

  // 构造新包的临时目录
  const tempDir = path.resolve(nodeModulesDir, v4());

  fs.mkdirSync(tempDir, { recursive: true });

  execSync(`npm install ${name}@${version}`, {
    stdio: "inherit",
    cwd: tempDir,
  });

  const distTagListBuffer = execSync(`npm dist-tag ${name}`);

  const distTagListStr = distTagListBuffer.toString().trim();
  const distTagList = distTagListStr
    .split("\n")
    .map((item) => item.split(":").map((item) => item.trim()));
  const distTag = distTagList.find(
    ([, tagVersion]) => tagVersion === version,
  )?.[0];

  if (!distTag) {
    return log.warn(`没有找到 ${name}@${version} 对应的dist-tag`);
  }

  // console.log(distTag)

  const sourcePck = path.resolve(tempDir, "node_modules", name);

  const sourcePackageJson = getPackageJson({
    rootDir: sourcePck,
  });

  // console.log(aliasInfoList);
  for (let aliasInfo of aliasInfoList) {
    const { packageJson: patchPackageJson } = aliasInfo;

    const newPackageJson = {
      ...sourcePackageJson,
      ...patchPackageJson,
    };

    const newPackageJsonPath = `${sourcePck}/package.json`;

    fs.writeFileSync(
      newPackageJsonPath,
      JSON.stringify(newPackageJson, null, 2),
    );

    execSync(`npm publish --tag ${distTag}`, {
      stdio: "inherit",
      cwd: sourcePck,
    });

    rmSync(tempDir, { recursive: true, force: true });
  }
};

export const aliasCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.ALIAS,
  describe: "别名发布",
  options: getAliasOptions(),
  handler: aliasHandler as SubCliInfo["handler"],
};
