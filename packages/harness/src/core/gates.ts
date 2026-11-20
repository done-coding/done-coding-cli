import type { DomainsSource } from "./check";
import {
  assertGitRoot,
  listWorkingFiles,
  readTrackedText,
  type WorkingFiles,
} from "./git-files";
import { createMatcher } from "./glob";
import {
  checkImports,
  createResolver,
  readPythonAll,
  type ImportsConfig,
} from "./imports";
import {
  computeOwnership,
  readOwnershipModel,
  SKELETON_HEADER,
  type OwnershipConfig,
  type OwnershipResult,
} from "./ownership";
import {
  checkSeams,
  findAnnotated,
  readGapTable,
  readSeamIds,
  SEAM_MARKER,
} from "./seams";

/** 数据驱动闸的启用方式 */
export enum GateModeEnum {
  /** 缺省：有数据就跑，无数据输出「未启用」不失败 */
  AUTO = "auto",
  /** 必须启用：无数据即失败 */
  ON = "on",
  /** 显式关闭（仍在输出中列明） */
  OFF = "off",
}

/** 代码类三闸 */
export enum CodeGateEnum {
  OWNERSHIP = "ownership",
  IMPORTS = "imports",
  SEAMS = "seams",
}

export const CODE_GATE_LABEL: Record<CodeGateEnum, string> = {
  [CodeGateEnum.OWNERSHIP]: "归属闸",
  [CodeGateEnum.IMPORTS]: "引用闸",
  [CodeGateEnum.SEAMS]: "缺口表闸",
};

export type GatesConfig = Partial<Record<CodeGateEnum, GateModeEnum>>;

/** 单闸结果 */
export interface GateReport {
  gate: CodeGateEnum;
  mode: GateModeEnum;
  /** ran = 已执行；disabled = 缺数据未启用；off = 配置关闭 */
  state: "ran" | "disabled" | "off";
  /** 未启用 / 关闭的原因，或已执行时的附注 */
  note?: string;
  errors: string[];
}

export interface CodeGatesInput {
  /** 项目根（git 根，cwd-only） */
  projectRoot: string;
  /** 治理目录绝对路径 */
  governanceRoot: string;
  domains: DomainsSource;
  gates?: GatesConfig;
  ownership?: OwnershipConfig;
  imports?: ImportsConfig;
  /** 所有闸按 on 处理（`check --strict`） */
  strict?: boolean;
}

/** 校验 gates 配置取值 */
export const validateGates = (gates: unknown): GatesConfig => {
  if (gates === undefined) return {};
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
    throw new Error("gates 须为对象");
  }
  for (const [key, value] of Object.entries(gates)) {
    if (!Object.values<string>(CodeGateEnum).includes(key)) {
      throw new Error(
        `gates.${key} 不是已知的闸（${Object.values(CodeGateEnum).join(" / ")}）`,
      );
    }
    if (!Object.values<string>(GateModeEnum).includes(value as string)) {
      throw new Error(
        `gates.${key} 须为 ${Object.values(GateModeEnum).join(" / ")}`,
      );
    }
  }
  return gates as GatesConfig;
};

/**
 * 代码类三闸：归属 → 引用（依赖归属）→ 缺口表。
 * ---
 * 「不准恒绿」：每闸先判数据在不在；缺数据时 auto 输出未启用、on / strict 判失败，
 * 输出永远逐闸列明状态，未启用不会被读成「通过」。
 */
