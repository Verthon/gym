import type { ContractDraft } from "./ContractDraft.mts";

export interface ContractDraftRepository {
  get(id: string): Promise<ContractDraft | null>;
  save(id: string, draft: ContractDraft): Promise<void>;
}

export class InMemoryContractDraftRepository
  implements ContractDraftRepository
{
  private store = new Map<string, ContractDraft>();
  async get(id: string) {
    return this.store.get(id) ?? null;
  }
  async save(id: string, draft: ContractDraft) {
    this.store.set(id, draft);
  }
}
