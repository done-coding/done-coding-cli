import { beforeEach, describe, expect, it, vi } from "vitest";

// 只替换 git 命令输出：拼音转换走真实依赖，锁住 lastCommitterPinYin / userNamePinYin 的取值
const gitOutput = vi.hoisted(() => ({ committer: "", userName: "" }));

vi.mock("@/process", () => ({
  execSyncHijack: (command: string) => {
    const outputs: Record<string, string> = {
      "git rev-parse HEAD": "0123456789abcdef",
      'git log -1 --pretty=format:"%an"': gitOutput.committer,
      'git log -1 --pretty=format:"%ae"': "t@t.t",
      'git log -1 --pretty=format:"%s"': "feat: demo",
      "git config user.name": gitOutput.userName,
      "git config user.email": "t@t.t",
      "git rev-parse --abbrev-ref HEAD": "master",
      "git config --get remote.origin.url": "https://example.com/demo.git",
    };
    if (!(command in outputs)) throw new Error(`未预期的命令：${command}`);
    return Buffer.from(outputs[command]);
  },
}));

const { getGitLastCommitInfo } = await import("@/index");

describe("getGitLastCommitInfo：提交者与用户名拼音", () => {
  beforeEach(() => {
    gitOutput.committer = "";
    gitOutput.userName = "";
  });

  // 期望值为 pinyin@2.11.2（STYLE_NORMAL、不分词、不取多音）的实测输出，更换实现时须保持一致
  it.each([
    ["苏鹏飞", "supengfei"],
    ["单雄信", "danxiongxin"],
    ["曾国藩", "zengguofan"],
    ["长孙无忌", "changsunwuji"],
    ["尉迟恭", "weichigong"],
    ["查良镛", "chaliangyong"],
    ["行长", "hangchang"],
    ["繁體字", "fantizi"],
    ["〇", "ling"],
    ["李小龙Bruce", "lixiaolongBruce"],
    ["王-五 6", "wang-wu 6"],
    ["😀表情", "😀biaoqing"],
    ["한국어", "한국어"],
    ["Soaren", "Soaren"],
    ["", ""],
  ])("%j → %j", (name, expected) => {
    gitOutput.committer = name;
    gitOutput.userName = name;
    const info = getGitLastCommitInfo();
    expect(info.lastCommitterPinYin).toBe(expected);
    expect(info.userNamePinYin).toBe(expected);
  });

  it("提交者与用户名分别转换", () => {
    gitOutput.committer = "张三";
    gitOutput.userName = "李四";
    const info = getGitLastCommitInfo();
    expect(info).toMatchObject({
      lastCommitter: "张三",
      lastCommitterPinYin: "zhangsan",
      userName: "李四",
      userNamePinYin: "lisi",
      remoteInfo: { alias: "origin", url: "https://example.com/demo.git" },
    });
  });
});
