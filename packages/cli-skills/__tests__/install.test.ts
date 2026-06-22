import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSkills } from "@/utils/skills-source";
import { installSkills } from "@/utils/install-skills";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cli-skills-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** 在 dir 下造一个含 SKILL.md 的 skill 目录 */
const makeSkill = (dir: string, name: string, description: string) => {
  const skillDir = join(dir, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\nbody`,
  );
};

describe("listSkills", () => {
  it("枚举含 SKILL.md 的子目录并解析 frontmatter description", () => {
    const src = join(root, "skills");
    makeSkill(src, "create-done-coding", "创建 done-coding 项目");
    mkdirSync(join(src, "no-skill-md"), { recursive: true }); // 无 SKILL.md，应跳过

    const list = listSkills(src);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("create-done-coding");
    expect(list[0].description).toBe("创建 done-coding 项目");
  });

  it("目录不存在时返回空数组", () => {
    expect(listSkills(join(root, "nope"))).toEqual([]);
  });
});

describe("installSkills", () => {
  it("拷贝到目标并标记 installed；已存在默认 skipped，force 覆盖", () => {
    const src = join(root, "skills");
    makeSkill(src, "create-done-coding", "创建 done-coding 项目");
    const skills = listSkills(src);
    const target = join(root, ".claude", "skills");

    const first = installSkills(skills, target);
    expect(first[0].status).toBe("installed");
    expect(existsSync(join(target, "create-done-coding", "SKILL.md"))).toBe(
      true,
    );

    const again = installSkills(skills, target);
    expect(again[0].status).toBe("skipped");

    const forced = installSkills(skills, target, { force: true });
    expect(forced[0].status).toBe("overwritten");
  });
});
