import { LocalDate } from "@/utils/LocalDate.mjs";
import type { PersonId } from "./PersonId.mjs";

export type SignatureError =
	| { code: "MISSING_SIGNER" }
	| { code: "MISSING_DATE" };

export class Signature {
	private readonly signerId: PersonId;
	private readonly signedAt: LocalDate;

	private constructor(props: { signerId: PersonId; signedAt: LocalDate }) {
		this.signerId = props.signerId;
		this.signedAt = props.signedAt;
	}

	static create(props: {
		signerId?: PersonId | null;
		signedAt?: LocalDate | null;
	}):
		| { success: true; value: Signature }
		| { success: false; error: SignatureError } {
		if (!props.signerId)
			return { success: false, error: { code: "MISSING_SIGNER" } };
		if (!props.signedAt)
			return { success: false, error: { code: "MISSING_DATE" } };
		return {
			success: true,
			value: new Signature({
				signerId: props.signerId,
				signedAt: props.signedAt,
			}),
		};
	}

	public equals(other: Signature): boolean {
		return (
			this.signerId.equals(other.signerId) &&
			this.signedAt.equals(other.signedAt)
		);
	}

	public getSignerId(): PersonId {
		return this.signerId;
	}

	public getSignedAt(): LocalDate {
		return this.signedAt;
	}
}