export const runCodeGates = (input: CodeGatesInput): GateReport[] => {
  const modeOf = (gate: CodeGateEnum): GateModeEnum =>
    input.strict ? GateModeEnum.ON : (input.gates?.[gate] ?? GateModeEnum.AUTO);
  const reports: GateReport[] = [];
  const model = readOwnershipModel(input.governanceRoot, input.domains);
  let working: WorkingFiles | undefined;
  const getTracked = (): string[] => {
    if (!working) {
      assertGitRoot(input.projectRoot);
      working = listWorkingFiles(input.projectRoot);
    }
    return working.files;
  };
  /** 未跟踪的新文件也查，数量写进附注，免得读者以为只查了已 add 的 */
  const untrackedNote = (): string | undefined =>
    working?.untracked.length
      ? `含 ${working.untracked.length} 个未跟踪的新文件（未 git add，同样检查）`
      : undefined;

  /** 按模式落一份报告；缺数据 → 未启用或失败 */
  const settle = (
    gate: CodeGateEnum,
    missing: string | undefined,
    run: () => { errors: string[]; note?: string },
  ): GateReport => {
    const mode = modeOf(gate);
    if (mode === GateModeEnum.OFF) {
      return { gate, mode, state: "off", note: "配置 gates 关闭", errors: [] };
    }
    if (missing) {
      return mode === GateModeEnum.ON
        ? {
            gate,
            mode,
            state: "ran",
            errors: [`${CODE_GATE_LABEL[gate]}：要求启用但缺数据——${missing}`],
          }
        : { gate, mode, state: "disabled", note: missing, errors: [] };
    }
    return { gate, mode, state: "ran", ...run() };
  };

  const ownershipMissing = !model.hasPaths
    ? `${model.file} 领域表无 paths 列`
    : !model.skeleton
      ? `${model.file} 无共享骨架表（首列表头「${SKELETON_HEADER}」）`
      : undefined;
  let ownership: OwnershipResult | undefined;
  reports.push(
    settle(CodeGateEnum.OWNERSHIP, ownershipMissing, () => {
      ownership = computeOwnership(model, getTracked(), input.ownership);
      return { errors: ownership.errors, note: untrackedNote() };
    }),
  );

  const importsMissing = ownershipMissing
    ? `归属闸缺数据（${ownershipMissing}）`
    : !model.hasPublic
      ? `${model.file} 领域表无 public 列`
      : undefined;
  reports.push(
    settle(CodeGateEnum.IMPORTS, importsMissing, () => {
      const result =
        ownership ?? computeOwnership(model, getTracked(), input.ownership);
      const scan = createResolver(input.projectRoot, getTracked());
      const include = input.imports?.include;
      const inScope = include ? createMatcher(include) : () => true;
      const edges = result.codeFiles
        .filter((file) => inScope(file))
        .flatMap((file) => scan(file));
      const notes = [
        include &&
          `只查引用方落在 imports.include（${include.join("、")}）内的引用`,
        input.imports?.exportedNames &&
          "imports.exportedNames：跨归属 from 导入的名字须在目标 __all__ 内（没写 __all__ 的不判）",
        !model.skeleton?.hasPublic &&
          "共享骨架表无 public 列，领域 → 壳方向不设限",
      ].filter(Boolean);
      const exportedNames = input.imports?.exportedNames
        ? (file: string) => {
            const text = /\.pyi?$/.test(file)
              ? readTrackedText(input.projectRoot, file)
              : undefined;
            return text === undefined ? undefined : readPythonAll(text);
          }
        : undefined;
      return {
        errors: checkImports(edges, result, {
          tests: input.imports?.tests,
          exportedNames,
        }),
        note: notes.length ? notes.join("；") : undefined,
      };
    }),
  );

  const gap = readGapTable(input.governanceRoot);
  let annotated: string[] | undefined;
  let seamsMissing: string | undefined;
  if (!gap) {
    // 缺表但代码里已有标注：数据不一致，不能当「未启用」放过
    annotated = findAnnotated(input.projectRoot, getTrackedSafe());
    seamsMissing = annotated.length
      ? undefined
      : "SNAPSHOT.md 无「## done-coding 缺口表」";
  }
  reports.push(
    settle(CodeGateEnum.SEAMS, seamsMissing, () => {
      const files = getTracked();
      const marks = annotated ?? findAnnotated(input.projectRoot, files);
      if (!gap) {
        return {
          errors: marks.map(
            (file) =>
              `缺口表：${file} 带标注 ${SEAM_MARKER}，但 SNAPSHOT.md 无「## done-coding 缺口表」`,
          ),
        };
      }
      return {
        errors: checkSeams(gap, {
          tracked: files,
          annotated: marks,
          idsOf: (file) => readSeamIds(input.projectRoot, file),
        }),
      };
    }),
  );
  return reports;

  /** 缺表时探标注：非 git 仓（如旧式只有治理目录的夹具）视为无标注 */
  function getTrackedSafe(): string[] {
    try {
      return getTracked();
    } catch {
      return [];
    }
  }
};
