/**
 * <add/remove 公共操作引擎>（design §3.1/§4.3/§4.4，最高风险任务，K1/K2/K3/K8/M1/M2）。
 *
 *  - 遍历 files[]（按声明顺序串行处理，content-free——[MUST NOT] 写死 entry/index）。
 *  - 逐项**先预渲染** input/output（`_template(x)(envData)`，交引擎前完成，K2）；
 *    引擎 OVERWRITE/APPEND 分支不渲染文件名，仅 REPLACE 渲染 input。
 *  - 越界校验在预渲染**之后**（M8）：output→execDir 内、input→real templateDir 内。
 *  - 按 strategy 派引擎 OutputMode（strategyRegistry）；dealMarkdown 透传（K3，FileEntry 级覆盖 BatchConfig 级）。
 *  - **单点采集**：构造好的 compile items 交 batchCompileHandler（extraEnvData=已含答案+派生的 env，
 *    collectEnvDataForm=batch.collectEnvDataForm）。因 env 已含答案，trulyMissing 天然为空 →
 *    不重复 prompt（避免与 T5 双采集）；仍缺的必填项由 batchCompileHandler 按交互/非交互兜底。
 *  - remove 走 M1 dry-run 预检事务边界：先全算 append 命中（rollbackRequireHit）+ replace 不可回滚项，
 *    全过才执行删除（不留半回滚）；append 项 remove 路径显式传 rollbackRequireHit=true（K1，经 `...rest` 透传）。
 *
 * 注：operate 接收"批次解析结果 + 操作类型 + envData"（OperateOptions），与命令面解耦，
 * 供 [P4a] assemble 复用（design §10）。
 */
import fs from "node:fs";
import path from "node:path";
import {
  removeEmptyInstanceDir,
  resolveInstanceDir,
} from "@/core/instance-dir";
import { resolveStrategy } from "@/core/strategy";
import type {
  BatchConfig,
  EnvContext,
  FileEntry,
  OperateOptions,
} from "@/types";
import {
  batchCompileHandler,
  getData,
  OutputModeEnum,
  resolveMarkerComment,
  validateMarkerKey,
  computeRollback,
  probeMarkerPairing,
  type CollectFormItem as TemplateCollectFormItem,
  type CompileTemplateConfigListItemRaw,
  type InsertAnchor,
  type InsertMarkerComment,
} from "@done-coding/cli-template";
import { outputConsole, safeCwd } from "@done-coding/cli-utils";
import { getMarkerNs } from "@/core/marker-ns";
import _template from "lodash.template";

/** 内建 canonical / helper 保留键（用于从 env 分离「采集答案」开放键） */
const BUILTIN_KEYS = new Set([
  "name",
  "namePascal",
  "nameCamel",
  "nameLowerFirst",
  "nameKebab",
  "rawName",
  "$",
  "execDir",
  "templateDir",
  "_",
]);

/** 渲染单个 `${}` 表达式（content-free，沿用 lodash.template + 同一 env） */
const renderExpr = (expr: string, env: EnvContext): string =>
  _template(expr)(env);

/** realpath 容错（路径不存在时回落 resolve 后字面量，越界校验用前缀比较即可） */
const safeRealpath = (p: string): string => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

/** 路径 child 是否在 parent 内（含等于 parent 自身） */
const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/**
 * 顺序求值 globalEnvData（声明式派生：series/fullName/cls…），累积进 env。
 * 使后项可引用前项（与 batch 级联同向）。须在此处渲染——batchCompileHandler 的 `_assign`
 * 不会渲染 globalEnvData 值里的 `${}`，故 generator 自行渲染后作为 extraEnvData 注入。
 */
const renderGlobalEnvData = (
  config: BatchConfig,
  env: EnvContext,
): EnvContext => {
  const merged: EnvContext = { ...env };
  for (const [key, raw] of Object.entries(config.globalEnvData ?? {})) {
    merged[key] = typeof raw === "string" ? renderExpr(raw, merged) : raw;
  }
  return merged;
};

