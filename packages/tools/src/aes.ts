import crypto from "crypto";

/** AES 加密算法 */
const ALGORITHM = "aes-256-cbc";
/** 向量长度 */
const IV_LENGTH = 16;
/** 编码方式 */
const ENCODING: BufferEncoding = "hex";
/** 连接符号 */
const SEPARATOR = ":";

/**
 * 从任意长度的密钥派生固定长度的密钥
 * @param secretKey 原始密钥
 * @returns 派生后的密钥
 */
function deriveKey(secretKey: string): Buffer {
  // 使用 PBKDF2 从任意长度的密钥派生固定长度的密钥
  return crypto.pbkdf2Sync(
    secretKey,
    "done-coding-cli-salt", // 使用固定的盐值
    10000, // 迭代次数
    32, // AES-256 需要 32 字节密钥
    "sha256",
  );
}

/** AES 加密 */
export function encryptAES({
  text,
  secretKey,
}: {
  text: string;
  secretKey: string;
}): string {
  try {
    // 派生固定长度的密钥
    const derivedKey = deriveKey(secretKey);

    /** 初始化向量 */
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const ivHex = iv.toString(ENCODING);
    const encryptedHex = encrypted.toString(ENCODING);
    return `${ivHex}${SEPARATOR}${encryptedHex}`;
  } catch (error) {
    // 记录错误但不抛出，返回空字符串表示加密失败
    console.error(
      `加密失败: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "";
  }
}

/** AES 解密 */
export function decryptAES({
  encryptedText,
  secretKey,
}: {
  encryptedText: string;
  secretKey: string;
}): string {
  try {
    // 验证加密文本格式
    if (!encryptedText.includes(SEPARATOR)) {
      return "";
    }

    // 派生固定长度的密钥
    const derivedKey = deriveKey(secretKey);

    const [ivHex, encryptedHex] = encryptedText.split(SEPARATOR);

    // 验证 IV 和加密文本长度
    if (ivHex.length !== IV_LENGTH * 2) {
      // hex 编码后长度是原始长度的 2 倍
      return "";
    }

    const iv = Buffer.from(ivHex, ENCODING);
    const encrypted = Buffer.from(encryptedHex, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // 记录错误但不抛出，返回空字符串表示解密失败
    console.error(
      `解密失败: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "";
  }
}
