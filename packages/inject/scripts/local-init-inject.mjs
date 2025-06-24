import fs from "node:fs";
import path from "node:path";

console.log(4, 5, 6);

/**
 * 初始化本包injectInfo.json文件
 * --
 * 本包有使用inject 但是初始没有 虽然可以调用 generateFile 但是相关代码中有使用初次结果
 */
export const initOwnInjectInfo = (rootDir = process.cwd()) => {
  const filePath = path.resolve(rootDir, "./src/injectInfo.json");
  console.log("initOwnInjectInfo", filePath);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        name: "@done-coding/cli-inject",
        version: "0.0.0",
        description: "信息(JSON)注入命令行工具",
        cliConfig: {
          namespaceDir: ".done-coding",
          moduleName: "inject",
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
};

initOwnInjectInfo();
