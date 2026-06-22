/**
 * [T3 骨架] @done-coding/cli-generator 完整权威类型契约（design §3.1/§3.2/§3.3/§6.4）。
 *
 * 这是 Wave B（T4 core / T5 命令面 / T6 component config）不可再改的契约：
 * 下游实现 [MUST] 以此为准，[MUST NOT] 为实现便利回改本文件的字段形状。
 * content-free 原则（L7）：本层只认 strategy / files / instanceDir，
 * [MUST NOT] 出现 component / entry / index 等业务概念。
 */
import { OutputModeEnum } from "@done-coding/cli-template";
import type {
  InsertAnchor,
  InsertMarkerComment,
} from "@done-coding/cli-template";
import type {
  HandlerContextInit,
  DoneCodingDirHit,
  DoneCodingDirLayer,
} from "@done-coding/cli-utils";

export type { InsertAnchor, InsertMarkerComment };

// ───────────────────────── 落地策略（Strategy） ─────────────────────────

/**
 * 对外落地策略联合。
 * P1 仅 create / append / replace；缺省 = create。
 * [P2] 将追加 "inject"（INSERT，锚点插入 + marker 健壮回退）——P1 [MUST NOT] 解析。
 */
export type Strategy = "create" | "append" | "replace" | "inject";

/** strategyRegistry 单条目：对外 strategy → 引擎 OutputMode 映射 + 是否支持回退（remove） */
export interface StrategyDescriptor {
  /** 映射到引擎的输出模式 */
  mode: OutputModeEnum;
  /**
   * 是否支持自动回退（remove）。
   * create → true（删文件）；append → true（命中检测后删块）；replace → false（引擎已挡，generator 再 fail-loud）。
   */
  supportsRollback: boolean;
}

/**
 * strategyRegistry 类型：对外 strategy → 描述符。
 * 表驱动扩展缝（design §10）：加 strategy = 注册一条 + （需要时）引擎加 handler。
 * P1 注册 create/append/replace 三条；[P2] inject 槽位预留，本期不注册。
 */
export type StrategyRegistry = Record<Strategy, StrategyDescriptor>;

// ───────────────────────── 文件条目（FileEntry） ─────────────────────────

/**
 * 文件条目：content-free，generator 不认识 entry/index，只认 strategy。
 * files[] 按声明顺序串行处理（design §3.1 设计取舍，操作顺序 R5ⓑ 由 config 作者掌握）。
 */
export interface FileEntry {
  /**
   * 模板源文件路径（与 inputData 二选一）。
   * 可相对、可 `${templateDir}` 绝对。
   * read 边界（M7/M8）：generator operate 预渲染后 path.resolve(templateDir, rendered)
   * 必须仍在命中的 real templateDir 内，逃出 fail-loud。
   */
  input?: string;
  /** 内联模板数据（与 input 二选一，复刻旧 entry.inputData） */
  inputData?: string;
  /**
   * 输出目标路径（与 input/inputData 配套）。
   * M8：可绝对（兼容旧 `${execDir}/...`）可相对（`./src/...`）；
   * generator operate 预渲染后 path.resolve(execDir, rendered) 必须仍在 execDir 内，越界 fail-loud。
   * 注：output 越界校验在 generator operate 预渲染**之后**做（K2）。
   */
  output?: string;
  /** 落地策略；P1 仅 create/append/replace；缺省 = create */
  strategy?: Strategy;
  /**
   * content-free 选项（H2/K3）：是否剥离 markdown code fence，透传引擎 dealMarkdown。
   * generator [MUST NOT] 写死；FileEntry 级可覆盖 BatchConfig 级；component 预设设 true（复刻 operate.ts:46）。
   */
  dealMarkdown?: boolean;
  /**
   * APPEND remove 命中检测开关（H1/K1，item 级）。
   * 经 batchCompileHandler `...rest` 透传到 compileTemplate 第一参（`CompilePublicConfig.rollbackRequireHit`）。
   * generator 对 strategy=append 项的 remove 路径**显式置 true**；
   * component 兼容路径**不置**（保逐字节，design §5/L4）。
   */
  rollbackRequireHit?: boolean;
  /**
   * content-free 回退选项（透传引擎，FileEntry 级覆盖 BatchConfig 级）：
   * 回滚后文件为空时是否删除（rollbackDelNullFile）/ 回滚删除是否免交互确认（rollbackDelAskAsYes）。
   * 复刻旧 component operate.ts 每项 publicOptions 写死 true 的行为；
   * 非交互 remove 缺 rollbackDelAskAsYes=true 会触发引擎"需确认删除"分支抛错。component 预设设 true。
   */
  rollbackDelNullFile?: boolean;
  rollbackDelAskAsYes?: boolean;
  /**
   * [inject 专用] 锚点定位（pattern 支持 `${}`，operate 交引擎前预渲染）。
   * inject 策略 [MUST] 提供（已存在同 markerKey 块的幂等更新除外）；其余策略忽略。
   */
  anchor?: InsertAnchor;
  /**
   * [inject 专用] marker 身份键（支持 `${}`）。
   * 缺省 = operate 内部计算的 `${批次类型}:${name}`（design §12 A3，不经 env 暴露 __batchType）。
   * 文件内 marker = `<open> === dc-gen:start:<markerKey> === <close>` / `...:end:...`，回退按此精确定位，免疫块内手改。
   */
  markerKey?: string;
  /** [inject 可选] 覆盖语言感知注释样式（未知扩展名时必填，design §2.2） */
  markerComment?: InsertMarkerComment;
}

