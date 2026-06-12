import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillMeta } from "@/types";

/**
 * 内置 skill 根目录。
 * ---
 * 构建产物落在 `<pkg>/es/*.mjs`，skill 资源随包发布在 `<pkg>/skills`，
 * 故相对构建产物上跳一级取 `../skills`。
 */
export const getBundledSkillsDir = (): string =>
  fileURLToPath(new URL("../skills", import.meta.url));

/** 最小解析 SKILL.md frontmatter 的 name / description（不引入 yaml 依赖） */
const parseSkillFrontmatter = (
  markdown: string,
): { name?: string; description?: string } => {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const body = match[1];
  const pick = (key: string): string | undefined => {
    const line = body.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, "m"));
    return line?.[1]?.trim().replace(/^["']|["']$/g, "");
  };
  return { name: pick("name"), description: pick("description") };
};

/** 枚举某 skills 根目录下的全部内置 skill（每个子目录须含 SKILL.md） */
export const listSkills = (skillsDir: string): SkillMeta[] => {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry): SkillMeta | undefined => {
      const sourceDir = join(skillsDir, entry.name);
      const skillFile = join(sourceDir, "SKILL.md");
      if (!existsSync(skillFile)) return undefined;
      const fm = parseSkillFrontmatter(readFileSync(skillFile, "utf-8"));
      return {
        name: entry.name,
        description: fm.description ?? "",
        sourceDir,
      };
    })
    .filter((item): item is SkillMeta => item !== undefined);
};
