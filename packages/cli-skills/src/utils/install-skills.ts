import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SkillMeta } from "@/types";

/** 单个 skill 安装状态 */
export type InstallStatus = "installed" | "overwritten" | "skipped";

/** 单个 skill 安装结果 */
export interface InstallSkillResult {
  name: string;
  targetDir: string;
  status: InstallStatus;
}

/**
 * 将选中的 skill 源目录拷贝到目标 skills 根目录下（`targetSkillsDir/<name>`）。
 * ---
 * 已存在同名目录：默认 `skipped` 不动；`force=true` 时整目录覆盖。
 * 单个失败不影响其余（不抛批量中断）。
 */
export const installSkills = (
  skills: SkillMeta[],
  targetSkillsDir: string,
  { force = false }: { force?: boolean } = {},
): InstallSkillResult[] => {
  mkdirSync(targetSkillsDir, { recursive: true });
  return skills.map((skill) => {
    const targetDir = join(targetSkillsDir, skill.name);
    const exists = existsSync(targetDir);
    if (exists && !force) {
      return { name: skill.name, targetDir, status: "skipped" };
    }
    cpSync(skill.sourceDir, targetDir, { recursive: true, force: true });
    return {
      name: skill.name,
      targetDir,
      status: exists ? "overwritten" : "installed",
    };
  });
};