/** 预渲染后的单条编译条目（含 strategy 解析出的 mode、越界校验后的 input/output） */
interface PreparedItem extends CompileTemplateConfigListItemRaw {
  strategy?: FileEntry["strategy"];
  dealMarkdown?: boolean;
  rollbackRequireHit?: boolean;
  rollbackDelNullFile?: boolean;
  rollbackDelAskAsYes?: boolean;
  // [inject] 显式透传（design §12 A2）：prepareItem 截断 `...file`，须显式带这三个字段
  anchor?: InsertAnchor;
  markerKey?: string;
  markerComment?: InsertMarkerComment;
}

/**
 * 把单个 FileEntry 预渲染（K2）+ 越界校验（M8/M7）+ 解析 strategy → mode，
 * 产出可交引擎的 compile item。
 */
/**
 * B2（design §12）：交引擎前按策略必填字段守卫——throw 而非引擎 ensure/process.exit。
 * 防 malformed config 触发引擎 process.exit(1) 杀进程（尤其 MCP 长驻 server）。additive，well-formed 不受影响。
 */
const assertRequiredFields = (file: FileEntry, mode: OutputModeEnum): void => {
  const strategyLabel = file.strategy ?? "create";
  if (mode === OutputModeEnum.REPLACE) {
    if (file.input === undefined) {
      throw new Error(`replace 策略须提供 input（模板源文件）`);
    }
  } else if (file.output === undefined) {
    throw new Error(`${strategyLabel} 策略须提供 output（输出目标路径）`);
  }
  if (file.input === undefined && file.inputData === undefined) {
    throw new Error(`${strategyLabel} 策略须提供 input 或 inputData（内容源）`);
  }
};

/**
 * inject 专用字段（design §12 A2/A3）：交引擎前预渲染 anchor.pattern + markerKey（K2 时机）。
 * markerKey 缺省在此算 `${batchType}:${name}`，[MUST NOT] 注入 __batchType 到 env（防污染）。
 */
const prepareInjectFields = (params: {
  file: FileEntry;
  env: EnvContext;
  batchType: string;
  mode: OutputModeEnum;
}): Pick<PreparedItem, "anchor" | "markerKey" | "markerComment"> => {
  const { file, env, batchType, mode } = params;
  if (mode !== OutputModeEnum.INSERT) {
    return {};
  }
  const anchor = file.anchor
    ? { ...file.anchor, pattern: renderExpr(file.anchor.pattern, env) }
    : undefined;
  const markerKey =
    file.markerKey !== undefined
      ? renderExpr(file.markerKey, env)
      : `${batchType}:${String(env.name)}`;
  return {
    ...(anchor !== undefined ? { anchor } : {}),
    markerKey,
    ...(file.markerComment !== undefined
      ? { markerComment: file.markerComment }
      : {}),
  };
};

