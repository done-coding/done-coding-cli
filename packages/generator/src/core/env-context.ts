/**
 * <内建变量 canonical 集 + helper 命名空间注入>（design §3.2/§3.3/§3.4，K6/K8）。
 *
 *  - 从 rawName 派生 canonical 集：name(=PascalCase)/namePascal/nameCamel/
 *    nameLowerFirst/nameKebab/rawName/$/execDir/templateDir（**无 nameSnake**，K6/Ⓐ）。
 *  - 注入 `_.` helper 命名空间：camelCase/kebabCase/upperFirst/lowerFirst/pascalCase
 *    （pascalCase = upperFirst∘camelCase 组合，零新增 lodash 子包，K6/Ⓓ）。
 *  - 产出对象即喂给 lodash.template 的 envData（helper 挂 `_` 键），交 batch 级联
 *    （经 batchCompileHandler extraEnvData 注入）。
 */
import type { EnvContext, EnvHelperNamespace } from "@/types";
import _camelCase from "lodash.camelcase";
import _kebabCase from "lodash.kebabcase";
import _lowerFirst from "lodash.lowerfirst";
import _upperFirst from "lodash.upperfirst";

/** pascalCase = upperFirst(camelCase(x))（组合实现，零新增 lodash 子包，K6） */
const pascalCase = (value?: string): string => _upperFirst(_camelCase(value));

/** helper 命名空间（白名单 5 个，零新增 lodash 子包，K6） */
export const createEnvHelpers = (): EnvHelperNamespace => ({
  camelCase: _camelCase,
  kebabCase: _kebabCase,
  upperFirst: _upperFirst,
  lowerFirst: _lowerFirst,
  pascalCase,
});

/**
 * 构造完整 EnvContext（内建 canonical + helper + 批次声明式派生占位）。
 * @param rawName ensureNameLegal 后的原始用户输入字面量
 * @param opts.execDir 实例落地根（safeCwd）
 * @param opts.templateDir dir-resolver 命中的批次模板目录绝对路径
 */
export const createEnvContext = (
  rawName: string,
  opts: { execDir: string; templateDir: string },
): EnvContext => {
  // canonical name = upperFirst(camelCase(rawName))（PascalCase，非 rawName 原样，K8）
  const name = pascalCase(rawName);

  return {
    // ── 内建 canonical 集（全部从 rawName 派生，design §3.3 表；无 nameSnake，K6） ──
    name,
    namePascal: name,
    nameCamel: _camelCase(rawName),
    nameLowerFirst: _lowerFirst(name),
    nameKebab: _kebabCase(rawName),
    rawName,
    $: "$",
    execDir: opts.execDir,
    templateDir: opts.templateDir,
    // ── helper 命名空间 ──
    _: createEnvHelpers(),
  };
};
