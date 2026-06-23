/**
 * [T5] dc-generator init <type> [--global] handler（design §4.5，R9/L3）。
 *
 *  - 目标 = (--global ? ~/.done-coding : <cwd>/.done-coding)/<type>/。
 *  - 目标已存在 → 报错不覆盖。
 *  - 写 index.json + config.json5（含注释头：helper 速查 5 个 + 内建变量 +
 *    策略速查 create/append/replace + inject "reserved for future (P2)" + replace 不可自动 remove）
 *    + template/ 占位。
 *  - 签名 (argv, ctxInit?)；三模式（server-agnostic，NFR-1 P1）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildInitSkeleton,
  buildInitTemplatePlaceholder,
} from "@/presets/init-skeleton";
import type { GeneratorHandler } from "@/types";
import { ensureNameLegal } from "@/utils/ensure-name";
import { outputConsole, resolveHandlerContext } from "@done-coding/cli-utils";

const NAMESPACE_DIR = ".done-coding";

export const handler: GeneratorHandler = async (argv, ctxInit) => {
  const ctx = resolveHandlerContext(ctxInit);
  if (!argv.type) {
    throw new Error(
      "init 缺少必填参数：type（批次类型，dc-generator init <type>）",
    );
  }
  const type = argv.type;
  // 批次类型名沿用实例名合法规则（字母开头 + 字母/数字/中划线）
  ensureNameLegal(type, { typeLabel: "批次类型" });

  // --global → home（优先 HOME/USERPROFILE env，便于测试 fake HOME，与 dir-resolver home 选项同向）；否则 cwd
  const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
  const baseDir = argv.global ? home : ctx.cwd;
  const targetDir = path.resolve(baseDir, NAMESPACE_DIR, type);

  if (fs.existsSync(targetDir)) {
    throw new Error(`批次目录已存在，不覆盖：${targetDir}`);
  }

  const skeleton = buildInitSkeleton(type);
  const templatePlaceholder = buildInitTemplatePlaceholder();
  const templateDir = path.resolve(targetDir, "template");

  fs.mkdirSync(templateDir, { recursive: true });
  fs.writeFileSync(
    path.resolve(targetDir, "index.json"),
    `${JSON.stringify(skeleton.indexJson, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.resolve(targetDir, "config.json5"),
    skeleton.configJson5,
  );
  fs.writeFileSync(
    path.resolve(templateDir, templatePlaceholder.fileName),
    templatePlaceholder.content,
  );

  outputConsole.success(`已初始化批次：${targetDir}`);
};