const prepareItem = (
  file: FileEntry,
  env: EnvContext,
  ctx: { config: BatchConfig; batchType: string },
): PreparedItem => {
  const { config, batchType } = ctx;
  const descriptor = resolveStrategy(file.strategy);

  // ── B2（design §12）：交引擎前按策略必填字段守卫（throw 而非引擎 process.exit，护 MCP 进程） ──
  assertRequiredFields(file, descriptor.mode);

  // ── K2：交引擎前逐项预渲染 input/output 文件名（引擎 OVERWRITE/APPEND 不渲染文件名） ──
  // 引擎以 rootDir(=execDir) resolve input/output（compile-common getData/path.resolve(rootDir,...)）。
  // 故 generator 须把 input 解析为「以 templateDir 为基准」的绝对路径再交引擎——
  // 绝对路径下引擎的 path.resolve(execDir, abs) 恒等于该绝对路径，读边界落 templateDir（M7）。
  const renderedInput =
    file.input !== undefined ? renderExpr(file.input, env) : undefined;
  const output =
    file.output !== undefined ? renderExpr(file.output, env) : undefined;

  // ── M8：output 渲染后 resolve(execDir) 须仍在 execDir 内（可绝对可相对） ──
  if (output !== undefined) {
    const outputAbs = path.resolve(env.execDir, output);
    if (!isInside(env.execDir, outputAbs)) {
      throw new Error(
        `输出路径越界（须落在 execDir 内）：${output} → ${outputAbs}（execDir=${env.execDir}）`,
      );
    }
  }

  // ── M7/M8：input 以 real templateDir 为基准解析为绝对路径，须仍在 templateDir 内 ──
  let input = renderedInput;
  if (renderedInput !== undefined && env.templateDir) {
    const realTemplateDir = safeRealpath(env.templateDir);
    const inputAbs = path.resolve(realTemplateDir, renderedInput);
    if (!isInside(realTemplateDir, inputAbs)) {
      throw new Error(
        `模板输入路径越界（须落在 templateDir 内）：${renderedInput} → ${inputAbs}（templateDir=${realTemplateDir}）`,
      );
    }
    // 交引擎前转绝对路径（引擎以 execDir resolve，绝对路径下与 templateDir 基准一致）
    input = inputAbs;
  }

  // ── K3：dealMarkdown content-free，FileEntry 级覆盖 BatchConfig 级 ──
  const dealMarkdown = file.dealMarkdown ?? config.dealMarkdown;
  // ── 回退选项 content-free 透传（FileEntry 覆盖 BatchConfig）：非交互 remove 须 askAsYes=true ──
  const rollbackDelNullFile =
    file.rollbackDelNullFile ?? config.rollbackDelNullFile;
  const rollbackDelAskAsYes =
    file.rollbackDelAskAsYes ?? config.rollbackDelAskAsYes;

  // ── inject 专用字段（抽 helper，design §12 A2/A3）──
  const injectFields = prepareInjectFields({
    file,
    env,
    batchType,
    mode: descriptor.mode,
  });

  return {
    mode: descriptor.mode,
    strategy: file.strategy,
    ...(input !== undefined ? { input } : {}),
    // H1：inputData 传原值（[MUST NOT] 预渲染）——引擎 compileTemplate 会 _template(content)(envData)
    // 单次渲染。此处不可 renderExpr，否则双渲染破坏 `${$}` 等逃逸（先渲成 "$" 再被引擎当插值）。
    ...(file.inputData !== undefined ? { inputData: file.inputData } : {}),
    ...(output !== undefined ? { output } : {}),
    ...(dealMarkdown !== undefined ? { dealMarkdown } : {}),
    ...(rollbackDelNullFile !== undefined ? { rollbackDelNullFile } : {}),
    ...(rollbackDelAskAsYes !== undefined ? { rollbackDelAskAsYes } : {}),
    ...injectFields,
  };
};

/**
 * E6（design §12 A4）：同一目标文件内同 markerKey 出现多次 → fail-loud。
 * 否则 add 时第二块会"幂等替换"第一块、remove 时只删首个，状态不一致。
 */
const assertNoMarkerKeyConflict = (
  items: PreparedItem[],
  env: EnvContext,
): void => {
  const seen = new Set<string>();
  for (const item of items) {
    if (
      item.mode !== OutputModeEnum.INSERT ||
      item.output === undefined ||
      item.markerKey === undefined
    ) {
      continue;
    }
    const outputPath = path.resolve(env.execDir, item.output);
    const dedupe = `${outputPath} ${item.markerKey}`;
    if (seen.has(dedupe)) {
      throw new Error(
        `inject 同一文件同 markerKey 冲突（E6）：${outputPath} markerKey「${item.markerKey}」出现多次，请为各 inject 项设不同 markerKey`,
      );
    }
    seen.add(dedupe);
  }
};

/**
 * M1 dry-run 事务边界：remove 前只读预检全部条目，
 *  - append 项：校验目标文件 includes 命中（不命中=违规）；
 *  - replace 项：记一条「不可自动回退」违规；
 * 全过才允许真正删除；任一不过 → 执行前 fail-loud 中止、列违规、不留半回滚。
 */
