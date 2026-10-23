import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSkills } from "@/utils/skills-source";
import {
  assertLinkableSource,
  installSkills,
  resolveTargetSkillsDir,
} from "@/utils/install-skills";
import { SkillTargetEnum } from "@/types";

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

describe("resolveTargetSkillsDir", () => {
  const base = { cwd: "/proj", home: "/home/u" };
  it("缺省 claude 目标、项目级；-g 落家目录；agents 目标供 Codex / 共享", () => {
    expect(resolveTargetSkillsDir({}, base)).toBe("/proj/.claude/skills");
    expect(resolveTargetSkillsDir({ global: true }, base)).toBe(
      "/home/u/.claude/skills",
    );
    expect(
      resolveTargetSkillsDir(
        { global: true, target: SkillTargetEnum.AGENTS },
        base,
      ),
    ).toBe("/home/u/.agents/skills");
  });
});

describe("installSkills（软链模式）", () => {
  it("link 建指向源目录的软链；force 时软链 / 复制件互换，且不触碰源目录", () => {
    const src = join(root, "skills");
    makeSkill(src, "cli-harness", "治理");
    const skills = listSkills(src);
    const target = join(root, ".agents", "skills");
    const dest = join(target, "cli-harness");

    expect(installSkills(skills, target, { link: true })[0].status).toBe(
      "installed",
    );
    expect(lstatSync(dest).isSymbolicLink()).toBe(true);
    expect(readlinkSync(dest)).toBe(realpathSync(join(src, "cli-harness")));

    // 已有软链 + force 复制：只摘链再复制，源目录内容不被改写
    expect(installSkills(skills, target, { force: true })[0].status).toBe(
      "overwritten",
    );
    expect(lstatSync(dest).isSymbolicLink()).toBe(false);
    expect(
      readFileSync(join(src, "cli-harness", "SKILL.md"), "utf-8"),
    ).toContain("治理");

    // 已有复制件 + force 软链：删复制件后建链
    installSkills(skills, target, { force: true, link: true });
    expect(lstatSync(dest).isSymbolicLink()).toBe(true);
    expect(existsSync(join(src, "cli-harness", "SKILL.md"))).toBe(true);
  });

  it("悬空软链视为已存在：默认跳过，force 时替换", () => {
    const src = join(root, "skills");
    makeSkill(src, "cli-harness", "治理");
    const target = join(root, ".agents", "skills");
    mkdirSync(target, { recursive: true });
    symlinkSync(join(root, "gone"), join(target, "cli-harness"));
    const skills = listSkills(src);
    expect(installSkills(skills, target)[0].status).toBe("skipped");
    expect(
      installSkills(skills, target, { force: true, link: true })[0].status,
    ).toBe("overwritten");
    expect(existsSync(join(target, "cli-harness", "SKILL.md"))).toBe(true);
  });
});

describe("assertLinkableSource", () => {
  it("npx 临时缓存里的包拒绝软链（缓存清理后链会悬空）", () => {
    expect(() =>
      assertLinkableSource("/Users/u/.npm/_npx/abc/node_modules/x/skills"),
    ).toThrow(/npx/);
    expect(() =>
      assertLinkableSource("/usr/local/lib/node_modules/x/skills"),
    ).not.toThrow();
  });
});
