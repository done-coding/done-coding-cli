/**
 * 模板资产层类型（T5，codegen-unified §三-补）。
 *
 * 资产即列表：`templates/<base>/<template>/` 由文件系统发现派生（扫目录 + 读各模板 schema），
 * 非 config 注册表。schema.json = 单一事实源（MCP when-to-use / 参数类型 / 预制变量默认值）。
 */
import type { DoneCodingDirLayer } from "@done-coding/cli-utils";

/**
 * schema.json 形态（单一事实源，裁决 ⓑ）。
 * `params` 为 JSON Schema 对象（draft-agnostic，仅需 properties/required/type 供 MCP 描述）。
 */
export interface TemplateSchema {
  /** 选型提示（MCP when-to-use） */
  whenToUse?: string;
  /** JSON Schema 对象：recipe.vars 契约（MCP 参数类型 / inputSchema） */
  params: Record<string, unknown>;
  /** 预制变量默认值 */
  defaults?: Record<string, unknown>;
}

/** 单模板命中（资产即列表：name 唯一 + 获胜层）。 */
export interface TemplateInfo {
  /** 模板名（`<base>/` 下立即子目录名） */
  name: string;
  /** 基座名（templates 下的分类命名空间，如 admin-core） */
  base: string;
  /** 模板目录绝对路径（realpath 解析后，读边界基准，对齐 M7） */
  dir: string;
  /** 获胜层（project > parent > global，就近优先） */
  layer: DoneCodingDirLayer;
  schema: TemplateSchema;
}
