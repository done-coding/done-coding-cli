/**
 * [T4] operate core 单测：三策略落地、逐项 path-render 时机（K2）、dealMarkdown 透传（K3）、
 * remove dry-run 事务边界中止（M1）、append remove 命中检测（K1）、越界 fail-loud（M8）。
 * 夹具落 tmp，afterEach 清理（K7）；env.execDir 指向 tmp，不污染工作树。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEnvContext } from "@/core/env-context";
import { operate } from "@/core/operate";
import type { BatchConfig, EnvContext, ResolvedBatch } from "@/types";
import type { DoneCodingDirHit } from "@done-coding/cli-utils";

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dc-op-")));
  tmpRoots.push(dir);
  return dir;
};

afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

/** 构造 ResolvedBatch（templateDir = tmp 下的真实模板目录） */
const mkBatch = (config: BatchConfig, templateDir: string): ResolvedBatch => {
  const hit: DoneCodingDirHit = {
    segment: "widget",
    dir: templateDir,
    namespaceDir: path.dirname(templateDir),
    realDir: templateDir,
    layer: "project",
    shadowed: false,
  };
  return { type: "widget", hit, config };
};

/** env：execDir=落地根，templateDir=模板根 */
const mkEnv = (execDir: string, templateDir: string): EnvContext =>
  createEnvContext("my-widget", { execDir, templateDir });

describe("[T4] operate 三策略落地 + path-render（K2）", () => {
  it("create(OVERWRITE)：input/output 文件名预渲染后落地", async () => {
    const execDir = mkTmp();
    const templateDir = path.join(execDir, ".tpl");
    fs.mkdirSync(templateDir, { recursive: true });
    fs.writeFileSync(
      path.join(templateDir, "comp.md"),
      "export const ${name} = 1;",
    );

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "create",
          input: "comp.md",
          output: "src/${nameKebab}/Component.ts",
        },
      ],
    };
    await operate({
      action: "add",
      batch: mkBatch(config, templateDir),
      env: mkEnv(execDir, templateDir),
    });

    const out = path.join(execDir, "src", "my-widget", "Component.ts");
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, "utf-8")).toBe("export const MyWidget = 1;");
  });

  it("append：inputData 追加到 output（globalEnvData 派生可用）", async () => {
    const execDir = mkTmp();
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      globalEnvData: { series: "${_.upperFirst(_.camelCase('Dc'))}" },
      files: [
        {
          strategy: "append",
          inputData: "\nexport { ${series}${name} };",
          output: "src/index.ts",
        },
      ],
    };
    const indexFile = path.join(execDir, "src", "index.ts");
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, "// head");

    await operate({
      action: "add",
      batch: mkBatch(config, execDir),
      env: mkEnv(execDir, execDir),
    });
    expect(fs.readFileSync(indexFile, "utf-8")).toBe(
      "// head\nexport { DcMyWidget };",
    );
  });
});

describe("[T4] operate H1：inputData 单次渲染（${$} 逃逸不被双渲染破坏）", () => {
  it("inputData 含 ${$} → 落地为字面 $（仅引擎渲一次，prepareItem 不预渲）", async () => {
    const execDir = mkTmp();
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "create",
          // ${$} 渲染为字面 "$"；若 prepareItem 预渲一次 + 引擎再渲一次（双渲染），
          // 第一次得 "$cost"，第二次会把 "$cost" 当模板再处理（破坏逃逸）。
          inputData: "const price = ${$}cost; const n = ${name};",
          output: "src/${nameKebab}/p.ts",
        },
      ],
    };
    await operate({
      action: "add",
      batch: mkBatch(config, execDir),
      env: mkEnv(execDir, execDir),
    });
    const out = path.join(execDir, "src", "my-widget", "p.ts");
    expect(fs.readFileSync(out, "utf-8")).toBe(
      "const price = $cost; const n = MyWidget;",
    );
  });
});

describe("[T4] operate H4a：globalEnvData 可引用采集变量（initial 默认值）", () => {
  it("非交互：collectEnvDataForm 的 initial 默认值回填后，globalEnvData 派生可引用之", async () => {
    const execDir = mkTmp();
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      collectEnvDataForm: [
        // initial 默认值（非交互回落），globalEnvData 须能引用 prefix
        { name: "prefix", initial: "Dc" },
      ],
      globalEnvData: {
        // 引用采集变量 prefix（H4a：采集 → 回填 env → 再渲 globalEnvData）
        fullTag: "${prefix}-${nameKebab}",
      },
      files: [
        {
          strategy: "create",
          inputData: "tag=${fullTag};",
          output: "src/${nameKebab}/t.ts",
        },
      ],
    };
    await operate({
      action: "add",
      batch: mkBatch(config, execDir),
      env: mkEnv(execDir, execDir),
    });
    const out = path.join(execDir, "src", "my-widget", "t.ts");
    expect(fs.readFileSync(out, "utf-8")).toBe("tag=Dc-my-widget;");
  });
});

