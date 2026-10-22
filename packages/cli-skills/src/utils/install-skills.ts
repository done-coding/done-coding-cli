import {
  cpSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join, sep } from "node:path";
import { safeRemoveDirSync } from "@done-coding/cli-utils";
import { SkillTargetEnum, type SkillMeta } from "@/types";

/** 单个 skill 安装状态 */
export type InstallStatus = "installed" | "overwritten" | "skipped";

/** 单个 skill 安装结果 */
export interface InstallSkillResult {
  name: string;
  targetDir: string;
  status: InstallStatus;
}

/** 目标宿主的 skills 根目录：`<家目录 | 项目根>/.<target>/skills` */
export const resolveTargetSkillsDir = (
  {
    global = false,
    target = SkillTargetEnum.CLAUDE,
  }: { global?: boolean; target?: SkillTargetEnum },
  { cwd, home }: { cwd: string; home: string },
): string => join(global ? home : cwd, `.${target}`, "skills");

/** 软链源不得位于 npx 临时缓存：缓存被清理后链会悬空 */
export const assertLinkableSource = (sourceDir: string): void => {
  if (sourceDir.includes(`${sep}_npx${sep}`)) {
    throw new Error(
      `软链模式需本地或全局安装本包（当前来自 npx 临时缓存，清理后软链会失效）：${sourceDir}`,
    );
  }
};

/** 路径本身是否存在（不跟随软链，悬空软链也算存在） */
const entryExists = (path: string): boolean => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * 移除已安装的同名 skill：软链只摘链（[MUST NOT] 跟随进包内源目录），
 * 实体目录走 safeRemoveDirSync（限定在 skills 根内）。
 */
const removeInstalled = (targetDir: string, targetSkillsDir: string): void => {
  if (lstatSync(targetDir).isSymbolicLink()) {
    unlinkSync(targetDir);
    return;
  }
  safeRemoveDirSync({
    targetPath: targetDir,
    parentDir: targetSkillsDir,
    label: "已安装 skill",
  });
};

/**
 * 把选中的 skill 装到目标 skills 根目录下（`targetSkillsDir/<name>`）：默认复制，`link` 时建软链。
 * ---
 * 已存在同名项（含悬空软链）：默认 `skipped` 不动；`force=true` 时先移除再装。
 */
export const installSkills = (
  skills: SkillMeta[],
  targetSkillsDir: string,
  { force = false, link = false }: { force?: boolean; link?: boolean } = {},
): InstallSkillResult[] => {
  mkdirSync(targetSkillsDir, { recursive: true });
  return skills.map((skill) => {
    const targetDir = join(targetSkillsDir, skill.name);
    const exists = entryExists(targetDir);
    if (exists && !force) {
      return { name: skill.name, targetDir, status: "skipped" };
    }
    if (exists) removeInstalled(targetDir, targetSkillsDir);
    if (link) {
      symlinkSync(realpathSync(skill.sourceDir), targetDir, "junction");
    } else {
      cpSync(skill.sourceDir, targetDir, { recursive: true });
    }
    return {
      name: skill.name,
      targetDir,
      status: exists ? "overwritten" : "installed",
    };
  });
};
