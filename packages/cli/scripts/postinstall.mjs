import path from 'node:path';

/** 
 * 自身应该跳过
 * ---
 * 检测是自身为宿主安装依赖时
 */
const shouldSkip = () => {
  const initCwd = process.env.INIT_CWD;
  const cwd = process.cwd();

  // 1. 尝试 INIT_CWD 比对（覆盖 90% 简单场景）
  if (initCwd && path.resolve(initCwd) === path.resolve(cwd)) return true;

  // 2. 特征路径扫描（覆盖 Monorepo 和 符号链接场景）
  // 只要路径里没出现 node_modules，就判定为是在自己家开发
  if (!cwd.split(path.sep).includes('node_modules')) return true;

  return false;
}

/** 使用提示 */
const usageTips = () => {
  /** 自身是否为依赖包 */
  if (shouldSkip()) {
    return process.exit(0);
  }

  const isWindows = process.platform === "win32";

  console.log(`
🎉 安装成功! 使用方式:

${isWindows ? "在 CMD/PowerShell 中输入:" : "在终端中输入:"}

${isWindows
      ? "  dc 或 dc-cli 或 done-coding [命令]"
      : "  DC 或 dc-cli 或 done-coding [命令]"
    }

${!isWindows
      ? `
⚠️ 注意: 
  不要使用小写 "dc"，会调用系统计算器
`
      : ""
    }
`);
}


usageTips()

