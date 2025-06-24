const isWindows = process.platform === "win32";

console.log(`
🎉 安装成功! 使用方式:

${isWindows ? "在 CMD/PowerShell 中输入:" : "在终端中输入:"}

${
  isWindows
    ? "  dc 或 dc-cli 或 done-coding [命令]"
    : "  DC 或 dc-cli 或 done-coding [命令]"
}

${
  !isWindows
    ? `
⚠️ 注意: 
  不要使用小写 "dc"，会调用系统计算器
`
    : ""
}
`);
