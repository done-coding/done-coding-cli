import { execSync } from "node:child_process";

const pkgListStrBuffer = execSync(`lerna ls --json`);

const pkgListStr = pkgListStrBuffer.toString();

const excludeList = ["@done-coding/cli-utils"];

const pkgList = JSON.parse(pkgListStr).filter(
  (item) => !excludeList.includes(item.name),
);

console.log(pkgList);

for (let { location: rootDir, name } of pkgList) {
  try {
    execSync(`node ../publish/es/cli.mjs alias`, {
      cwd: rootDir,
      stdio: "inherit",
    });
  } catch (error) {
    console.error(`${name}别名发布失败${error.message}`);
  }
}
