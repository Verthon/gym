import { err, ok, type Result } from "#/utils/Result.mts";

export type PersonIdError =
	| { code: "EMPTY" }
	| { code: "TOO_SHORT"; context: { value: string } };

export class PersonId {
	private readonly value: string;

	private constructor(value: string) {
		this.value = value;
	}

	static create(input: string | null | undefined): Result<PersonId, PersonIdError> {
		if (!input) return err({ code: "EMPTY" });
		const v = input.trim();
		if (v.length < 3) return err({ code: "TOO_SHORT", context: { value: input } });
		return ok(new PersonId(v));
	}

	public equals(other: PersonId): boolean {
		return this.value === other.value;
	}

	public toString(): string {
		return this.value;
	}
}
