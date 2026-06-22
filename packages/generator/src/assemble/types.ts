/**
 * @done-coding/cli-generator · assemble 层权威类型契约（design-p4a §3/§4 + §14 amendments）。
 *
 * 这是 assemble 各模块（recipe/registry/vfs/planner/engine/ops）不可再改的契约：
 * 实施 [MUST] 以此为准，[MUST NOT] 为实现便利各自造型。
 *
 * 边界（design §11 / §14）：
 *  - assemble 是 cli-generator 独立层；[MUST NOT] 改 cli-template / gen 运行时 / create 源码。
 *  - 渲染复用 lodash.template；文本插入/移除复用 P2 marker 纯函数；
 *    读取由 assemble throw-only readFragment 承担（D-H6，不直接调会 process.exit 的 getData）。
 */
import type {
  InsertAnchor,
  InsertMarkerComment,
} from "@done-coding/cli-template";

export type { InsertAnchor, InsertMarkerComment };

// ───────────────────────── 配方（Recipe，§3.1 / D-H7 / D-H4） ─────────────────────────

/** 基底：拼装 = empty（空树叠加）；裁剪 = dir（载入成品做减法，D-M7 exclude） */
export type RecipeBase =
  | { kind: "empty" }
  | { kind: "dir"; from: string; exclude?: string[] };

/** create templateList 最小同步声明（D-H4，可选；声明则 build 后 upsert） */
export interface CreateTemplateSync {
  /** 目标 create config json 路径（相对 cwd） */
  configPath: string;
  /** templateList 项名（upsert 主键） */
  name: string;
  /** 可选描述 */
  description?: string;
}

/** 配方（JSON5 文件 → 此对象，D-L1） */
export interface Recipe {
  /** 产物稳定 id（provenance 根 / manifest 键，配方内唯一） */
  id: string;
  /** 基底（拼装 empty / 裁剪 dir） */
  base: RecipeBase;
  /** 物化产物落地目录（相对 cwd，入版控，create 可消费） */
  output: string;
  /** 渲染变量（喂 lodash.template；helper 挂 `_`，见 render.ts） */
  vars?: Record<string, unknown>;
  /** 有序 op 列表（[MUST] 按声明顺序执行，D-H5 顺序模拟） */
  ops: AssembleOp[];
  /** create templateList 同步声明（D-H4，可选） */
  createTemplate?: CreateTemplateSync;
}

// ───────────────────────── op 模型（§4.1 / D-H3 / D-M5） ─────────────────────────

/** op 公共契约——所有子类型 + 未来扩展 op 共享 */
export interface AssembleOpBase {
  /** registry 键（内建 5 种 + 未来扩展） */
  type: string;
  /** provenance：配方内唯一稳定标识 */
  id: string;
  /** 原料引用（fragment 相对 fragmentRoot）；删类 op 可空 */
  source?: string;
  /** 目标文件/目录（产物相对路径） */
  target: string;
}

/** 内建 op：addFragment（whole-file，D-H7 边界字段 / D-M5 ifExists） */
export interface AddFragmentOp extends AssembleOpBase {
  type: "addFragment";
  source: string;
  /** glob 过滤源（落位前筛选，A1/D-H7） */
  include?: string[];
  exclude?: string[];
  /** 源→目标重命名映射（D-H7） */
  rename?: Record<string, string>;
  /** 权限位：保留源 mode / 指定（D-H7） */
  mode?: "preserve" | number;
  /** 软链策略（D-H7） */
  symlinkPolicy?: "preserve" | "deref" | "skip";
  /** 空目录策略（D-H7） */
  emptyDirPolicy?: "keep" | "skip";
  /** 目标已存在时：报错 / 保留既有（D-M5，替代通用 skip） */
  ifExists?: "error" | "keep";
}

/** 内建 op：textPatch（text 族，复用 P2 marker；D-M4 锚点多命中默认 fail） */
export interface TextPatchOp extends AssembleOpBase {
  type: "textPatch";
  source: string;
  /** 锚点定位（pattern 支持 `${}`，正向插入需提供） */
  anchor?: InsertAnchor;
  /** marker 身份键（缺省 = op.id；支持 `${}`） */
  markerKey?: string;
  /** 覆盖语言感知注释（未知扩展名必填） */
  markerComment?: InsertMarkerComment;
  /** 锚点多命中降级：仅显式 "first" 才取首个，否则 assemble 层 fail（D-M4） */
  anchorMatch?: "first";
  /** 正向插入 / 反向移除（裁剪）；缺省 insert */
  direction?: "insert" | "remove";
}

/** 内建 op：jsonMerge（structured 族，A2 算法；D-H8 字段策略） */
export interface JsonMergeOp extends AssembleOpBase {
  type: "jsonMerge";
  source: string;
  /** 按 JSON Pointer 覆盖缺省字段策略（A-NFR-4 口，D-H8） */
  fieldPolicy?: Record<string, "union" | "replace" | "error">;
}

