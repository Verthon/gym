import type { ContractDraft } from "./ContractDraft.mjs";

export interface ContractDraftRepository {
  get(id: string): Promise<ContractDraft | null>;
  save(
    id: string,
    draft: ContractDraft,
    expectedVersion?: number
  ): Promise<void>;
}

export class InMemoryContractDraftRepository
  implements ContractDraftRepository
{
  private store = new Map<string, { agg: ContractDraft; version: number }>();
  async get(id: string) {
    return this.store.get(id)?.agg ?? null;
  }
  async save(id: string, draft: ContractDraft, expectedVersion?: number) {
    const v = this.store.get(id)?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== v)
      throw new Error("CONCURRENCY");
    this.store.set(id, { agg: draft, version: v + 1 });
  }
}