describe("[T4] operate 空 series（R5ⓐ，design §9 用例8 配套）", () => {
  it("series:'' → add 不报未定义错，fullName 渲染为 ''（条件式空 series）", async () => {
    const execDir = mkTmp();
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      // synthetic 空 series 批次（generator 层，非 component）
      globalEnvData: {
        series: "",
        // 与 component config 同款条件式：空 series 不裸拼，渲染为 ""
        fullName: "${series ? series + name : ''}",
      },
      files: [
        {
          strategy: "create",
          // fullName=="" → 落地内容里 fullName 处为空串，不抛 ReferenceError
          inputData: "name=${name};fullName=[${fullName}];",
          output: "src/${nameKebab}/info.ts",
        },
      ],
    };

    await expect(
      operate({
        action: "add",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
      }),
    ).resolves.toBeUndefined();

    const out = path.join(execDir, "src", "my-widget", "info.ts");
    expect(fs.readFileSync(out, "utf-8")).toBe("name=MyWidget;fullName=[];");
  });
});

describe("[T4] operate remove（K1/M1/M2）", () => {
  const buildAppendBatch = (execDir: string): ResolvedBatch => {
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "append",
          inputData: "\nexport { ${name} };",
          output: "src/index.ts",
        },
      ],
    };
    return mkBatch(config, execDir);
  };

  it("append remove：命中则删块（rollbackRequireHit=true，K1）", async () => {
    const execDir = mkTmp();
    const indexFile = path.join(execDir, "src", "index.ts");
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, "// head\nexport { MyWidget };");

    await operate({
      action: "remove",
      batch: buildAppendBatch(execDir),
      env: mkEnv(execDir, execDir),
    });
    expect(fs.readFileSync(indexFile, "utf-8")).toBe("// head");
  });

  it("M2：append + input(.md) + dealMarkdown:true → remove 预检按剥 fence 后内容命中", async () => {
    const execDir = mkTmp();
    const templateDir = path.join(execDir, ".tpl");
    fs.mkdirSync(templateDir, { recursive: true });
    // 模板是 markdown 包裹 code fence；dealMarkdown:true 时引擎剥 fence 只留内层
    fs.writeFileSync(
      path.join(templateDir, "blk.md"),
      "```ts\nexport { ${name} };\n```",
    );

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "append",
          input: "blk.md",
          output: "src/index.ts",
          dealMarkdown: true,
        },
      ],
    };

    // 目标文件含「剥 fence 后」的块（add 时引擎追加的形态）
    const indexFile = path.join(execDir, "src", "index.ts");
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, "// head\nexport { MyWidget };\n");

    // 若预检不剥 fence（直接读 _template），blockContent 会带 ```ts 包裹 → 命中失败误报违规。
    // 预检复用 getData(dealMarkdown) 与引擎单次渲染一致 → 命中 → 成功删块。
    await operate({
      action: "remove",
      batch: mkBatch(config, templateDir),
      env: mkEnv(execDir, templateDir),
    });
    expect(fs.readFileSync(indexFile, "utf-8")).toBe("// head\n");
  });

  it("M1 dry-run：append 块被手改→执行删除前整体中止（不留半回滚）", async () => {
    const execDir = mkTmp();
    const indexFile = path.join(execDir, "src", "index.ts");
    const styleFile = path.join(execDir, "src", "style.less");
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    // index 块完好，style 块被手改（未命中）
    fs.writeFileSync(indexFile, "// head\nexport { MyWidget };");
    fs.writeFileSync(styleFile, "// MANUALLY EDITED");

    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        {
          strategy: "append",
          inputData: "\nexport { ${name} };",
          output: "src/index.ts",
        },
        {
          strategy: "append",
          inputData: "\n@import './${nameKebab}';",
          output: "src/style.less",
        },
      ],
    };

    await expect(
      operate({
        action: "remove",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
      }),
    ).rejects.toThrow(/预检未通过/);

    // 中止前 index 块未被删（不留半回滚，M1）
    expect(fs.readFileSync(indexFile, "utf-8")).toBe(
      "// head\nexport { MyWidget };",
    );
  });

  it("replace remove：dry-run 记违规 → fail-loud（不假装成功）", async () => {
    const execDir = mkTmp();
    const templateDir = path.join(execDir, ".tpl");
    fs.mkdirSync(templateDir, { recursive: true });
    fs.writeFileSync(path.join(templateDir, "r.md"), "x");
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [{ strategy: "replace", input: "r.md" }],
    };
    await expect(
      operate({
        action: "remove",
        batch: mkBatch(config, templateDir),
        env: mkEnv(execDir, templateDir),
      }),
    ).rejects.toThrow(/replace 策略不可自动回退/);
  });

  it("removeEmptyDir：remove 后空实例目录被 rmdir", async () => {
    const execDir = mkTmp();
    const instanceDir = path.join(execDir, "src", "my-widget");
    fs.mkdirSync(instanceDir, { recursive: true });
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      removeEmptyDir: true,
      files: [],
    };
    await operate({
      action: "remove",
      batch: mkBatch(config, execDir),
      env: mkEnv(execDir, execDir),
    });
    expect(fs.existsSync(instanceDir)).toBe(false);
  });
});

