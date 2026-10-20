import type { ActiveContract } from "./ActiveContract.mts";
import type { ActiveContractId } from "./ActiveContractId.mts";

export interface ActiveContractRepository {
  get(id: ActiveContractId): Promise<ActiveContract | null>;
  save(contract: ActiveContract): Promise<void>;
}

export class InMemoryActiveContractRepository implements ActiveContractRepository {
  private store = new Map<string, ActiveContract>();

  async get(id: ActiveContractId) {
    return this.store.get(id.toString()) ?? null;
  }

  async save(contract: ActiveContract) {
    this.store.set(contract.id.toString(), contract);
  }
}
