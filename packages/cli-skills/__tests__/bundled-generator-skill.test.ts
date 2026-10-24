/**
 * [P3 B7] 内置 cli-generator SKILL.md 可被发现 + frontmatter 正确。
 * 指向**源** skills/ 目录（vite 不拷资源，靠 package.files 发布；测试不依赖构建产物布局）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listSkills } from "@/utils/skills-source";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_SRC = path.resolve(TEST_DIR, "..", "skills");

describe("[P3] 内置 cli-generator skill", () => {
  it("listSkills 发现 cli-generator（name + 非空 description）", () => {
    const skills = listSkills(SKILLS_SRC);
    const gen = skills.find((s) => s.name === "cli-generator");
    expect(gen).toBeTruthy();
    expect(gen?.description.length).toBeGreaterThan(0);
  });

  it("cli-harness skill 可发现，命令面与 dc-harness 一致", () => {
    const skills = listSkills(SKILLS_SRC);
    expect(
      skills.find((s) => s.name === "cli-harness")?.description,
    ).toBeTruthy();
    const md = readFileSync(
      path.join(SKILLS_SRC, "cli-harness", "SKILL.md"),
      "utf-8",
    );
    expect(md).toContain("done-coding harness lists --check");
    expect(md).toContain("done-coding harness check");
    expect(md).toContain("done-coding harness issue <仓名|仓根路径>");
    expect(md).toContain("done-coding harness scope list [--inbox] [--json]");
    expect(md).toContain("done-coding harness scope check");
    expect(md).toContain("done-coding harness scope register");
    expect(md).toContain(".done-coding/harness/governance/config.json");
  });

  it("create-done-coding 既有 skill 仍在（未误删/改）", () => {
    const skills = listSkills(SKILLS_SRC);
    expect(skills.some((s) => s.name === "create-done-coding")).toBe(true);
  });

  it("SKILL.md 命令面与真实 dc-generator 接口一致（cli-skills 规则 6）", () => {
    const md = readFileSync(
      path.join(SKILLS_SRC, "cli-generator", "SKILL.md"),
      "utf-8",
    );
    // 真实命令面：add/remove <type> <name>、list [type]、init <type>、--list-questions、--env
    expect(md).toContain("done-coding generator add <type> <name>");
    expect(md).toContain("done-coding generator remove <type> <name>");
    expect(md).toContain("done-coding generator list");
    expect(md).toContain("done-coding generator init <type>");
    expect(md).toContain("--list-questions");
    expect(md).toContain("--env");
  });
});
