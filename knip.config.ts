import type { KnipConfig } from "knip";

const config: KnipConfig = {
  vitest: true,
  ignore: [
    "src/contracting/draft/ContractDraftRepository.mts",
    "src/contracting/draft/ContractDraftService.mts",
  ],
};

export default config;
