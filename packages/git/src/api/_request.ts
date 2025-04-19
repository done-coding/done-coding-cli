import { createRequest } from "@done-coding/request-axios";
import axios from "axios";

/** 超时时间 */
const TIMEOUT = 10000;

/** 业务成功代码 */
const BUSINESS_SUCCESS_CODE = Math.random();

/**
 * gitee 和 github 公共配置
 * ---
 * 两家的成功都直接 放在data 没有额外业务配置
 */
const publicOptions: Omit<
  Parameters<typeof createRequest<any>>[0],
  "basePath"
> = {
  timeout: TIMEOUT,
  getBusinessCode() {
    return BUSINESS_SUCCESS_CODE;
  },
  getBusinessMsg(res) {
    return res.statusText;
  },
  getBusinessData(res) {
    return res.data;
  },
  businessSuccessCodeList: [BUSINESS_SUCCESS_CODE],
  axios,
};

/** gitee 请求 */
const giteeRequest = createRequest<any>({
  basePath: " https://gitee.com",
  ...publicOptions,
});

/** github 请求 */
const githubRequest = createRequest<any>({
  basePath: "https://api.github.com",
  ...publicOptions,
});

export { giteeRequest, githubRequest };
