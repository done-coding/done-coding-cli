import {
  existsSync,
  mkdirSync,
  realpathSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathIsInsideParentDir, readConfigFile } from "@done-coding/cli-utils";
import { getConfigPath } from "@done-coding/cli-template";
import type { TemplateInstanceInfo } from "./templateSource";
import injectInfo from "@/injectInfo.json";

/** 严格位于 parent 内（不含 parent 本身）；调用方先 realpath 双解，拒绝 symlink 逃逸。 */
const isStrictlyInside = (parentDir: string, targetPath: string) =>
  pathIsInsideParentDir({ targetPath, parentDir });

/** 仅删除 rootDir 内的空父目录，保留其他 CLI 配置与并行草稿。 */
export const cleanupCreateDraftParents = (rootDir: string) => {
  const root = realpathSync(rootDir);
  if (root === path.parse(root).root || root === realpathSync(homedir()))
    return;
  const stop = path.resolve(rootDir, ".done-coding");
  let current = path.resolve(stop, "default/tmp/create");
  while (current === stop || isStrictlyInside(stop, current)) {
    if (existsSync(current)) {
      const realCurrent = realpathSync(current);
      if (!isStrictlyInside(root, realCurrent)) return;
      try {
        rmdirSync(current);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code === "ENOTEMPTY" ||
          (error as NodeJS.ErrnoException).code === "EEXIST"
        )
          return;
        throw error;
      }
    }
    if (current === stop) return;
    current = path.dirname(current);
  }
};

/** normalizeCollectEnvDataForm 会舍弃 secret 标记，直接读原始配置。 */
export const readTemplateSecretKeys = async (
  rootDir: string,
  configPath: string,
): Promise<string[]> => {
  if (!getConfigPath({ rootDir, configPath })) return [];
  const config = await readConfigFile<{
    collectEnvDataForm?: (string | { key: string; secret?: boolean })[];
  }>({ rootDir, configPath });
  return (config?.collectEnvDataForm ?? []).flatMap((item) =>
    typeof item !== "string" && item.secret === true ? [item.key] : [],
  );
};

export const writeTemplateLock = ({
  projectPath,
  source,
  template,
  secretKeys,
  answers,
}: {
  projectPath: string;
  source: Pick<
    TemplateInstanceInfo,
    "url" | "remoteUrl" | "directory" | "branch" | "commit"
  >;
  template?: string;
  secretKeys: string[];
  answers?: Record<string, unknown>;
}) => {
  const root = realpathSync(projectPath);
  const dir = path.resolve(projectPath, ".done-coding");
  mkdirSync(dir, { recursive: true });
  const realDir = realpathSync(dir);
  if (!isStrictlyInside(root, realDir)) throw new Error("出生记录目录越界");
  const target = path.join(dir, "template.lock.json");
  if (existsSync(target) && !isStrictlyInside(root, realpathSync(target)))
    throw new Error("出生记录文件越界");
  const lock = {
    version: 1,
    template: template ?? source.url,
    url: source.url,
    remoteUrl: source.remoteUrl,
    directory: source.directory,
    branch: source.branch,
    commit: source.commit,
    ...(answers === undefined
      ? {}
      : {
          answers: Object.fromEntries(
            Object.entries(answers).filter(
              ([key]) => !secretKeys.includes(key),
            ),
          ),
        }),
    secretKeys,
    createdAt: new Date().toISOString(),
    cli: { name: injectInfo.name, version: injectInfo.version },
  };
  writeFileSync(target, `${JSON.stringify(lock, null, 2)}\n`);
};