describe("[T4] operate 越界 fail-loud（M8）", () => {
  it("output 渲染后逃出 execDir → fail-loud", async () => {
    const execDir = mkTmp();
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [{ strategy: "create", inputData: "x", output: "../escape.ts" }],
    };
    await expect(
      operate({
        action: "add",
        batch: mkBatch(config, execDir),
        env: mkEnv(execDir, execDir),
      }),
    ).rejects.toThrow(/输出路径越界/);
  });

  it("input 渲染后逃出 templateDir → fail-loud", async () => {
    const execDir = mkTmp();
    const templateDir = path.join(execDir, ".tpl");
    fs.mkdirSync(templateDir, { recursive: true });
    const config: BatchConfig = {
      instanceDir: "${execDir}/src/${nameKebab}",
      files: [
        { strategy: "create", input: "../../etc/passwd", output: "src/x.ts" },
      ],
    };
    await expect(
      operate({
        action: "add",
        batch: mkBatch(config, templateDir),
        env: mkEnv(execDir, templateDir),
      }),
    ).rejects.toThrow(/模板输入路径越界/);
  });
});

describe("operate 越界判定解开符号链接", () => {
  /** 落地根、项目外目录、项目外的模板目录（模拟全局 / 父目录批次） */
  const mkScene = () => {
    const root = mkTmp();
    const execDir = path.join(root, "project");
    const outside = path.join(root, "outside");
    const templateDir = path.join(root, "global-batch/template");
    fs.mkdirSync(path.join(execDir, "src"), { recursive: true });
    fs.mkdirSync(outside);
    fs.mkdirSync(templateDir, { recursive: true });
    fs.writeFileSync(path.join(outside, "secret.txt"), "secret");
    fs.writeFileSync(
      path.join(templateDir, "comp.md"),
      "export const ${name} = 1;",
    );
    return { execDir, outside, templateDir };
  };
  const run = (
    files: BatchConfig["files"],
    scene: ReturnType<typeof mkScene>,
  ) =>
    operate({
      action: "add",
      batch: mkBatch(
        { instanceDir: "${execDir}/src/${nameKebab}", files },
        scene.templateDir,
      ),
      env: mkEnv(scene.execDir, scene.templateDir),
    });

  it("经项目内指向外部的目录链接写出去 → 拒绝，项目外不落文件", async () => {
    const scene = mkScene();
    fs.symlinkSync(scene.outside, path.join(scene.execDir, "src/linked"));
    await expect(
      run(
        [{ strategy: "create", inputData: "x", output: "src/linked/x.ts" }],
        scene,
      ),
    ).rejects.toThrow(/输出路径 .*越出 execDir/);
    expect(fs.readdirSync(scene.outside)).toEqual(["secret.txt"]);
  });

  it("output 是指向外部的悬空链接 → 拒绝，不在链接目标处建文件", async () => {
    const scene = mkScene();
    fs.symlinkSync(
      path.join(scene.outside, "created.ts"),
      path.join(scene.execDir, "src/dangling.ts"),
    );
    await expect(
      run(
        [{ strategy: "create", inputData: "x", output: "src/dangling.ts" }],
        scene,
      ),
    ).rejects.toThrow(/越出 execDir/);
    expect(fs.readdirSync(scene.outside)).toEqual(["secret.txt"]);
  });

  it("模板文件经链接指向 templateDir 之外 → 拒绝，不把外部文件读进实例", async () => {
    const scene = mkScene();
    fs.symlinkSync(
      path.join(scene.outside, "secret.txt"),
      path.join(scene.templateDir, "evil.md"),
    );
    await expect(
      run(
        [{ strategy: "create", input: "evil.md", output: "src/x.ts" }],
        scene,
      ),
    ).rejects.toThrow(/模板输入 .*越出 templateDir/);
    expect(fs.existsSync(path.join(scene.execDir, "src/x.ts"))).toBe(false);
  });

  it("模板目录在项目之外（全局 / 父目录批次）照常生成，模板目录内的链接照常可读", async () => {
    const scene = mkScene();
    fs.symlinkSync("comp.md", path.join(scene.templateDir, "alias.md"));
    await run(
      [
        { strategy: "create", input: "comp.md", output: "src/a.ts" },
        { strategy: "create", input: "alias.md", output: "src/b.ts" },
      ],
      scene,
    );
    for (const name of ["a.ts", "b.ts"]) {
      expect(
        fs.readFileSync(path.join(scene.execDir, "src", name), "utf-8"),
      ).toBe("export const MyWidget = 1;");
    }
  });
});