// ───────────────────────── list 序列化（两套 DTO，K5/H4） ─────────────────────────

/**
 * 批次实例 list 序列化配置（H4/K5）：content-free，由各批次预设声明。
 * component 预设声明 component 兼容形状（复刻 list.ts:80-113）。
 * [MUST NOT] 与 dc-gen 发现 list DTO（DiscoveredBatchListItem）互相复用。
 */
export interface ListSerializerConfig {
  /** 严格字段序（component 兼容 = ["name","nameKebab","fullName"]） */
  fields: string[];
  /** 是否排序；component 兼容 = false（复刻 readdir 原序，不排序） */
  sort?: boolean;
  /** JSON.stringify 缩进；component 兼容 = 2 */
  indent?: number;
  /** 输出路径 resolve 基准；component 兼容 = "cwd"（path.resolve(outputPath) 按 cwd） */
  pathResolveBase?: "cwd" | "execDir";
}

/**
 * 批次实例 list 单项 DTO（①批次实例 list）。
 * 字段集由 ListSerializerConfig.fields 声明，故为开放映射（content-free）。
 */
export type BatchInstanceListItem = Record<string, unknown>;

/**
 * dc-gen 发现 list 单项 DTO（②通用 `dc-gen list [type]`，design §4.1/§6.4）。
 * [MUST NOT] 复用 ListSerializerConfig 结构、[MUST NOT] 写进 component-name-list.json。
 */
export interface DiscoveredBatchListItem {
  /** 批次实例名 / 批次类型名 */
  name: string;
  /** 来源批次类型（segment） */
  source: string;
  /** 命中层级 */
  layer: DoneCodingDirLayer;
  /** 是否被更近层同名批次遮蔽 */
  shadowed: boolean;
  /** M1：该目录非法（缺 index.json / config 不可解析等），不应被当作正常批次 */
  invalid?: boolean;
  /** M1：非法原因聚合（仅 invalid 时存在），供命令面输出，不静默吞 */
  errors?: string[];
}

// ───────────────────────── 参数采集（复用 cli-template 级联） ─────────────────────────

/**
 * collectEnvDataForm 单项（复刻 cli-template 的 collectEnvDataForm 表单项形态）。
 * initial 可引用前序已答变量（`${}` 渲染、有序累积、fail-fast）——直接继承 batchCompileHandler。
 * 形状以 cli-template 实际表单项为准；此处为 generator 消费侧的最小契约。
 */
export interface CollectFormItem {
  /** 变量名（采集结果挂到 envData 此键） */
  name: string;
  /** 提示文案 */
  message?: string;
  /** 默认值；可为引用前序答案的 `${}` 模板字符串（initial 级联） */
  initial?: unknown;
  /** 表单类型（text/select/... 由 cli-template 决定） */
  type?: string;
  /** 候选项（select 等） */
  choices?: unknown;
  /** 其它透传字段 */
  [k: string]: unknown;
}

// ───────────────────────── 批次 config（BatchConfig，层三声明式） ─────────────────────────

/**
 * 批次 config（json5）：generator content-free 模型（design §3.1）。
 * 旧 component config（componentDir/list[{entry,index}]/series/nameListJsonOutputPath）
 * 机械迁移到此形态（design §6.1 映射表，由 T6 完成）。
 */
