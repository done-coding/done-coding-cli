import { describe, expect, it } from "vitest";
import { CliUserError, formatCliFailOutput, isCliUserError } from "@/index";

describe("CliUserError：预期错误只给提示、不打调用栈", () => {
  it("CliUserError 输出仅含 message，不含调用栈", () => {
    const err = new CliUserError("缺少配置：请先运行 init");
    expect(isCliUserError(err)).toBe(true);
    expect(formatCliFailOutput("", err)).toBe("缺少配置：请先运行 init\n");
  });

  it("跨包副本也能识别：只认标记字段，不依赖 instanceof", () => {
    const foreign = Object.assign(new Error("外部副本"), {
      isCliUserError: true,
    });
    expect(isCliUserError(foreign)).toBe(true);
    expect(formatCliFailOutput("", foreign)).toBe("外部副本\n");
  });

  it("普通 Error（非预期故障）仍输出调用栈，便于排查", () => {
    const err = new Error("boom");
    const out = formatCliFailOutput("", err);
    expect(isCliUserError(err)).toBe(false);
    expect(out.startsWith("boom\n")).toBe(true);
    expect(out).toContain("user-error.test.ts");
  });

  it("yargs 校验消息（无 err）原样输出", () => {
    expect(formatCliFailOutput("无法识别的选项：x", undefined)).toBe(
      "无法识别的选项：x\n",
    );
  });
});

describe("非交互缺输入属于预期错误", () => {
  it("getAnswer 缺参数 → CliUserError，指出缺哪个参数", async () => {
    const { getAnswer } = await import("@/index");
    let caught: unknown;
    try {
      await getAnswer({
        key: "template",
        questionConfig: { type: "text", name: "template", message: "模板" },
        ctx: { interactive: false },
      });
    } catch (error) {
      caught = error;
    }
    expect(isCliUserError(caught)).toBe(true);
    expect((caught as Error).message).toContain("缺少参数 template");
  });
});