const dryRunRemovePrecheck = (items: PreparedItem[], env: EnvContext): void => {
  const violations: string[] = [];
  for (const item of items) {
    if (item.strategy === "replace") {
      violations.push(
        `replace 策略不可自动回退：${item.input ?? "(input)"}（请手动还原）`,
      );
      continue;
    }
    // P5（design §12）：inject marker 命中预检——未命中先 fail，不进半删
    if (item.mode === OutputModeEnum.INSERT) {
      if (item.output === undefined) {
        continue;
      }
      const outputPath = path.resolve(env.execDir, item.output);
      if (!fs.existsSync(outputPath)) {
        // 引擎会 warn「无需回滚」，非违规（与 add 顺序幂等）
        continue;
      }
      try {
        const comment = resolveMarkerComment(outputPath, item.markerComment);
        const key = validateMarkerKey(
          item.markerKey,
          comment,
          outputPath,
          getMarkerNs(),
        );
        // computeRollback 纯计算（不写 fs）：未命中/非成对会 throw → 记违规
        computeRollback(fs.readFileSync(outputPath, "utf-8"), {
          comment,
          markerKey: key,
          markerNs: getMarkerNs(),
          outputPath,
        });
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error));
      }
      continue;
    }
    if (item.mode !== OutputModeEnum.APPEND || item.output === undefined) {
      continue;
    }
    const outputPath = path.resolve(env.execDir, item.output);
    if (!fs.existsSync(outputPath)) {
      // 目标文件不存在 → 引擎会 warn「无需回滚」，非违规（与 add 顺序幂等）
      continue;
    }
    // M2：复算该块内容须与引擎**单次**渲染一致——复用引擎 getData 归一化
    // （dealMarkdown 剥 fence + inputData/input 同源），再单次 renderExpr。
    // item.input 已是绝对路径（prepareItem 解析），rootDir 不影响 resolve 结果。
    const templateContent = getData({
      rootDir: env.execDir,
      filePath: item.input,
      dataInit: item.inputData,
      limitJson: false,
      filePathKey: "input",
      dataInitKey: "inputData",
      dealMarkdown: item.dealMarkdown,
    });
    const blockContent = renderExpr(templateContent, env);
    const oldContent = fs.readFileSync(outputPath, "utf-8");
    if (!oldContent.includes(blockContent)) {
      violations.push(
        `append 块回滚未命中目标内容（可能已被手改）：${outputPath}`,
      );
    }
  }
  if (violations.length) {
    throw new Error(
      `remove 预检未通过，执行前中止（不留半回滚，M1）：\n  - ${violations.join(
        "\n  - ",
      )}`,
    );
  }
};

/**
 * 把 generator 的 collectEnvDataForm（`{ name, message?, initial? }` / string）
 * 映射为 cli-template 的表单形态（`{ key, label, initial? }` / string）。
 * batchCompileHandler 内部按 `key`/`label` 消费，故须显式映射，[MUST NOT] 直接透传。
 */
const toTemplateForm = (
  form: BatchConfig["collectEnvDataForm"] = [],
): (TemplateCollectFormItem | string)[] =>
  form.map((item) => {
    if (typeof item === "string") {
      return item;
    }
    const initial = typeof item.initial === "string" ? item.initial : undefined;
    return {
      key: item.name,
      label: (item.message as string | undefined) ?? item.name,
      ...(initial !== undefined ? { initial } : {}),
    };
  });

/**
 * 从 env 提取「采集答案」交 batchCompileHandler 的 collectEnvData，
 * 使其单趟循环直接命中已答项（trulyMissing 为空，不重复 prompt）。
 * content-free：把 env 中非内建/非 helper 的开放键视为已答。
 */
const extractAnswers = (env: EnvContext): Record<string, unknown> => {
  const answers: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!BUILTIN_KEYS.has(key)) {
      answers[key] = value;
    }
  }
  return answers;
};

/**
 * H4a：先解析 collectEnvDataForm 的 initial 默认值（级联：可引用 builtins + 前序已答），
 * 把仍缺、且有 initial 的项回填进 env——使其后 renderGlobalEnvData 可引用这些采集变量。
 * 复刻 batch-compile 的 initial 级联（有序累积、仅渲含 `${` 的 initial、fail-fast）。
 * 已答（supplied / 交互采集）项不动；无 initial 的缺项留给 batchCompileHandler 按非交互 fail-fast 兜底。
 */
