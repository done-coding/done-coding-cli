import _upperFirst from "lodash.upperfirst";
import _camelCase from "lodash.camelcase";
import _kebabCase from "lodash.kebabcase";
import _lowerFirst from "lodash.lowerfirst";
import path from "node:path";
import type { Config, CommonOptions } from "@/types";
import injectInfo from "@/injectInfo.json";
const { namespaceDir, moduleName } = injectInfo.cliConfig;

/** 获取模板目录绝对路径 */
export const getTemplateDirAbsolutePath = () => {
  return path.resolve(namespaceDir, moduleName);
};

/** 路径环境变量 */
export interface PathEnvData {
  /** 执行命令的目录绝对路径 */
  execDir: string;
  /** 模板目录绝对路径 */
  templateDir: string;
}

/** 获取路径环境变量 */
export const getPathEnvData = () => {
  return {
    execDir: process.cwd(),
    templateDir: getTemplateDirAbsolutePath(),
  };
};

/** 组件环境变量 */
export interface ComponentEnvData {
  /** 矫正后的组件系列 */
  series: string;
  /** 矫正后的组件名 */
  name: string;
  /** 矫正后的组件名小写开头 */
  nameLowerFirst: string;
  /** 小写连接的组件名 */
  nameKebab: string;
  /** 矫正后的带系列组件名 */
  fullName: string;
  /** 矫正后的带系列小写连接的组件名 */
  fullNameKebab: string;
  /** 组件类名 */
  cls: string;
}

/** 获取环境变量 */
export const getComponentEnvData = (
  data: Required<Pick<Config, "series"> & Pick<CommonOptions, "name">>,
): ComponentEnvData => {
  const { series: seriesInit, name: nameInit } = data;

  /** 矫正后的组件名 */
  const name = _upperFirst(_camelCase(nameInit));
  /** 矫正后的组件名小写开头 */
  const nameLowerFirst = _lowerFirst(name);
  /** 小写连接的组件名 */
  const nameKebab = _kebabCase(name);
  /** 矫正后的组件系列 */
  const series = seriesInit ? _upperFirst(_camelCase(seriesInit)) : "";
  /** 矫正后的带系列组件名 */
  const fullName = series ? `${series}${name}` : "";
  /** 矫正后的带系列小写连接的组件名 */
  const fullNameKebab = _kebabCase(fullName);

  const res: ComponentEnvData = {
    series,
    name,
    nameLowerFirst,
    nameKebab,
    fullName,
    fullNameKebab,
    cls: fullNameKebab,
  };

  return res;
};

/** 环境变量 */
export interface EnvData extends PathEnvData, ComponentEnvData {
  /** 转义的$ */
  $: "$";
}

/** 获取环境变量 */
export const getEnvData = (
  data: Required<Pick<Config, "series"> & Pick<CommonOptions, "name">>,
): EnvData => {
  const res: EnvData = {
    $: "$",
    ...getPathEnvData(),
    ...getComponentEnvData(data),
  };

  return res;
};