export interface BatchConfig {
  /**
   * 实例落地目录（可配，相对 / 含 `${execDir}` / 含 `${nameKebab}` 等变量）。
   * 查重 & remove 基于它（R4①）。component 兼容 = `${execDir}/src/components/${nameKebab}`。
   */
  instanceDir: string;
  /**
   * 删除时若实例子目录为空是否删除，默认 false（R4④；component 预设设 true，复刻 remove.ts:65 rmdirSync）。
   */
  removeEmptyDir?: boolean;
  /**
   * list 枚举方式（R4②）：扫子目录 / 不提供。component 预设 = { mode:"subdir", nameExcludes:["index"] }。
   */
  list?: {
    mode: "subdir" | "none";
    /** 扫子目录时排除的名称 */
    nameExcludes?: string[];
  };
  /**
   * 批次级 dealMarkdown 默认（H2/K3，可被 FileEntry.dealMarkdown 覆盖）；component 预设设 true。
   */
  dealMarkdown?: boolean;
  /**
   * 批次级回退选项默认（content-free，可被 FileEntry 覆盖）；component 预设设 true
   * （复刻旧 operate.ts 每项 rollbackDelNullFile:true / rollbackDelAskAsYes:true）。
   * 非交互 remove 须 rollbackDelAskAsYes=true 免触发引擎"需确认删除"分支。
   */
  rollbackDelNullFile?: boolean;
  rollbackDelAskAsYes?: boolean;
  /**
   * 是否允许批次模板目录为软链 / 位于 cwd 外（M7），默认 true。
   * 全局 / 父层模板本就在 cwd 外，合法。
   */
  allowSymlinkTemplateDir?: boolean;
  /** 名称排除 / 保留（沿用 ensureNameLegal 的 nameExcludes 语义，R2） */
  nameExcludes?: string[];
  /**
   * 复用 cli-template 的级联采集（initial 可引用前序答案，R3③）。
   * 元素可为完整表单项或字符串简写（由 cli-template 决定）。
   */
  collectEnvDataForm?: (CollectFormItem | string)[];
  /**
   * 全局环境变量（声明式派生变量在此用 `${_.x(...)}` 表达，R3③）。
   * component 预设在此声明 series/fullName/fullNameKebab/cls。
   */
  globalEnvData?: Record<string, unknown>;
  /**
   * 文件条目数组（替代旧 list[{entry,index}]，扁平 content-free）。
   * 按声明顺序串行处理（design §3.1 设计取舍）。
   */
  files: FileEntry[];
  /**
   * 批次实例 list 序列化形状（H4/K5，content-free）；component 预设声明 component 兼容形状（design §6.4）。
   */
  listSerializer?: ListSerializerConfig;
  /**
   * list -o 输出 json 相对路径（兼容旧 nameListJsonOutputPath；按 cwd path.resolve，H4/§6）。
   */
  nameListJsonOutputPath?: string;
}

// ───────────────────────── 变量上下文（EnvContext，R3/§3.3） ─────────────────────────

/**
 * helper 命名空间（lodash 子集，挂 `_.`，不污染裸变量空间）。
 * 白名单 = camelCase/kebabCase/upperFirst/lowerFirst/pascalCase（K6/§12-Ⓓ）。
 * pascalCase = `upperFirst(camelCase(x))` 组合实现，**零新增 lodash 子包**。
 * [MUST NOT] 含 snakeCase / startCase（否则需新增 lodash.snakecase/startcase）。
 */
export interface EnvHelperNamespace {
  camelCase: (value?: string) => string;
  kebabCase: (value?: string) => string;
  upperFirst: (value?: string) => string;
  lowerFirst: (value?: string) => string;
  /** pascalCase = upperFirst(camelCase(x))，组合实现，无 nameSnake/snakeCase */
  pascalCase: (value?: string) => string;
}

/**
 * 变量上下文（R3）：内建 canonical 集 + helper 命名空间 + 批次声明式派生。
 * canonical 集**无 nameSnake**（Ⓐ/M4）。`name` = PascalCase（非 rawName 原样，K8/M5）。
 * 此对象即喂给 lodash.template 的 envData（helper 挂在 `_` 键）。
 */
