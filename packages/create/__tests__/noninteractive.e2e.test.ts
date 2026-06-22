import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * create-done-coding 非交互供答 e2e 测试
 * ---
 * 覆盖：--env / --env-file 单发供答、initial 回落、--env 覆盖 --env-file、
 * 缺必填快速失败（无死循环）、--list-questions 机读 JSON、模板参数真编译。
 *
 * 通过 spawn 已构建的 es/cli.mjs 运行：子进程 stdin/stdout 为管道 = 非 TTY，
 * 天然触发非交互分支。spawnSync 的 timeout 用来守「缺答案死循环」回归。
 *
 * 前置：被测包及其工作区依赖需先构建（beforeAll 自动构建，
 * 设 DC_SKIP_BUILD=1 可跳过以加速本地迭代）。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(TEST_DIR, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "..", "..");
const CLI_PATH = path.resolve(PKG_DIR, "es", "cli.mjs");

/** spawn CLI（非 TTY），带超时守护，返回 stdout/stderr/退出信息 */
const runCli = (
  args: string[],
  cwd: string,
): {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
} => {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    cwd,
    encoding: "utf-8",
    input: "", // 提供 stdin 管道（非 TTY），并立即 EOF
    timeout: 20000, // 守护：死循环会被超时杀掉，signal 非 null 即判失败
    killSignal: "SIGKILL",
  });
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

/** 构造模板占位符 `${key}`（避免源码里出现字面 ${...} 触发 lint） */
const ph = (key: string) => "${" + key + "}";

/** 在 baseDir 下创建一个本地 git 模板仓（多文件 + 多占位 + 同占位多次） */
const createLocalTemplateRepo = (baseDir: string): string => {
  const tpl = path.join(baseDir, "tpl");
  mkdirSync(path.join(tpl, ".done-coding"), { recursive: true });
  mkdirSync(path.join(tpl, "src"), { recursive: true });

  writeFileSync(
    path.join(tpl, "package.tpl.json"),
    `{ "name": "@${ph("organization")}/${ph("name")}", "version": "0.0.0", "author": "${ph("organization")}" }\n`,
  );
  writeFileSync(
    path.join(tpl, "src", "index.tpl.ts"),
    [
      `// ${ph("name")} by ${ph("organization")}`,
      `export const APP = "${ph("name")}";`,
      `export const ORG = "${ph("organization")}";`,
      "",
    ].join("\n"),
  );
  writeFileSync(
    path.join(tpl, ".done-coding", "template.json"),
    JSON.stringify(
      {
        collectEnvDataForm: [
          { key: "organization", label: "组织", initial: "done-coding" },
          { key: "name", label: "包名" },
        ],
        list: [
          {
            input: "package.tpl.json",
            output: "package.json",
            mode: "overwrite",
          },
          {
            input: "src/index.tpl.ts",
            output: "src/index.ts",
            mode: "overwrite",
          },
        ],
      },
      null,
      2,
    ),
  );

  const git = (gitArgs: string[]) =>
    spawnSync("git", gitArgs, { cwd: tpl, encoding: "utf-8" });
  git(["init", "-q"]);
  git(["add", "-A"]);
  git([
    "-c",
    "user.email=test@done-coding.dev",
    "-c",
    "user.name=test",
    "commit",
    "-qm",
    "init template",
  ]);
  return tpl;
};

/** 通用建仓助手：写入 form + 文件（可带 globalEnvData）并 git 提交，返回仓库路径 */
const writeTemplateRepo = (
  dir: string,
  config: {
    form: Record<string, unknown>[];
    files: { input: string; output: string; content: string }[];
    globalEnvData?: Record<string, unknown>;
  },
): string => {
  const { form, files, globalEnvData = {} } = config;
  mkdirSync(path.join(dir, ".done-coding"), { recursive: true });
  for (const f of files) {
    const full = path.join(dir, f.input);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, f.content);
  }
  writeFileSync(
    path.join(dir, ".done-coding", "template.json"),
    JSON.stringify(
      {
        globalEnvData,
        collectEnvDataForm: form,
        list: files.map((f) => ({
          input: f.input,
          output: f.output,
          mode: "overwrite",
        })),
      },
      null,
      2,
    ),
  );
  const git = (gitArgs: string[]) =>
    spawnSync("git", gitArgs, { cwd: dir, encoding: "utf-8" });
  git(["init", "-q"]);
  git(["add", "-A"]);
  git([
    "-c",
    "user.email=test@done-coding.dev",
    "-c",
    "user.name=test",
    "commit",
    "-qm",
    "init template",
  ]);
  return dir;
};

let workspaceRoot: string;
let templateRepo: string;
/** 级联默认值仓：name←内置 $projectName、cacheNamespace←前序答案 name、org←全局 author */
let cascadeRepo: string;
/** 坏引用仓：某问题 initial 引用不存在的变量 */
let badRefRepo: string;
/** 向后引用仓：靠前问题 initial 引用靠后的变量（违反"只能引用前面"） */
let forwardRefRepo: string;

