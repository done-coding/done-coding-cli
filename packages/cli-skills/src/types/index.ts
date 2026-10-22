/** 子命令枚举 */
export enum SubcommandEnum {
  INSTALL = "install",
}

/** 安装目标宿主：skills 落在 `.<target>/skills`（Claude Code / Codex / 跨工具共享的 Agent Skills 目录） */
export enum SkillTargetEnum {
  CLAUDE = "claude",
  CODEX = "codex",
  AGENTS = "agents",
}

/** install 子命令选项 */
export interface InstallOptions {
  /** 安装到家目录（默认安装到当前项目） */
  global?: boolean;
  /** 安装目标宿主（可多个），缺省 claude */
  target?: SkillTargetEnum[];
  /** 软链到包内 skill 目录而非复制（随包升级自动生效） */
  link?: boolean;
  /** 安装全部内置 skill，跳过交互选择 */
  all?: boolean;
  /** 指定要安装的 skill 名称（可多个），跳过交互选择 */
  skill?: string[];
  /** 覆盖已存在的同名 skill */
  force?: boolean;
}

/** 内置 skill 元信息（取自各 SKILL.md frontmatter） */
export interface SkillMeta {
  /** skill 名（= 目录名，作为安装目标目录名与唯一标识） */
  name: string;
  /** 一句话描述（取自 SKILL.md frontmatter description） */
  description: string;
  /** 该 skill 源目录绝对路径 */
  sourceDir: string;
}