export interface EnvContext {
  // ── 内建 canonical 集（全部从 rawName 派生，design §3.3 表） ──
  /** canonical：upperFirst(camelCase(rawName))（= PascalCase）。非原始输入（M5） */
  name: string;
  /** == name（PascalCase 别名，便于 config 表达） */
  namePascal: string;
  /** camelCase(rawName) */
  nameCamel: string;
  /** lowerFirst(upperFirst(camelCase(rawName))) = camelCase */
  nameLowerFirst: string;
  /** kebabCase(rawName) */
  nameKebab: string;
  /** 内建保留键（M5）：ensureNameLegal 后原始用户输入字面量；component 预设不引用（逐字节不受影响） */
  rawName: string;
  /** 字面 "$"（转义 lodash.template 插值） */
  $: "$";
  /** 实例落地根 = safeCwd()，永远当前项目，与模板来自哪层无关（L5） */
  execDir: string;
  /** dir-resolver 命中的批次模板目录绝对路径 */
  templateDir: string;

  // ── helper 命名空间 ──
  /** lodash 子集 helper（K6，零新增 lodash 子包） */
  _: EnvHelperNamespace;

  // ── 批次声明式派生变量（series/cls/fullName… 由 config globalEnvData 注入，非内建） ──
  [k: string]: unknown;
}

// ───────────────────────── handler 签名契约（NFR-1 P1，server-agnostic） ─────────────────────────

/**
 * handler 通用 argv（yargs 解析结果的最小契约）。
 * 具体字段由各 handler 在 T5 细化；server-agnostic（cli/mcp/test 三模式统一）。
 */
export interface GeneratorHandlerArgv {
  /** 批次类型（dc-gen <type> ...）；list 无 type 时可缺省 */
  type?: string;
  /** 实例名（add/remove <name>） */
  name?: string;
  /** 非交互供答（--env JSON 字符串） */
  env?: string;
  /** 非交互供答（--envFile 路径） */
  envFile?: string;
  /** add 探针：仅回问题清单不落地（复用 create listTemplateQuestions 范式，Ⓔ） */
  listQuestions?: boolean;
  /** init --global：写 ~/.done-coding 而非 cwd */
  global?: boolean;
  /** list -o：实例 list 序列化输出路径 */
  output?: string;
  /** remove 显式放行 removeEmptyInstanceDir 可疑根守卫（修订-3） */
  allowDangerous?: boolean;
  /** modify --skip-missing：跳过不存在的 marker 块（块级），改其余（T5） */
  skipMissing?: boolean;
  /** 其它透传 */
  [k: string]: unknown;
}

/**
 * generator handler 签名（NFR-1 P1 契约，K1/§7）。
 * 所有命令 handler 形如 `(argv, ctxInit?) => Promise<...>`：
 * 内部用 cli-utils `resolveHandlerContext(ctxInit)` 走三模式（cli/mcp/test）；
 * 非交互缺必填 → fail-fast。server-agnostic：P1 [MUST NOT] 接 MCP server / cli-skills（P3）。
 */
export type GeneratorHandler<R = void> = (
  argv: GeneratorHandlerArgv,
  ctxInit?: HandlerContextInit,
) => Promise<R>;

// ───────────────────────── 内部原语契约（供 T4 core / assemble[P4a] 复用） ─────────────────────────

/**
 * 批次解析结果（batch-discovery 产出 + config 读取后的聚合）。
 * 供 operate / handlers 消费，也供 [P4a] assemble 复用（design §10）。
 */
export interface ResolvedBatch {
  /** 批次类型名 */
  type: string;
  /** dir-resolver 命中结果（含 dir/realDir/namespaceDir/layer/shadowed/errors，K9） */
  hit: DoneCodingDirHit;
  /** 解析后的批次 config（json5.parse(config.json5) 结果） */
  config: BatchConfig;
}

/** operate 操作类型（content-free，与命令面解耦，供 [P4a] assemble 复用） */
export type OperateAction = "add" | "remove" | "modify";

/** operate 入参（接收"批次解析结果 + 操作类型 + envData"，不耦合命令面，design §10/K2） */
export interface OperateOptions {
  /** 操作类型 */
  action: OperateAction;
  /** 批次解析结果 */
  batch: ResolvedBatch;
  /** 渲染上下文（内建 canonical + helper + 派生） */
  env: EnvContext;
  /** 显式放行 removeEmptyInstanceDir 可疑根守卫（修订-3，默认 false） */
  allowDangerous?: boolean;
  /**
   * modify 专用：缺失 marker 块时跳过该项而非整体中止（默认 false=原子中止）。
   * skipMissing=true 时，存在块照改，缺失块静默跳过。
   */
  skipMissing?: boolean;
}
