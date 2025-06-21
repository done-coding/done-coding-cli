import { CheckTypeEnum, SubcommandEnum, type GitConfig } from "@/types";

const config: GitConfig = {
  [SubcommandEnum.CHECK]: {
    [CheckTypeEnum.REVERSE_MERGE]: {
      [/^test$/.source]: {
        includeRebase: true,
        logCount: 10,
        afterHash: "",
      },
    },
  },
};

export default config;
