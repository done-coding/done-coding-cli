import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runChecks, readKnownDomains } from "@/core/check";
import { writeLists } from "@/core/lists";
import { cleanup, entry, makeGovernance } from "./helpers";

const MODULES =
  "# MODULES\n\n| 领域 | 落点 |\n|---|---|\n| `create` | x |\n| `mcp` | y |\n\n## 横向\n\n| 调度 · `release` | z |\n";

let root = "";
afterEach(() => cleanup(root));

/** 建夹具并先把清单写平，只让被测违规出现 */
const setup = (files: Record<string, string>): string => {
  root = makeGovernance({ "MODULES.md": MODULES, ...files });
  writeLists(root);
  return root;
};

describe("readKnownDomains", () => {
  it("默认读 MODULES.md 全文：首列反引号行才算领域，横向行不算", () => {
    root = makeGovernance({ "MODULES.md": MODULES });
    expect([...readKnownDomains(root, { file: "MODULES.md" })]).toEqual([
      "create",
      "mcp",
    ]);
  });

  it("section：只取该标题到下一个 ## 之间", () => {
    root = makeGovernance({
      "SNAPSHOT.md": "## 领域模块\n\n| `a` | 1 |\n\n## 其它\n\n| `b` | 2 |\n",
    });
    expect([
      ...readKnownDomains(root, {
        file: "SNAPSHOT.md",
        section: "## 领域模块",
      }),
    ]).toEqual(["a"]);
  });
});

describe("runChecks", () => {
  it("合规夹具全过", () => {
    setup({
      "backlog/aaaaaa-a.md": entry({ modules: "[create]" }),
      "schedule/b1-x/PROGRESS.md": entry({ id: "b1" }),
      "schedule/b1-x/cccccc-c.md": entry({ modules: "[mcp]" }),
      "archive/b0-y/PROGRESS.md": "done\n",
      "dropped/dddddd-d.md": entry({ dropped: "过期" }),
    });
    expect(runChecks(root)).toEqual([]);
  });

  it("元闸：缺 modules / 未登记领域 / 领域表为空", () => {
    setup({
      "backlog/aaaaaa-a.md": entry({ title: "无领域" }),
      "backlog/bbbbbb-b.md": entry({ modules: "[create, typo]" }),
    });
    expect(runChecks(root)).toEqual([
      "元闸：backlog/aaaaaa-a.md 缺 modules",
      "元闸：backlog/bbbbbb-b.md 含未登记领域 ['typo']",
    ]);
    expect(runChecks(root, { file: "NOPE.md" })[0]).toBe(
      "元闸：NOPE.md 领域表未解析出任何领域",
    );
  });

  it("并行闸：不同批次串领域相交即违规", () => {
    setup({
      "schedule/b1-x/PROGRESS.md": entry({ after: '""' }),
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[create, mcp]" }),
      "schedule/b2-y/PROGRESS.md": entry({ after: '""' }),
      "schedule/b2-y/bbbbbb-b.md": entry({ modules: "[create]" }),
    });
    expect(runChecks(root)).toEqual(["并行闸：b1-x ∩ b2-y = ['create']"]);
  });

  it("并行闸：批次领域含 PROGRESS frontmatter 的 modules", () => {
    setup({
      "schedule/b1-x/PROGRESS.md": entry({ after: '""', modules: "[create]" }),
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[mcp]" }),
      "schedule/b2-y/PROGRESS.md": entry({ after: '""' }),
      "schedule/b2-y/bbbbbb-b.md": entry({ modules: "[create]" }),
    });
    expect(runChecks(root)).toEqual(["并行闸：b1-x ∩ b2-y = ['create']"]);
  });

  it("批次串：同一 after 链内相交豁免（前驱已归档亦成链）", () => {
    setup({
      "archive/b0-w/PROGRESS.md": "done\n",
      "schedule/b1-x/PROGRESS.md": entry({ after: "b0" }),
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[create]" }),
      "schedule/b2-y/PROGRESS.md": entry({ after: "b1" }),
      "schedule/b2-y/bbbbbb-b.md": entry({ modules: "[create]" }),
      "schedule/b3-z/PROGRESS.md": entry({ after: "b2" }),
      "schedule/b3-z/cccccc-c.md": entry({ modules: "[create]" }),
    });
    expect(runChecks(root)).toEqual([]);
  });

  it("批次串：after 悬空 / 分叉 / 成环即违规，分叉两支照常过并行闸", () => {
    setup({
      "schedule/b1-x/PROGRESS.md": entry({ after: "zz" }),
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[mcp]" }),
    });
    expect(runChecks(root)).toEqual([
      "批次串：schedule/b1-x 的 after 指向不存在的批次 zz",
    ]);

    cleanup(root);
    setup({
      "schedule/b1-x/PROGRESS.md": entry({ after: '""' }),
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[mcp]" }),
      "schedule/b2-y/PROGRESS.md": entry({ after: "b1" }),
      "schedule/b2-y/bbbbbb-b.md": entry({ modules: "[create]" }),
      "schedule/b3-z/PROGRESS.md": entry({ after: "b1" }),
      "schedule/b3-z/cccccc-c.md": entry({ modules: "[create]" }),
    });
    expect(runChecks(root)).toEqual([
      "批次串：b1 之后分叉为 ['b2-y', 'b3-z']",
      "并行闸：b2-y ∩ b3-z = ['create']",
    ]);

    cleanup(root);
    setup({
      "schedule/b1-x/PROGRESS.md": entry({ after: "b2" }),
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[create]" }),
      "schedule/b2-y/PROGRESS.md": entry({ after: "b1" }),
      "schedule/b2-y/bbbbbb-b.md": entry({ modules: "[create]" }),
    });
    expect(runChecks(root)).toEqual([
      "批次串：schedule/b1-x 的 after 链成环",
      "批次串：schedule/b2-y 的 after 链成环",
      "并行闸：b1-x ∩ b2-y = ['create']",
    ]);
  });

  it("收口形态：批次缺 PROGRESS / archive 残留正文 / dropped 无理由 / issue 无 from", () => {
    setup({
      "schedule/b1-x/aaaaaa-a.md": entry({ modules: "[create]" }),
      "archive/b0-y/PROGRESS.md": "done\n",
      "archive/b0-y/cccccc-c.md": "残留\n",
      "dropped/dddddd-d.md": entry({ title: "无理由" }),
      "issue/eeeeee-e.md": entry({ title: "无来源" }),
    });
    writeLists(root);
    expect(runChecks(root)).toEqual([
      "收口：schedule/b1-x 缺 PROGRESS.md",
      "收口：archive/b0-y 只许 PROGRESS.md，多出 ['cccccc-c.md']",
      "收口：dropped/dddddd-d.md 缺 dropped 理由或 merged_into",
      "收口：issue/eeeeee-e.md 缺 from",
    ]);
  });

  it("清单：条目变了未重生成即报漂移", () => {
    setup({});
    fs.writeFileSync(
      path.join(root, "backlog/ffffff-f.md"),
      entry({ modules: "[mcp]" }),
    );
    expect(runChecks(root)).toEqual([
      "清单：已漂移（BACKLOG.md），跑 dc-harness lists 重生成",
    ]);
  });
});
