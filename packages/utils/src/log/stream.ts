import fs from "node:fs";
import path from "node:path";

/** 全局日志流缓存 */
const logStreamMap = new Map<string, fs.WriteStream>();

/**
 * fs.WriteStream 确实没有直接声明 fd 属性（虽然运行时它确实存在）。这是因为 fd 是由底层的物理文件句柄分配的，其类型定义在内部较为隐蔽。
 */
export interface XFsWriteStream extends fs.WriteStream {
  fd?: number;
}

/**
 * 获取或创建日志写入流
 */
export const getLogStream = (filePathInit: string): XFsWriteStream => {
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
  // const stream = fs.createWriteStream(filePath, {
  //   flags: "a",
  //   encoding: "utf8",
  //   // 2026 建议：高并发下可适当调大缓存区
  //   highWaterMark: 64 * 1024,
  // });

  // 2. 先同步拿句柄，确保 execSync 可用
  const fd = fs.openSync(filePath, "a");

  // 3. 创建流：绑定 fd，并设置 autoClose
  const stream = fs.createWriteStream(filePath, {
    fd: fd,
    autoClose: true, // 关键：stream 销毁时自动关 fd
    encoding: "utf8",
    highWaterMark: 64 * 1024,
  }) as XFsWriteStream;

  // 3. 必做的错误处理：防止进程崩溃
  stream.on("error", () => {
    logStreamMap.delete(filePath);
    stream.destroy();
  });

  stream.on("close", () => {
    logStreamMap.delete(filePath);
  });

  logStreamMap.set(filePath, stream);

  // 工业级防御：由于流是异步打开的，即便用了 openSync，
  // 在极少数极其极端的 race condition 下仍可能为 undefined
  if (typeof stream.fd !== "number") {
    throw new Error(
      `Failed to get file descriptor from stream for ${stream.path}`,
    );
  }

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
