import fs from "node:fs";
import path from "node:path";
import { extractFrontmatter, readField, parseModules } from "./frontmatter";
import {
  compareCodePoint,
  listItems,
  listMarkdown,
  listSubdirs,
  PROGRESS_FILE,
  takeCodePoints,
} from "./fs-entries";

/**
 * 治理清单渲染（从条目 frontmatter 重生成 BACKLOG / ISSUE / DROPPED / SCHEDULE / ARCHIVE-DONE）。
 * ---
 * 本实现为治理清单的**唯一实现**（harness-workspace skill 只描述规则语义、调用本命令）；
 * 文案、截断长度、排序规则即清单格式本身，改动任一处都会让各仓在库清单产生 diff。
 */

/** 清单文件名 */
export enum ListFileEnum {
  ISSUE = "ISSUE.md",
  BACKLOG = "BACKLOG.md",
  DROPPED = "DROPPED.md",
  SCHEDULE = "SCHEDULE.md",
  ARCHIVE_DONE = "ARCHIVE-DONE.md",
}

/** 治理目录下的条目 / 批次目录名 */
export enum GovernanceDirEnum {
  ISSUE = "issue",
  BACKLOG = "backlog",
  DROPPED = "dropped",
  SCHEDULE = "schedule",
  ARCHIVE = "archive",
}

/** 标题在清单中的最大长度（code point） */
const TITLE_MAX = 58;
/** 判不做理由在清单中的最大长度（code point） */
const DROPPED_REASON_MAX = 56;

interface Entry {
  file: string;
  id: string;
  title: string;
  modules: string;
  created: string;
  dropped: string;
  merged: string;
  src: string;
}

interface Batch {
  name: string;
  n: number;
  modules: string[];
}

const readEntries = (dir: string, byCreated = false): Entry[] => {
  const out = listMarkdown(dir).map((file): Entry => {
    const s = fs.readFileSync(path.join(dir, file), "utf-8");
    return {
      file,
      id: readField(s, "id"),
      title: takeCodePoints(readField(s, "title"), TITLE_MAX),
      modules: readField(s, "modules", "[]"),
      created: readField(s, "created"),
      dropped: readField(s, "dropped"),
      merged: readField(s, "merged_into"),
      src: readField(s, "from"),
    };
  });
  // issue 清单按登记日升序——最老的在最上面即积压。[MUST NOT] 改用滞留天数等
  // 随时间变化的值：那会让清单每天都有 diff，把「清单零 diff」闸打成恒红。
  return byCreated
    ? out.sort(
        (a, b) =>
          compareCodePoint(a.created, b.created) ||
          compareCodePoint(a.file, b.file),
      )
    : out;
};

/**
 * 批次领域集合 = 各条目 `modules` ∪ `PROGRESS.md` frontmatter 的 `modules`。
 * 清单「所涉领域」与并行闸共用本函数，保证同源；PROGRESS 只读 frontmatter（正文常含表格 / 引文）。
 */
export const readBatchModules = (batchDir: string): Set<string> => {
  const modules = new Set<string>();
  for (const item of listItems(batchDir)) {
    const s = fs.readFileSync(path.join(batchDir, item), "utf-8");
    parseModules(readField(s, "modules")).forEach((m) => modules.add(m));
  }
  const progress = path.join(batchDir, PROGRESS_FILE);
  if (fs.existsSync(progress)) {
    const fm = extractFrontmatter(fs.readFileSync(progress, "utf-8"));
    parseModules(readField(fm, "modules")).forEach((m) => modules.add(m));
  }
  return modules;
};

const readBatches = (dir: string): Batch[] =>
  listSubdirs(dir).map((name) => {
    const batchDir = path.join(dir, name);
    return {
      name,
      n: listItems(batchDir).length,
      modules: [...readBatchModules(batchDir)].sort(compareCodePoint),
    };
  });

const HEAD =
  "> 文档定位：快照型清单 · **[MUST] 由 `scripts/governance-lists.py` 重生成，[MUST NOT] 手工维护**\n";

const droppedReason = (e: Entry): string =>
  takeCodePoints(
    e.merged ? e.dropped || `合并进 ${e.merged}` : e.dropped,
    DROPPED_REASON_MAX,
  );