/** 内建 op：deleteFile（裁剪，D-H5 顺序模拟） */
export interface DeleteFileOp extends AssembleOpBase {
  type: "deleteFile";
  /** 同文件先写后删：默认 fail；显式 true 才允许丢弃前序贡献（D-H5） */
  allowDiscard?: boolean;
}

/** 内建 op：deleteField（structured 裁剪，json-pointer omit） */
export interface DeleteFieldOp extends AssembleOpBase {
  type: "deleteField";
  /** RFC 6901 JSON Pointer；不存在 fail（D-H5/C5） */
  pointer: string;
}

/** 内建 op 联合（窄化用）；扩展 op 走 AssembleOpBase 泛型 */
export type BuiltinAssembleOp =
  | AddFragmentOp
  | TextPatchOp
  | JsonMergeOp
  | DeleteFileOp
  | DeleteFieldOp;

/** op 通用形态（含扩展 op；handler 内部自行窄化字段） */
export type AssembleOp = AssembleOpBase & Record<string, unknown>;

// ───────────────────────── op handler / registry（§4.2 / D-H3） ─────────────────────────

/**
 * op 对目标产生的效果声明（planner 据此判冲突/顺序，[MUST NOT] 认死 family）。
 * kind 内建：write-whole / patch-region / merge-structured / delete-file / delete-field；
 * 扩展 op 可声明新 kind（如 move/chmod），engine/planner 零改（A-NFR-4）。
 */
export type EffectKind =
  | "write-whole"
  | "patch-region"
  | "merge-structured"
  | "delete-file"
  | "delete-field"
  | string;

/**
 * 单条效果：作用目标 + 效果种类 + 自描述元数据（planner 据此通用判冲突/顺序，
 * [MUST NOT] 在 planner 硬编码 kind 集合——新增 op 声明 category/标志即参与，engine/planner 零改，D-H3/A-NFR-4）。
 *
 * planner 通用规则（不认死具体 kind）：
 *  - 「整文件替换」基层（`replacesWhole:true`，如 addFragment）不解释文件格式，与至多一个
 *    格式编辑模型可叠加（先铺底再编辑）；它**不计入**下面的「混族不同 kind」互斥判定。
 *  - 在**非 replacesWhole** 的 `category:"content-model"` 效果里：同 target 出现 ≥2 个 **kind 不同**
 *    （如 patch-region 文本 + merge-structured json）→ 混族 fail-fast（两种格式编辑模型不可共存同文件）；
 *  - 同 target 同 `category:"content-model"` 同 kind 但 **conflictKey 不同** → 允许（如多 textPatch 不同 markerKey）；
 *  - 同 target 同 conflictKey 重复 → fail；
 *  - `removesTarget` 参与 deleteFile 顺序模拟；`createsTarget` 标记首次落盘；
 *  - `category:"metadata"`（delete-field 字段裁剪 / 未来 chmod/rename）不与 content 互斥（与任意格式模型叠加）。
 */
export interface TargetEffect {
  target: string;
  kind: EffectKind;
  /** 冲突分类：content-model 内容写入（同 target 多种内容族互斥）/ delete 删除 / metadata 非互斥元数据 */
  category: "content-model" | "delete" | "metadata";
  /** 细粒度冲突键（如 markerKey / JSON Pointer）；同 target 同 conflictKey 重复 = 冲突 */
  conflictKey?: string;
  /** 是否创建目标（首次 write-whole/merge）——顺序模拟用 */
  createsTarget?: boolean;
  /** 是否移除目标（delete-file）——顺序模拟用 */
  removesTarget?: boolean;
  /**
   * 是否「整文件替换」基层（不解释既有格式，直接铺底，如 addFragment write-whole）。
   * true 时不计入「混族不同 kind」互斥——基层可与至多一个格式编辑模型（json/text…）叠加（先铺再编）。
   */
  replacesWhole?: boolean;
}

/** 冲突一侧来源（provenance，D-L4 segment 级） */
export interface ConflictSide {
  opId: string;
  source?: string;
}

/** 冲突模型（fail-loud 报错载体，A3④ / D-L4） */
export interface Conflict {
  recipeId: string;
  /** 目标产物相对路径 */
  file: string;
  /** 细粒度定位：JSON Pointer 或 marker key（D-L4） */
  locator?: string;
  /** 参与冲突的两侧来源 */
  sides: ConflictSide[];
  message: string;
}

/** op 执行结果 */
export interface OpResult {
  changed: boolean;
  conflicts: Conflict[];
}

/** 计划期上下文（只读校验，[MUST NOT] 碰真实 fs） */
export interface PlanContext {
  vfs: Vfs;
  recipe: Recipe;
  /** 碎片根绝对路径（readFragment 越界基准） */
  fragmentRoot: string;
}

