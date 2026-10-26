/** 子命令枚举 */
export enum SubcommandEnum {
  /** 重生成治理清单 */
  LISTS = "lists",
  /** 治理闸 */
  CHECK = "check",
  /** 指令预算与兼容入口 */
  INSTRUCTIONS = "instructions",
  /** 跨仓提 issue */
  ISSUE = "issue",
  /** 仓库注册表 */
  SCOPE = "scope",
}

/** scope 子动作 */
export enum ScopeActionEnum {
  /** 列出登记的仓 */
  LIST = "list",
  /** 校验注册表 */
  CHECK = "check",
  /** 登记 / 更新当前仓 */
  REGISTER = "register",
}

/** 定位治理目录的公共选项 */
export interface GovernanceDirOptions {
  /** 治理目录（相对项目根），缺省读配置或 docs/governance */
  dir?: string;
}

/** lists 选项 */
export interface ListsOptions extends GovernanceDirOptions {
  /** 只校验不写盘，有差异即退出码 1 */
  check: boolean;
}

/** check 选项 */
export type CheckOptions = GovernanceDirOptions;

/** issue 选项 */
export interface IssueOptions {
  /** 目标仓根目录，或注册表中的仓名 */
  target: string;
  /** 标题 */
  title: string;
  /** 语义 slug */
  slug: string;
  /** 正文文件（现象 + 复现） */
  bodyFile: string;
  /** 来源仓名，缺省取当前 git 仓目录名 */
  from?: string;
}

/** scope 选项 */
export interface ScopeOptions {
  action: ScopeActionEnum;
  /** list：只列开了 issue 收件箱的仓 */
  inbox?: boolean;
  /** list：输出 JSON（供 skill / 脚本读） */
  json?: boolean;
  /** register：仓名，缺省沿用已有登记或仓根目录名 */
  name?: string;
  /** register：定位（一句话） */
  positioning?: string;
  /** register：受理范围 */
  accepts?: string;
  /** register：治理裁剪档位 */
  tier?: string;
  /** register：治理目录（相对仓根），缺省读配置或 docs/governance */
  dir?: string;
}

/** instructions 选项 */
export interface InstructionsOptions {
  json?: boolean;
}
