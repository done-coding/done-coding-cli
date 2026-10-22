/**
 * 跨仓回归：用本仓**本地构建**的 generator 对 template-hub 跑 `assemble check --all`。
 * hub 已提交的 templates/ 产物即回归基准；check = clean regenerate 到临时目录后 diff，不写 hub。
 *
 * hub 路径：环境变量 DC_TEMPLATE_HUB，缺省为本仓兄弟目录 ../done-coding-template-hub。
 * hub 或本地构建缺失 → 非零退出（不假绿）。
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hubRoot = resolve(
  process.env.DC_TEMPLATE_HUB ||
    resolve(repoRoot, "../done-coding-template-hub"),
);
const generatorCli = resolve(repoRoot, "packages/generator/es/cli.mjs");

if (!existsSync(resolve(hubRoot, ".done-coding/generator/assemble/recipes"))) {
  console.error(
    `[regress-hub] 未找到 template-hub 配方目录：${hubRoot}\n` +
      "  设置 DC_TEMPLATE_HUB=<template-hub 路径> 后重试。",
  );
  process.exit(2);
}
if (!existsSync(generatorCli)) {
  console.error(
    `[regress-hub] 未找到本地 generator 构建产物：${generatorCli}\n` +
      "  先在 packages/generator 下执行 pnpm build。",
  );
  process.exit(2);
}

console.log(
  `[regress-hub] generator=${generatorCli}\n[regress-hub] hub=${hubRoot}`,
);
const { status } = spawnSync(
  process.execPath,
  [generatorCli, "assemble", "check", "--all"],
  { cwd: hubRoot, stdio: "inherit" },
);
process.exit(status ?? 1);
