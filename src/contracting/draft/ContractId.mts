import { err, ok, type Result } from "#/utils/Result.mts";

export type ContractIdError = { code: "EMPTY" };

export class ContractId {
	private readonly value: string;

	private constructor(value: string) {
		this.value = value;
	}

	static create(input: string | null | undefined): Result<ContractId, ContractIdError> {
		const v = input?.trim();
		if (!v) return err({ code: "EMPTY" });
		return ok(new ContractId(v));
	}

	public equals(other: ContractId): boolean {
		return this.value === other.value;
	}

	public toString(): string {
		return this.value;
	}
}
