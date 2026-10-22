/**
 * 模板资产层（T5，codegen-unified）：发现 + schema 读取（资产即列表）。
 *
 *  - `discoverTemplates(base, cwd)`：扫各层 `.done-coding/templates/<base>/` 立即子目录，
 *    按名去重就近优先（project > parent > global），每名一条 + 获胜层 + schema。
 *  - `readTemplateSchema(templateDir)`：单模板 schema.json 读取（缺失/非法 fail-loud）。
 * 消费方：T7 MCP（list_module_templates / list_params 描述动态生成）经包公共出口 import。
 */
export { discoverTemplates, readTemplateSchema } from "./discover";
export type { TemplateInfo, TemplateSchema } from "./types";