beforeAll(() => {
  if (process.env.DC_SKIP_BUILD !== "1") {
    const build = spawnSync(
      "npx",
      [
        "lerna",
        "run",
        "build",
        "--scope=@done-coding/cli-utils",
        "--scope=@done-coding/cli-template",
        "--scope=create-done-coding",
      ],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    if (build.status !== 0) {
      throw new Error(
        `构建被测包失败，无法运行 e2e：\n${build.stdout}\n${build.stderr}`,
      );
    }
  }
  if (!existsSync(CLI_PATH)) {
    throw new Error(
      `未找到 CLI 产物 ${CLI_PATH}，请先构建（或去掉 DC_SKIP_BUILD）`,
    );
  }

  workspaceRoot = mkdtempSync(path.join(tmpdir(), "dc-create-e2e-"));
  templateRepo = createLocalTemplateRepo(workspaceRoot);

  cascadeRepo = writeTemplateRepo(path.join(workspaceRoot, "cascade-tpl"), {
    // 三种来源各一：内置 $projectName / 前序答案 name / 全局 author
    form: [
      { key: "name", label: "包名", initial: ph("$projectName") },
      { key: "cacheNamespace", label: "缓存命名空间", initial: ph("name") },
      { key: "org", label: "组织", initial: ph("author") },
    ],
    files: [
      {
        input: "ns.tpl.txt",
        output: "ns.txt",
        content: `name=${ph("name")}\nns=__${ph("cacheNamespace")}__\norg=${ph("org")}\n`,
      },
    ],
    globalEnvData: { author: "globalauthor" },
  });

  // 靠前的 a 引用靠后的 b——即便供答了 b，处理 a 时 b 尚未进上下文，应当失败
  forwardRefRepo = writeTemplateRepo(
    path.join(workspaceRoot, "forwardref-tpl"),
    {
      form: [
        { key: "a", label: "甲", initial: ph("b") },
        { key: "b", label: "乙" },
      ],
      files: [
        { input: "ns.tpl.txt", output: "ns.txt", content: `a=${ph("a")}\n` },
      ],
    },
  );

  badRefRepo = writeTemplateRepo(path.join(workspaceRoot, "badref-tpl"), {
    form: [
      { key: "name", label: "包名" },
      { key: "cacheNamespace", label: "缓存命名空间", initial: ph("nope") },
    ],
    files: [
      {
        input: "ns.tpl.txt",
        output: "ns.txt",
        content: `ns=${ph("cacheNamespace")}\n`,
      },
    ],
  });
}, 120000);

afterAll(() => {
  if (workspaceRoot) {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

/** 为单个用例开一个独立 work 目录 */
const makeWork = (name: string): string => {
  const work = path.join(workspaceRoot, "work", name);
  mkdirSync(work, { recursive: true });
  return work;
};

describe("create-done-coding 非交互供答 e2e", () => {
  it("--env 内联供答：跨文件、同占位多次的参数真编译，输出无残留占位", () => {
    const work = makeWork("inline");
    const r = runCli(
      [
        "-n",
        "inlineapp",
        "-p",
        templateRepo,
        "--env",
        JSON.stringify({ organization: "acme", name: "inlineapp" }),
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull(); // 未超时 = 无死循环
    expect(r.status).toBe(0);

    const pkg = readFileSync(
      path.join(work, "inlineapp", "package.json"),
      "utf-8",
    );
    expect(pkg).toContain('"name": "@acme/inlineapp"');
    expect(pkg).toContain('"author": "acme"');

    const indexTs = readFileSync(
      path.join(work, "inlineapp", "src", "index.ts"),
      "utf-8",
    );
    expect(indexTs).toContain('export const APP = "inlineapp";');
    expect(indexTs).toContain('export const ORG = "acme";');

    // 编译输出文件不应残留未替换占位（输入 .tpl 源文件保留属模板设计，不在此断言）
    expect(pkg).not.toContain("${");
    expect(indexTs).not.toContain("${");
  });

  it("--env-file 供答：从 JSON 文件读取答案完成编译", () => {
    const work = makeWork("envfile");
    const answers = path.join(work, "answers.json");
    writeFileSync(
      answers,
      JSON.stringify({ organization: "filecorp", name: "fileapp" }),
    );
    const r = runCli(
      [
        "-n",
        "fileapp",
        "-p",
        templateRepo,
        "--env-file",
        answers,
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const pkg = readFileSync(
      path.join(work, "fileapp", "package.json"),
      "utf-8",
    );
    expect(pkg).toContain('"name": "@filecorp/fileapp"');
  });

  it("省略带默认值的字段：organization 回落 initial 默认值", () => {
    const work = makeWork("default");
    const r = runCli(
      [
        "-n",
        "defapp",
        "-p",
        templateRepo,
        "--env",
        JSON.stringify({ name: "defapp" }),
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const pkg = readFileSync(
      path.join(work, "defapp", "package.json"),
      "utf-8",
    );
    expect(pkg).toContain('"name": "@done-coding/defapp"');
  });

  it("--env 浅覆盖 --env-file：同 key 取 --env，其余取文件", () => {
    const work = makeWork("override");
    const answers = path.join(work, "answers.json");
    writeFileSync(
      answers,
      JSON.stringify({ organization: "filecorp", name: "fileapp" }),
    );
    const r = runCli(
      [
        "-n",
        "ovrapp",
        "-p",
        templateRepo,
        "--env-file",
        answers,
        "--env",
        JSON.stringify({ organization: "override" }),
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const pkg = readFileSync(
      path.join(work, "ovrapp", "package.json"),
      "utf-8",
    );
    expect(pkg).toContain('"name": "@override/fileapp"'); // org 来自 --env，name 来自 file
  });

  it("缺必填项：非 0 退出、stderr 列出缺失 key、无死循环、不生成项目", () => {
    const work = makeWork("missing");
    const r = runCli(
      [
        "-n",
        "missapp",
        "-p",
        templateRepo,
        "--env",
        JSON.stringify({ organization: "acme" }), // 缺无默认值的 name
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull(); // 关键：未超时被杀 = 无死循环
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("name"); // 列出缺失的必填 key
    // 有默认值的 organization 不应被当作缺失报出
    expect(r.stderr).not.toContain("organization");
    expect(existsSync(path.join(work, "missapp"))).toBe(false);
  });

  it("--list-questions：stdout 输出纯 JSON 问题清单，不创建项目", () => {
    const work = makeWork("listq");
    const r = runCli(["-p", templateRepo, "--list-questions"], work);
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);

    const parsed = JSON.parse(r.stdout); // stdout 必须是可解析的纯 JSON
    expect(parsed).toEqual([
      { key: "organization", required: false, default: "done-coding" },
      { key: "name", required: true },
    ]);
    // 未创建任何项目，无 probe 残留
    expect(existsSync(path.join(work, "__list_questions_probe__"))).toBe(false);
  });

  it("级联默认值：三来源（内置 $projectName / 前序答案 name / 全局 author）全程不答即逐级回落", () => {
    const work = makeWork("cascade-default");
    const r = runCli(
      [
        "-n",
        "casapp",
        "-p",
        cascadeRepo,
        "--env",
        JSON.stringify({}), // 全不答：三个 initial 各引各的来源
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const ns = readFileSync(path.join(work, "casapp", "ns.txt"), "utf-8");
    expect(ns).toContain("name=casapp"); // name←内置 $projectName(-n)
    expect(ns).toContain("ns=__casapp__"); // cacheNamespace←前序答案 name
    expect(ns).toContain("org=globalauthor"); // org←全局 author
    expect(ns).not.toContain("${");
  });

  it("级联默认值：答 name 时，引用它的 cacheNamespace 跟着取到该答案", () => {
    const work = makeWork("cascade-chain");
    const r = runCli(
      [
        "-n",
        "casapp-chain",
        "-p",
        cascadeRepo,
        "--env",
        JSON.stringify({ name: "mypkg" }), // 答 name，cacheNamespace 走 initial 引用它
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const ns = readFileSync(path.join(work, "casapp-chain", "ns.txt"), "utf-8");
    expect(ns).toContain("name=mypkg");
    expect(ns).toContain("ns=__mypkg__"); // 取到了前序答案 name=mypkg
  });

  it("级联默认值：显式供答覆盖 initial 引用", () => {
    const work = makeWork("cascade-override");
    const r = runCli(
      [
        "-n",
        "casapp2",
        "-p",
        cascadeRepo,
        "--env",
        JSON.stringify({ name: "mypkg", cacheNamespace: "custom" }),
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const ns = readFileSync(path.join(work, "casapp2", "ns.txt"), "utf-8");
    expect(ns).toContain("ns=__custom__");
  });

  it("只能引用前面：靠前的 a 引用靠后的 b——即便供答 b 也失败，不生成项目", () => {
    const work = makeWork("forwardref");
    const r = runCli(
      [
        "-n",
        "fwdapp",
        "-p",
        forwardRefRepo,
        "--env",
        JSON.stringify({ b: "laterval" }), // 即使答了 b，处理 a 时 b 尚未进上下文
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("a"); // 指出是 a 的 initial 出错
    expect(r.stderr).toContain("b"); // 引用的 b 不在（前序）上下文
    expect(existsSync(path.join(work, "fwdapp"))).toBe(false);
  });

  it("initial 引用不存在的变量：非 0 退出、stderr 指出是哪个 key 引用了缺失变量、不生成项目", () => {
    const work = makeWork("badref");
    const r = runCli(
      [
        "-n",
        "badapp",
        "-p",
        badRefRepo,
        "--env",
        JSON.stringify({ name: "mypkg" }), // 省略 cacheNamespace → 触发其坏 initial 渲染
        "--openGitDetailOptimize=false",
      ],
      work,
    );
    expect(r.signal).toBeNull(); // 无死循环
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("cacheNamespace"); // 指出是哪个 key 的 initial
    expect(r.stderr).toContain("nope"); // 指出缺失的引用变量
    expect(existsSync(path.join(work, "badapp"))).toBe(false);
  });
});
