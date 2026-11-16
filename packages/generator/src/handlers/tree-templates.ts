import { outputConsole, safeCwd } from "@done-coding/cli-utils";
import { discoverBases, discoverTemplates } from "@/templates";

/**
 * `tree templates [base]`：列模块模板基座与模板（与 MCP list_module_templates 同源：各模板 schema.json）。
 * 不带 base 列全部基座（含 base.json 的目录）及其模板；stdout 只输出数据，诊断走 stderr。
 */
export interface TreeTemplatesArgv {
  /** 只列该基座 */
  base?: string;
  json?: boolean;
}

export interface TreeTemplatesBase {
  base: string;
  /** base.json 声明的适配包与版本 */
  package?: unknown;
  version?: unknown;
  layer: string;
  templates: { name: string; layer: string; whenToUse?: string }[];
}

/** 汇总基座与模板（纯函数，供 CLI 与测试） */
export const listTreeTemplates = (
  cwd: string,
  base?: string,
  opts?: { home?: string },
): TreeTemplatesBase[] => {
  const bases = discoverBases(cwd, opts);
  const picked = base ? bases.filter((b) => b.name === base) : bases;
  if (base && !picked.length) {
    throw new Error(
      `没有找到模块模板基座 ${base}（已有：${bases.map((b) => b.name).join("、") || "无"}）`,
    );
  }
  return picked.map((b) => ({
    base: b.name,
    package: b.meta.package,
    version: b.meta.version,
    layer: b.layer,
    templates: discoverTemplates(b.name, cwd, opts).map((t) => ({
      name: t.name,
      layer: t.layer,
      whenToUse: t.schema.whenToUse,
    })),
  }));
};

export const treeTemplatesHandler = async (argv: TreeTemplatesArgv) => {
  const result = listTreeTemplates(safeCwd(), argv.base);
  if (argv.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (!result.length) {
    outputConsole.info(
      "没有找到模块模板基座（.done-coding/templates/<基座>/base.json）",
    );
  }
  for (const b of result) {
    process.stdout.write(
      `## ${b.base}（适配 ${String(b.package ?? "?")} ${String(b.version ?? "")}，${b.layer} 层）\n`,
    );
    for (const t of b.templates) {
      process.stdout.write(
        `  ${t.name} — ${t.whenToUse ?? "（无 whenToUse）"}\n`,
      );
    }
  }
};
