import { ContractId } from "./ContractId.mts";
import type { ContractDraft } from "./ContractDraft.mts";

export interface ContractDraftRepository {
	nextId(): ContractId;
	get(id: ContractId): Promise<ContractDraft | null>;
	save(draft: ContractDraft): Promise<void>;
}

export class InMemoryContractDraftRepository implements ContractDraftRepository {
	private store = new Map<string, ContractDraft>();

	nextId(): ContractId {
		const created = ContractId.create(crypto.randomUUID());
		if (!created.success) throw new Error("generated contract id is empty");
		return created.value;
	}

	async get(id: ContractId) {
		return this.store.get(id.toString()) ?? null;
	}

	async save(draft: ContractDraft) {
		this.store.set(draft.id.toString(), draft);
	}
}
