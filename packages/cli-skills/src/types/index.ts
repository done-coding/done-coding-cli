/** 子命令枚举 */
export enum SubcommandEnum {
  INSTALL = "install",
}

/** install 子命令选项 */
export interface InstallOptions {
  /** 安装到全局 ~/.claude/skills（默认安装到项目 ./.claude/skills） */
  global?: boolean;
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