const resolveFormDefaults = (
  config: BatchConfig,
  env: EnvContext,
): EnvContext => {
  const merged: EnvContext = { ...env };
  for (const raw of config.collectEnvDataForm ?? []) {
    const item = typeof raw === "string" ? { name: raw } : raw;
    if (merged[item.name] !== undefined) {
      continue; // 已答（supplied / 交互），不覆盖
    }
    const initial = item.initial;
    if (typeof initial !== "string") {
      continue; // 无 initial 或非字符串：留给 batchCompileHandler 兜底
    }
    if (!initial.includes("${")) {
      merged[item.name] = initial; // 纯字符串默认值原样
      continue;
    }
    try {
      merged[item.name] = renderExpr(initial, merged);
    } catch (error) {
      throw new Error(
        `模板参数「${item.name}」的 initial 默认值 ${JSON.stringify(
          initial,
        )} 引用了不存在的变量：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return merged;
};

/** add/remove 公共入口（action 区分；rollback=false=add / true=remove） */
export const operate = async (opts: OperateOptions): Promise<void> => {
  const { action, batch, env: envInit, allowDangerous } = opts;
  const { config } = batch;
  const rollback = action === "remove";

  // execDir 永远落 cwd（L5）；env 应已含 execDir，缺省兜底 safeCwd
  const envBase: EnvContext = {
    ...envInit,
    execDir: envInit.execDir ?? safeCwd(),
  };

  // H4a：先解析采集表单 initial 默认值（级联）回填 env——再渲 globalEnvData，
  // 使声明式派生（series/fullName…）可引用采集变量（含 initial 默认值）。
  const env = resolveFormDefaults(config, envBase);

  // 声明式派生变量（globalEnvData）后渲染并累积进 env（K8：name/nameKebab 等 canonical + 采集变量已在 env）
  const renderedEnv = renderGlobalEnvData(config, env);

  // 逐项预渲染 + 越界校验 + strategy→mode（K2/M7/M8/K3）；batch.type 供 inject markerKey 缺省（A3）
  const items = config.files.map((file) =>
    prepareItem(file, renderedEnv, { config, batchType: batch.type }),
  );

  // E6（design §12 A4）：同一目标文件内同 markerKey 冲突预检（inject 项）
  assertNoMarkerKeyConflict(items, renderedEnv);

  // modify 专路：filter insert + must-exist 预检 + skip-missing（T4）
  if (action === "modify") {
    const ns = getMarkerNs();
    // 1. 过滤 insert 子集（engine mode === INSERT，codebase idiom）
    let insertItems = items.filter((it) => it.mode === OutputModeEnum.INSERT);
    const skippedNonInsert = items.length - insertItems.length;
    // 2. 零 insert fail-loud
    if (insertItems.length === 0) {
      throw new Error("该批次无 insert 项，modify 无可改目标");
    }
    // 3. must-exist 预检 via probeMarkerPairing（三态：0=缺失可跳过，1=存在可改，throw=损坏必 fail-loud）
    // probeMarkerPairing 在 output undefined 时视为 0（absent），输出路径不存在时内容为空串→ 0（absent）。
    const probe = (it: PreparedItem): 0 | 1 => {
      if (it.output === undefined) return 0;
      const outputPath = path.resolve(renderedEnv.execDir, it.output);
      const content = fs.existsSync(outputPath)
        ? fs.readFileSync(outputPath, "utf-8")
        : "";
      const comment = resolveMarkerComment(outputPath, it.markerComment);
      // validateMarkerKey 已在 prepareItem 时执行，此处 markerKey! 必然合法
      return probeMarkerPairing(content, {
        comment,
        markerKey: it.markerKey!,
        markerNs: ns,
        outputPath,
      });
    };
    // probe() throws on corrupt — that throw propagates BEFORE any write (zero writes guarantee).
    // missing = only genuinely-absent items (probe === 0). Corrupt items never reach this filter.
    const missing = insertItems.filter((it) => probe(it) === 0);
    if (missing.length && !opts.skipMissing) {
      throw new Error(
        `modify 预检失败，以下 marker 块不存在（默认原子中止、零写盘）：\n  - ` +
          missing
            .map(
              (it) =>
                `${path.resolve(renderedEnv.execDir, it.output!)} :: ${it.markerKey}`,
            )
            .join("\n  - "),
      );
    }
    if (opts.skipMissing && missing.length) {
      const missingSet = new Set(missing);
      insertItems = insertItems.filter((it) => !missingSet.has(it));
      // 剔除后重校同文件 markerKey 冲突（保序）
      assertNoMarkerKeyConflict(insertItems, renderedEnv);
    }
    // 4. 落盘：insert-only list，rollback=false → computeInsert 见已有块(pairing===1) → 原位替换
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const list = insertItems.map(({ strategy: _s, ...rest }) => rest);
    await batchCompileHandler(
      {
        rootDir: renderedEnv.execDir,
        rollback: false,
        extraEnvData: renderedEnv,
        collectEnvData: extractAnswers(renderedEnv),
        markerNs: ns,
      },
      {
        globalEnvData: {},
        collectEnvDataForm: toTemplateForm(config.collectEnvDataForm),
        list: list as CompileTemplateConfigListItemRaw[],
      },
    );
    {
      const parts: string[] = [];
      if (skippedNonInsert > 0)
        parts.push(`跳过非 insert ${skippedNonInsert} 项`);
      if (opts.skipMissing && missing.length)
        parts.push(`跳过缺失块 ${missing.length} 项`);
      outputConsole.success(
        parts.length > 0
          ? `modify 操作完成（${parts.join("，")}）`
          : "modify 操作完成",
      );
    }
    return;
  }

  // remove：M1 dry-run 事务边界（全过才删）
  if (rollback) {
    dryRunRemovePrecheck(items, renderedEnv);
  }

  // 构造引擎 compile items：剥离 generator 私有 strategy 字段；
  // append 项 remove 路径显式置 rollbackRequireHit=true（K1，经 batchCompileHandler `...rest` 透传到第一参）。
  // 注：rollbackRequireHit/dealMarkdown 为 item 级字段，经 batch handler `...rest` 透传，
  // 形态上不在 CompileTemplateConfigListItemRaw 声明内，单点 cast 于 handler 调用边界。
  const list = items.map((item) => {
    const { strategy, ...rest } = item;
    if (rollback && strategy === "append") {
      return { ...rest, rollbackRequireHit: true };
    }
    return rest;
  });

  // 单点采集：第一参 = handler 选项（extraEnvData=已含答案+派生的 env / collectEnvData=已答）；
  // 第二参 = paramsConfig（globalEnvData 置空——已自行渲染入 extraEnvData，避免 raw `${}` 覆盖；
  // collectEnvDataForm 仍传使「仍缺必填」按交互/非交互兜底；list=编译条目）。
  await batchCompileHandler(
    {
      rootDir: env.execDir,
      rollback,
      extraEnvData: renderedEnv,
      collectEnvData: extractAnswers(renderedEnv),
      markerNs: getMarkerNs(),
    },
    {
      globalEnvData: {},
      collectEnvDataForm: toTemplateForm(config.collectEnvDataForm),
      list: list as CompileTemplateConfigListItemRaw[],
    },
  );

  // removeEmptyDir（默认 false）：remove 后实例子目录空则 rmdir
  // 修订-3：传 execDir（守卫基准）+ allowDangerous（逃逸旗标，默认 false）
  if (rollback) {
    const instanceDir = resolveInstanceDir(config, renderedEnv);
    removeEmptyInstanceDir(instanceDir, config, {
      execDir: renderedEnv.execDir,
      ...(allowDangerous !== undefined ? { allowDangerous } : {}),
    });
  }

  outputConsole.success(`${action} 操作完成`);
};
