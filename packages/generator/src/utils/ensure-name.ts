/**
 * <批次实例名合法性校验> —— 复刻 component utils/name.ts:ensureNameLegal。
 * 限制只能字母、数字、中划线且以字母开头，并对 nameExcludes 保留名做拦截。
 * content-free：批次类型名 + nameExcludes 由调用方传入。
 */

/** 批次实例名合法字符规则（字母开头 + 字母/数字/中划线） */
export const NAME_LEGAL_PATTERN = /^[a-zA-Z]+[a-zA-Z0-9-]*$/;

/**
 * 校验批次实例名合法性（fail-fast）。
 * @param rawName 用户原始输入字面量
 * @param opts.nameExcludes 保留名清单
 * @param opts.typeLabel 批次类型名（用于报错文案）
 * @returns 合法时返回 true（沿用 component 旧 ensureNameLegal 返回值形态）
 */
export const ensureNameLegal = (
  rawName: string,
  opts?: { nameExcludes?: string[]; typeLabel?: string },
): boolean => {
  const { nameExcludes = [], typeLabel = "批次" } = opts ?? {};

  if (typeof rawName !== "string" || rawName.length === 0) {
    throw new Error(`${typeLabel}名不能为空`);
  }

  if (!NAME_LEGAL_PATTERN.test(rawName)) {
    throw new Error(
      `${typeLabel}名「${rawName}」非法：只能包含字母、数字、中划线，且必须以字母开头`,
    );
  }

  if (nameExcludes.includes(rawName)) {
    throw new Error(
      `${typeLabel}名「${rawName}」为保留名，不允许使用（保留名：${nameExcludes.join(
        "、",
      )}）`,
    );
  }

  return true;
};
