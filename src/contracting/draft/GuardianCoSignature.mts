import type { LocalDate } from "#/utils/LocalDate.mts";
import type { PersonId } from "./PersonId.mts";

export type GuardianCoSignatureError =
	| { code: "MISSING_GUARDIAN" }
	| { code: "MISSING_MINOR" }
	| { code: "SAME_PERSON" }
	| { code: "MISSING_DATE" };

export class GuardianCoSignature {
	private readonly guardianId: PersonId;
	private readonly minorId: PersonId;
	private readonly signedAt: LocalDate;

	private constructor(props: {
		guardianId: PersonId;
		minorId: PersonId;
		signedAt: LocalDate;
	}) {
		this.guardianId = props.guardianId;
		this.minorId = props.minorId;
		this.signedAt = props.signedAt;
	}

	static create(props: {
		guardianId?: PersonId | null;
		minorId?: PersonId | null;
		signedAt?: LocalDate | null;
	}):
		| { success: true; value: GuardianCoSignature }
		| { success: false; error: GuardianCoSignatureError } {
		if (!props.guardianId)
			return { success: false, error: { code: "MISSING_GUARDIAN" } };
		if (!props.minorId)
			return { success: false, error: { code: "MISSING_MINOR" } };
		if (!props.signedAt)
			return { success: false, error: { code: "MISSING_DATE" } };
		if (props.guardianId.equals(props.minorId)) {
			return { success: false, error: { code: "SAME_PERSON" } };
		}
		return {
			success: true,
			value: new GuardianCoSignature({
				guardianId: props.guardianId,
				minorId: props.minorId,
				signedAt: props.signedAt,
			}),
		};
	}

	public equals(other: GuardianCoSignature): boolean {
		return (
			this.guardianId.equals(other.guardianId) &&
			this.minorId.equals(other.minorId) &&
			this.signedAt.equals(other.signedAt)
		);
	}

	public getGuardianId(): PersonId {
		return this.guardianId;
	}
	public getMinorId(): PersonId {
		return this.minorId;
	}
	public getSignedAt(): LocalDate {
		return this.signedAt;
	}
}
