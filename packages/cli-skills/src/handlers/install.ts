import { homedir } from "node:os";
import { join } from "node:path";
import {
  outputConsole,
  safeCwd,
  xPrompts,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { SubcommandEnum, type InstallOptions, type SkillMeta } from "@/types";
import { getBundledSkillsDir, listSkills, installSkills } from "@/utils";

/** 获取 install 子命令选项 */
export const getOptions = (): YargsOptionsRecord<InstallOptions> => {
  return {
    global: {
      type: "boolean",
      alias: "g",
      describe:
        "安装到全局 ~/.claude/skills（默认安装到项目 ./.claude/skills）",
      default: false,
    },
    all: {
      type: "boolean",
      alias: "a",
      describe: "安装全部内置 skill，跳过交互选择",
      default: false,
    },
    skill: {
      type: "array",
      alias: "s",
      describe: "指定要安装的 skill 名称（可多个），跳过交互选择",
    },
    force: {
      type: "boolean",
      alias: "f",
      describe: "覆盖已存在的同名 skill",
      default: false,
    },
  };
};

/** 解析本次要安装的 skill 集合：--all > --skill > 交互多选 */
const resolveSelectedSkills = async (
  argv: CliHandlerArgv<InstallOptions>,
  available: SkillMeta[],
): Promise<SkillMeta[]> => {
  if (argv.all) {
    return available;
  }

  const wanted = (argv.skill ?? []).map(String);
  if (wanted.length > 0) {
    const missing = wanted.filter(
      (name) => !available.some((skill) => skill.name === name),
    );
    if (missing.length > 0) {
      outputConsole.warn(`未找到 skill: ${missing.join(", ")}`);
    }
    return available.filter((skill) => wanted.includes(skill.name));
  }

  const { picked } = await xPrompts({
    type: "multiselect",
    name: "picked",
    message: "选择要安装的 skill（空格勾选，回车确认）",
    choices: available.map((skill) => ({
      title: skill.name,
      value: skill.name,
      description: skill.description,
    })),
    min: 1,
  });
  const pickedNames = (picked ?? []) as string[];
  return available.filter((skill) => pickedNames.includes(skill.name));
};

/** install 命令处理器：把内置 skill(s) 安装到 .claude/skills */
export const handler = async (argv: CliHandlerArgv<InstallOptions>) => {
  const skillsDir = getBundledSkillsDir();
  const available = listSkills(skillsDir);
  if (available.length === 0) {
    outputConsole.warn(`未发现任何内置 skill（目录: ${skillsDir}）`);
    return;
  }

  const selected = await resolveSelectedSkills(argv, available);
  if (selected.length === 0) {
    outputConsole.warn("未选择任何 skill，已退出");
    return;
  }

  const targetSkillsDir = argv.global
    ? join(homedir(), ".claude", "skills")
    : join(safeCwd(), ".claude", "skills");

  const results = installSkills(selected, targetSkillsDir, {
    force: argv.force,
  });

  for (const result of results) {
    const tag =
      result.status === "skipped"
        ? "跳过(已存在，--force 覆盖)"
        : result.status === "overwritten"
          ? "覆盖"
          : "安装";
    outputConsole.info(`[${tag}] ${result.name} → ${result.targetDir}`);
  }

  const written = results.filter(
    (result) => result.status !== "skipped",
  ).length;
  outputConsole.success(
    `完成：${written}/${results.length} 个 skill 已写入 ${targetSkillsDir}`,
  );
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INSTALL,
  describe: "把内置的 done-coding CLI skill(s) 安装到 .claude/skills",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
