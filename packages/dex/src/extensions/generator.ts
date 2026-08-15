/* eslint-disable max-params -- execute 签名 5 参是 coding-agent ToolDefinition 接口约定，不可改 */
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  addHandler,
  buildBatchQuestions,
  discoverBatch,
  listDiscoveredBatches,
} from "@done-coding/cli-generator";
import type { HandlerContextInit } from "@done-coding/cli-utils";

/**
 * done-coding 工具扩展（dc-generator 三工具）。
 *
 * 以 coding-agent extension 形态注入（extensionFactories），复用
 * @done-coding/cli-generator 的 server-agnostic handler；cwd 用扩展上下文 ctx.cwd。
 * 镜像 cli-mcp/src/handlers/generator.ts 的工具面（list/list_questions/add）。
 */

/** 结构化结果 → AgentToolResult（text block + 空 details） */
const toTextResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  details: {},
});

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "done_coding_gen_list_batches",
    label: "List dc-generator batches",
    description:
      "列出当前项目可达的 dc-generator 批次类型（.done-coding/<type>/ 项目 → 逐级父 → 全局 ~/.done-coding）。" +
      "返回 [{name, layer, shadowed, invalid?, errors?}]；invalid:true 的批次不可用，勿作为生成目标。rootDir 可选，缺省为当前工作目录。",
    parameters: Type.Object({ rootDir: Type.Optional(Type.String()) }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      const items = listDiscoveredBatches("*", {
        cwd: params.rootDir ?? ctx.cwd,
      });
      return toTextResult(items);
    },
  });

  pi.registerTool({
    name: "done_coding_gen_list_questions",
    label: "List dc-generator batch questions",
    description:
      "探测一个 dc-generator 批次需要哪些答案（不生成实例）。返回 [{key, required, default?}]。" +
      "type 必填（批次类型名），rootDir 可选，缺省为当前工作目录。",
    parameters: Type.Object({
      rootDir: Type.Optional(Type.String()),
      type: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      if (!params.type) {
        throw new Error("list_questions 缺少必填参数 type");
      }
      const batch = discoverBatch(params.type, {
        cwd: params.rootDir ?? ctx.cwd,
      });
      return toTextResult(buildBatchQuestions(batch.config));
    },
  });

  pi.registerTool({
    name: "done_coding_gen_add",
    label: "Add dc-generator batch instance",
    description:
      "非交互新增一个 dc-generator 批次实例。type/name 必填；envData 为结构化答案对象（key 需对齐 list_questions 返回的 key）。" +
      "rootDir 可选，缺省为当前工作目录。",
    parameters: Type.Object({
      rootDir: Type.Optional(Type.String()),
      type: Type.String(),
      name: Type.String(),
      envData: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      if (!params.type || !params.name) {
        throw new Error("add 缺少必填参数 type/name");
      }
      const ctxInit: HandlerContextInit = {
        mode: "mcp",
        interactive: false,
        cwd: params.rootDir ?? ctx.cwd,
      };
      await addHandler(
        {
          type: params.type,
          name: params.name,
          env: params.envData ? JSON.stringify(params.envData) : undefined,
        },
        ctxInit,
      );
      return toTextResult({
        status: "ok",
        action: "add",
        type: params.type,
        name: params.name,
      });
    },
  });
}