/** 执行期上下文（= 计划期 + 渲染/读取能力） */
export interface OpContext extends PlanContext {
  /** lodash.template 渲染（含 `_.` helper），D-H6 */
  render: (tpl: string) => string;
  /** throw-only 文本碎片读取（越界 throw + fence 剥离），D-H6 */
  readFragment: (rel: string) => string;
  /** throw-only 原始二进制碎片读取（越界 throw，不解码），M1 */
  readFragmentBuffer: (rel: string) => Buffer;
}

/** op handler 契约（能力声明式，D-H3） */
export interface OpHandler {
  /** 声明本 op 对目标的效果（planner 据此判冲突/顺序） */
  effects: (op: AssembleOp) => TargetEffect[];
  /** 计划期纯校验（越界/字段/删不存在）；throw = fail-loud */
  preflight?: (ctx: PlanContext, op: AssembleOp) => void;
  /**
   * 计划期"模拟落地"预检（M3）：在模拟 VFS 上**纯读 fragment dry-run**，
   * 提前暴露 jsonMerge 冲突 / whole-file 同 target 覆盖等本会延迟到 build 才 throw 的失败。
   * [MUST] 只读校验，[MUST NOT] 真改模拟态 / 碰真实 fs（与 apply 区分：apply 落 VFS）。
   * 需要渲染/读 fragment，故收 OpContext。throw = fail-loud。
   */
  preflightApply?: (ctx: OpContext, op: AssembleOp) => void;
  /** 执行：作用于 VFS；[MUST NOT] 碰真实 fs（统一原子 flush） */
  apply: (ctx: OpContext, op: AssembleOp) => OpResult;
}

// ───────────────────────── VFS（§4.4 / D-H2 / D-H7 / D-M3） ─────────────────────────

export type VfsNodeKind = "file" | "dir" | "symlink";

/** 写入溯源（D-L4） */
export interface WriteProvenance {
  lastOpId: string;
  contributingOpIds: string[];
}

/** VFS 节点（带元数据，D-H2/D-H7：mode/symlink/空目录纳入比对） */
export interface VfsNode {
  kind: VfsNodeKind;
  /** file：内容 */
  content?: Buffer;
  /** 权限位（可执行等，D-H7） */
  mode?: number;
  /** symlink：目标 */
  linkTarget?: string;
  provenance: WriteProvenance;
}

/** 内存虚拟文件树契约（实现见 vfs.ts；ops 经此读写） */
export interface Vfs {
  has: (path: string) => boolean;
  get: (path: string) => VfsNode | undefined;
  /** 写文件节点（记 provenance） */
  setFile: (
    path: string,
    content: Buffer,
    opId: string,
    opts?: { mode?: number },
  ) => void;
  /** 写目录 / 软链节点 */
  setNode: (path: string, node: VfsNode) => void;
  /** 删除节点（返回是否命中；deleteFile 顺序语义在 op 层判，D-H5） */
  delete: (path: string) => boolean;
  /** 全部路径（字典序，确定性遍历） */
  paths: () => string[];
}

// ───────────────────────── manifest（D-L2 / D-H1） ─────────────────────────

/** 生成清单（落 .assemble/manifests/<recipeId>.json，output 外，入版控） */
export interface AssembleManifest {
  recipeId: string;
  output: string;
  /** 上次生成文件清单（相对 output，字典序）——D-H1 安全删除依据 */
  files: string[];
}

// ───────────────────────── 命令选项（§2 / D-M1 / D-M8） ─────────────────────────

export type AssembleAction = "plan" | "build" | "diff" | "check";

/** diff/check 比对基准（D-M8） */
export type DiffAgainst = "worktree" | "head" | "index";

/** assemble handler argv（server-agnostic，对齐 gen K1） */
export interface AssembleHandlerArgv {
  /** 子命令动作（真子命令，D-M1） */
  action?: AssembleAction;
  /** 指定配方路径（覆盖约定 recipeDir） */
  recipe?: string;
  /** 批量跑 recipeDir 下全部配方（D-M6 output 冲突校验） */
  all?: boolean;
  /** diff/check 临时落盘根，缺省 os.tmpdir() */
  outDir?: string;
  /** diff/check 比对基准（D-M8） */
  against?: DiffAgainst;
  /** 全量清空 output（含 untracked，需工作树 clean / allowUntrackedDelete，D-H1） */
  forceClean?: boolean;
  allowUntrackedDelete?: boolean;
  /** 显式放行可疑根（家目录本体 / 文件系统根）下 build，修订-1 R1③ */
  allowDangerous?: boolean;
  /** 机器可读输出（stdout 洁净，对齐 P3 B5） */
  json?: boolean;
  [k: string]: unknown;
}
