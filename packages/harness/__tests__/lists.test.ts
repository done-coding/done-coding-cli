import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { diffLists, renderLists, writeLists, ListFileEnum } from "@/core/lists";
import { cleanup, entry, makeGovernance } from "./helpers";

const HEAD =
  "> 文档定位：快照型清单 · **[MUST] 由 `scripts/governance-lists.py` 重生成，[MUST NOT] 手工维护**\n";

let root = "";
afterEach(() => cleanup(root));

describe("renderLists", () => {
  it("BACKLOG：按文件名排序、标题截 58 字符、缺 modules 显示 []", () => {
    const long = "长".repeat(70);
    root = makeGovernance({
      "backlog/bbbbbb-b.md": entry({
        id: "bbbbbb",
        title: long,
        created: "2026-09-02",
      }),
      "backlog/aaaaaa-a.md": entry({
        id: "aaaaaa",
        title: '"带引号"',
        modules: "[generator, create]",
        created: "2026-09-01",
      }),
    });
    expect(renderLists(root).get(ListFileEnum.BACKLOG)).toBe(
      `# 需求池（BACKLOG）\n\n${HEAD}> 正文在 \`backlog/<id>-<slug>.md\`；下发即 \`git mv\` 进 \`schedule/<批次>/\`。\n\n` +
        "共 **2** 条。\n\n| id | 标题 | 领域 | 登记 | 文件 |\n|---|---|---|---|---|\n" +
        "| `aaaaaa` | 带引号 | [generator, create] | 2026-09-01 | [aaaaaa-a.md](backlog/aaaaaa-a.md) |\n" +
        `| \`bbbbbb\` | ${"长".repeat(58)} | [] | 2026-09-02 | [bbbbbb-b.md](backlog/bbbbbb-b.md) |\n`,
    );
  });

  it("DROPPED：有 merged_into 且无 dropped 时显示「合并进」，理由截 56 字符", () => {
    root = makeGovernance({
      "dropped/aaaaaa-a.md": entry({
        id: "aaaaaa",
        title: "甲",
        merged_into: "cccccc",
      }),
      "dropped/bbbbbb-b.md": entry({
        id: "bbbbbb",
        title: "乙",
        dropped: "因".repeat(60),
      }),
    });
    expect(renderLists(root).get(ListFileEnum.DROPPED)).toContain(
      "| `aaaaaa` | 甲 | 合并进 cccccc | [aaaaaa-a.md](dropped/aaaaaa-a.md) |\n" +
        `| \`bbbbbb\` | 乙 | ${"因".repeat(56)} | [bbbbbb-b.md](dropped/bbbbbb-b.md) |\n`,
    );
  });

  it("SCHEDULE / ARCHIVE-DONE：条目数不计 PROGRESS.md，领域 = 条目 ∪ PROGRESS frontmatter 并集排序；空时给占位句", () => {
    root = makeGovernance({
      "schedule/x1-batch/PROGRESS.md": entry({ id: "x1", modules: "[zzz]" }),
      "schedule/x1-batch/a1-a.md": entry({ modules: "[mcp, create]" }),
      "schedule/x1-batch/a2-b.md": entry({ modules: "[create]" }),
    });
    const lists = renderLists(root);
    expect(lists.get(ListFileEnum.SCHEDULE)).toContain(
      "共 **1** 个在途批次。\n\n| 批次 | 条目数 | 所涉领域 | 进度 |\n|---|---|---|---|\n" +
        "| `x1-batch` | 2 | create · mcp · zzz | [PROGRESS](schedule/x1-batch/PROGRESS.md) |\n",
    );
    expect(lists.get(ListFileEnum.ARCHIVE_DONE)).toMatch(
      /当前无已交付批次。\n$/,
    );
  });

  it("批次领域：PROGRESS 只读 frontmatter（正文里的 modules 不算），归档只剩 PROGRESS 也能出领域", () => {
    root = makeGovernance({
      "archive/b0-old/PROGRESS.md": entry(
        { id: "b0", modules: "[harness, create]" },
        "\nmodules: [ghost]\n",
      ),
      "archive/b1-bare/PROGRESS.md": "无 frontmatter\nmodules: [ghost]\n",
    });
    expect(renderLists(root).get(ListFileEnum.ARCHIVE_DONE)).toContain(
      "| `b0-old` | create · harness | [PROGRESS](archive/b0-old/PROGRESS.md) |\n" +
        "| `b1-bare` |  | [PROGRESS](archive/b1-bare/PROGRESS.md) |\n",
    );
  });

  it("ISSUE：仅存在 issue/ 时生成，按登记日升序（最老在上）", () => {
    root = makeGovernance({});
    expect(renderLists(root).has(ListFileEnum.ISSUE)).toBe(false);

    fs.mkdirSync(path.join(root, "issue"));
    expect(renderLists(root).get(ListFileEnum.ISSUE)).toMatch(
      /当前无待分诊反馈。\n$/,
    );

    fs.writeFileSync(
      path.join(root, "issue/aaaaaa-new.md"),
      entry({ id: "aaaaaa", title: "新", created: "2026-09-28", from: "hub" }),
    );
    fs.writeFileSync(
      path.join(root, "issue/zzzzzz-old.md"),
      entry({ id: "zzzzzz", title: "旧", created: "2026-09-01", from: "hub" }),
    );
    const body = renderLists(root).get(ListFileEnum.ISSUE)!;
    expect(body.indexOf("zzzzzz")).toBeLessThan(body.indexOf("aaaaaa"));
    expect(body).toContain(
      "| `zzzzzz` | 旧 | hub | 2026-09-01 | [zzzzzz-old.md](issue/zzzzzz-old.md) |\n",
    );
  });
});

describe("writeLists / diffLists", () => {
  it("首次写出全部清单，再次写零变化，手改后 diff 可见", () => {
    root = makeGovernance({
      "backlog/aaaaaa-a.md": entry({ id: "aaaaaa", title: "甲" }),
    });
    expect(writeLists(root)).toEqual([
      ListFileEnum.BACKLOG,
      ListFileEnum.DROPPED,
      ListFileEnum.SCHEDULE,
      ListFileEnum.ARCHIVE_DONE,
    ]);
    expect(writeLists(root)).toEqual([]);
    fs.appendFileSync(path.join(root, ListFileEnum.BACKLOG), "手改\n");
    expect(diffLists(root)).toEqual([ListFileEnum.BACKLOG]);
  });
});