/** 渲染全部清单：文件名 → 内容（`ISSUE.md` 仅在存在 `issue/` 时生成） */
export const renderLists = (root: string): Map<ListFileEnum, string> => {
  const bl = readEntries(path.join(root, GovernanceDirEnum.BACKLOG));
  const dr = readEntries(path.join(root, GovernanceDirEnum.DROPPED));
  const sc = readBatches(path.join(root, GovernanceDirEnum.SCHEDULE));
  const ar = readBatches(path.join(root, GovernanceDirEnum.ARCHIVE));
  const out = new Map<ListFileEnum, string>();

  const issueDir = path.join(root, GovernanceDirEnum.ISSUE);
  if (fs.existsSync(issueDir) && fs.statSync(issueDir).isDirectory()) {
    const iss = readEntries(issueDir, true);
    out.set(
      ListFileEnum.ISSUE,
      `# 外部反馈收件箱（ISSUE）\n\n${HEAD}> 正文在 \`issue/<id>-<slug>.md\`；其中条目只有一个状态：` +
        `**未分诊**。\n> 分诊 [MUST] 由用户触发，三个出口全部 \`git mv\`：` +
        "`schedule/<批次>/`（当轮就做）· `backlog/`（成立但不是现在）· `dropped/`（不成立 / 已修 / 重复）。\n" +
        "> **issue 是报告不是派单**：外部方无回执可期、无进度可问，处置权在本仓。\n" +
        "> 按登记日升序——**最上面的就是积压最久的**。\n\n" +
        (iss.length
          ? `共 **${iss.length}** 条待分诊。\n\n| id | 标题 | 来源 | 登记 | 文件 |\n|---|---|---|---|---|\n` +
            iss
              .map(
                (e) =>
                  `| \`${e.id}\` | ${e.title} | ${e.src} | ${e.created} | [${e.file}](issue/${e.file}) |\n`,
              )
              .join("")
          : "当前无待分诊反馈。\n"),
    );
  }

  out.set(
    ListFileEnum.BACKLOG,
    `# 需求池（BACKLOG）\n\n${HEAD}> 正文在 \`backlog/<id>-<slug>.md\`；下发即 \`git mv\` 进 \`schedule/<批次>/\`。\n\n` +
      `共 **${bl.length}** 条。\n\n| id | 标题 | 领域 | 登记 | 文件 |\n|---|---|---|---|---|\n` +
      bl
        .map(
          (e) =>
            `| \`${e.id}\` | ${e.title} | ${e.modules} | ${e.created} | [${e.file}](backlog/${e.file}) |\n`,
        )
        .join(""),
  );

  out.set(
    ListFileEnum.DROPPED,
    `# 判不做 / 已过期（DROPPED）\n\n${HEAD}> **[MUST NOT] 直接删条目**——删掉会丢「为什么不做」，` +
      `而那正是防同一需求反复被提的东西。\n\n共 **${dr.length}** 条。\n\n` +
      "| id | 标题 | 判不做理由 | 文件 |\n|---|---|---|---|\n" +
      dr
        .map(
          (e) =>
            `| \`${e.id}\` | ${e.title} | ${droppedReason(e)} | [${e.file}](dropped/${e.file}) |\n`,
        )
        .join(""),
  );

  out.set(
    ListFileEnum.SCHEDULE,
    `# 在途批次（SCHEDULE）\n\n${HEAD}> **并行准入闸**：两个批次的领域集合相交即不得并行` +
      "（横向领域不计入）。\n\n" +
      (sc.length
        ? `共 **${sc.length}** 个在途批次。\n\n| 批次 | 条目数 | 所涉领域 | 进度 |\n|---|---|---|---|\n` +
          sc
            .map(
              (b) =>
                `| \`${b.name}\` | ${b.n} | ${b.modules.join(" · ")} | [PROGRESS](schedule/${b.name}/PROGRESS.md) |\n`,
            )
            .join("")
        : "当前无在途批次。\n"),
  );

  out.set(
    ListFileEnum.ARCHIVE_DONE,
    `# 已交付归档（ARCHIVE-DONE）\n\n${HEAD}> 归档目录 [MUST] 只留 \`PROGRESS.md\`（条目正文交付时删除）。\n\n` +
      (ar.length
        ? `共 **${ar.length}** 个已交付批次。\n\n| 批次 | 所涉领域 | 交付记录 |\n|---|---|---|\n` +
          ar
            .map(
              (b) =>
                `| \`${b.name}\` | ${b.modules.join(" · ")} | [PROGRESS](archive/${b.name}/PROGRESS.md) |\n`,
            )
            .join("")
        : "当前无已交付批次。\n"),
  );

  return out;
};

/** 与在库清单比对，返回有差异的清单名（保持渲染顺序） */
export const diffLists = (
  root: string,
  rendered = renderLists(root),
): ListFileEnum[] =>
  [...rendered].flatMap(([name, body]) => {
    const file = path.join(root, name);
    const old = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
    return old === body ? [] : [name];
  });

/** 把有差异的清单写盘，返回写入的清单名 */
export const writeLists = (root: string): ListFileEnum[] => {
  const rendered = renderLists(root);
  const changed = diffLists(root, rendered);
  for (const name of changed) {
    fs.writeFileSync(path.join(root, name), rendered.get(name)!, "utf-8");
  }
  return changed;
};
