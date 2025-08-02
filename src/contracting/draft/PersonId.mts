export type PersonIdError =
	| { code: "EMPTY" }
	| { code: "TOO_SHORT"; context: { value: string } };

export class PersonId {
	private readonly value: string;

	private constructor(value: string) {
		this.value = value;
	}

	static create(
		input: string | null | undefined
	):
		| { success: true; value: PersonId }
		| { success: false; error: PersonIdError } {
		if (!input) return { success: false, error: { code: "EMPTY" } };
		const v = input.trim();
		if (v.length < 3)
			return {
				success: false,
				error: { code: "TOO_SHORT", context: { value: input } },
			};
		return { success: true, value: new PersonId(v) };
	}

	public equals(other: PersonId): boolean {
		return this.value === other.value;
	}

	public toString(): string {
		return this.value;
	}
}
