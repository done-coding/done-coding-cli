/** 子命令枚举 */
export enum SubcommandEnum {
  /** AI 对话 */
  CHAT = "chat",
}

/** 对话内置关键字 */
export enum ChatKeywordEnum {
  /** 退出对话 */
  EXIT = "/exit",
  /** 切换协议 */
  PROTOCOL = "/protocol",
  /** 切换服务商 */
  PROVIDER = "/provider",
  /** 切换模型 */
  MODEL = "/model",
  /** 清屏 */
  CLEAR = "/clear",
}
