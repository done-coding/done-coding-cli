import fs from "node:fs";
import path from "node:path";

/** 全局日志流缓存 */
const logStreamMap = new Map<string, fs.WriteStream>();

/**
 * 获取或创建日志写入流
 */
export const getLogStream = (filePathInit: string): fs.WriteStream => {
  // 统一转为绝对路径作为 Map 的 Key
  const filePath = path.resolve(filePathInit);
  const logDir = path.dirname(filePath);

  const targetStream = logStreamMap.get(filePath);
  if (targetStream) {
    // 检查流是否仍然处于可写状态（处理意外关闭的情况）
    if (!targetStream.destroyed && targetStream.writable) {
      return targetStream;
    }
    // 如果流已损坏，从 Map 中移除
    logStreamMap.delete(filePath);
  }

  // 1. 确保目录存在
  // 修正逻辑：如果目录不存在，则递归创建
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 2. 创建追加写入流
  const stream = fs.createWriteStream(filePath, {
    flags: "a",
    encoding: "utf8",
    // 2026 建议：高并发下可适当调大缓存区
    highWaterMark: 64 * 1024,
  });

  // 3. 必做的错误处理：防止进程崩溃
  stream.on("error", () => {
    logStreamMap.delete(filePath);
    stream.destroy();
  });

  stream.on("close", () => {
    logStreamMap.delete(filePath);
  });

  logStreamMap.set(filePath, stream);
  return stream;
};

process.once("exit", () => {
  for (const stream of logStreamMap.values()) {
    try {
      if (!stream.destroyed) {
        stream.end();
      }
    } catch (e) {
      // 临终清理，捕获所有可能的异常，确保其他流也能被处理
    }
  }
});
