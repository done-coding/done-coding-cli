import { homedir } from "node:os";
import {
  outputConsole,
  safeCwd,
  xPrompts,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import {
  SkillTargetEnum,
  SubcommandEnum,
  type InstallOptions,
  type SkillMeta,
} from "@/types";
import {
  assertLinkableSource,
  getBundledSkillsDir,
  installSkills,
  listSkills,
  resolveTargetSkillsDir,
} from "@/utils";

/** 获取 install 子命令选项 */
export const getOptions = (): YargsOptionsRecord<InstallOptions> => {
  return {
    global: {
      type: "boolean",
      alias: "g",
      describe:
        "安装到家目录 ~/.<target>/skills（默认安装到当前项目 ./.<target>/skills）",
      default: false,
    },
    target: {
      type: "array",
      alias: "t",
      choices: Object.values(SkillTargetEnum),
      describe:
        "安装目标（可多个）：claude → .claude/skills · codex → .codex/skills · agents → .agents/skills（跨工具共享）",
      default: [SkillTargetEnum.CLAUDE],
    },
    link: {
      type: "boolean",
      alias: "l",
      describe:
        "软链到本包内的 skill 目录而非复制（随包升级自动生效；需本地或全局安装本包）",
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

/** install 命令处理器：把内置 skill(s) 安装到各目标宿主的 skills 目录 */
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

  if (argv.link) assertLinkableSource(skillsDir);

  const targets = [
    ...new Set((argv.target ?? [SkillTargetEnum.CLAUDE]).map(String)),
  ] as SkillTargetEnum[];
  const base = { cwd: safeCwd(), home: homedir() };
  const verb = argv.link ? "链接" : "安装";

  for (const target of targets) {
    const targetSkillsDir = resolveTargetSkillsDir(
      { global: argv.global, target },
      base,
    );
    const results = installSkills(selected, targetSkillsDir, {
      force: argv.force,
      link: argv.link,
    });
    for (const result of results) {
      const tag =
        result.status === "skipped"
          ? "跳过(已存在，--force 覆盖)"
          : result.status === "overwritten"
            ? `覆盖${verb}`
            : verb;
      outputConsole.info(`[${tag}] ${result.name} → ${result.targetDir}`);
    }
    const written = results.filter(
      (result) => result.status !== "skipped",
    ).length;
    outputConsole.success(
      `完成：${written}/${results.length} 个 skill 已${verb}到 ${targetSkillsDir}`,
    );
  }
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INSTALL,
  describe:
    "把内置的 done-coding CLI skill(s) 安装到 Claude Code / Codex / .agents 的 skills 目录",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
