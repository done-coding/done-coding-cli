/**
 * 仓根相对路径模式（领域表 paths / public、共享骨架表、缺口表、配置 exclude 共用）。
 * ---
 * - 无通配：精确文件或目录（目录覆盖其下全部文件）；末尾 `/` 同为目录。
 * - 通配：`**` 跨目录、`*` / `?` 不跨 `/`、`[...]` 字符类、`{a,b}` 展开（可嵌套）。
 * - 模式命中某目录即覆盖其下全部文件（与 git pathspec 的目录前缀语义一致）。
 * 刻意不加 glob 依赖：语义只需这几条，自写可逐条测，不随第三方版本漂移。
 */

/** 模式非法时的原因（合法返回 undefined） */
export const invalidPattern = (pattern: string): string | undefined => {
  if (!pattern.trim()) return "空模式";
  if (pattern.startsWith("/") || /^[A-Za-z]:[\\/]/.test(pattern)) {
    return "须为仓根相对路径";
  }
  if (pattern.includes("\\")) return "路径分隔符须为 /";
  if (pattern.split("/").some((seg) => seg === "..")) return "不得含 ..";
  let depth = 0;
  for (const ch of pattern) {
    if (ch === "{") depth++;
    if (ch === "}" && --depth < 0) return "花括号不配对";
  }
  return depth ? "花括号不配对" : undefined;
};

/** 展开 `{a,b}`（可嵌套），无花括号原样返回 */
export const expandBraces = (pattern: string): string[] => {
  const open = pattern.indexOf("{");
  if (open < 0) return [pattern];
  let depth = 0;
  const commas: number[] = [];
  for (let i = open; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      const head = pattern.slice(0, open);
      const tail = pattern.slice(i + 1);
      const bounds = [open, ...commas, i];
      return bounds
        .slice(1)
        .flatMap((end, k) =>
          expandBraces(`${head}${pattern.slice(bounds[k] + 1, end)}${tail}`),
        );
    } else if (ch === "," && depth === 1) commas.push(i);
  }
  return [pattern];
};

const escapeRegExp = (text: string): string =>
  text.replace(/[.+^$()|\\]/g, "\\$&");

/** 单个（已展开花括号的）模式 → 正则 */
const toRegExp = (pattern: string): RegExp => {
  const normalized = pattern.replace(/^\.\//, "").replace(/\/+$/, "");
  let source = "";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "*" && normalized[i + 1] === "*") {
      const slash = normalized[i + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (ch === "*") source += "[^/]*";
    else if (ch === "?") source += "[^/]";
    else if (ch === "[") {
      const close = normalized.indexOf("]", i + 1);
      if (close < 0) source += "\\[";
      else {
        source += `[${normalized.slice(i + 1, close).replace(/^!/, "^")}]`;
        i = close;
      }
    } else source += escapeRegExp(ch);
  }
  return new RegExp(`^${source}$`);
};

/** 一组模式 → 匹配函数（路径或其任一上级目录命中即算） */
export const createMatcher = (
  patterns: string[],
): ((file: string) => boolean) => {
  const regexps = patterns.flatMap(expandBraces).map(toRegExp);
  if (!regexps.length) return () => false;
  return (file) => {
    const segments = file.split("/");
    for (let end = segments.length; end > 0; end--) {
      const candidate = segments.slice(0, end).join("/");
      if (regexps.some((re) => re.test(candidate))) return true;
    }
    return false;
  };
};
