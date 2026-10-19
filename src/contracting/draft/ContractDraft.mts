import type { LocalDate } from "#/utils/LocalDate.mts";
import { err, okVoid, type Result } from "#/utils/Result.mts";
import type { BirthDate } from "./BirthDate.mts";
import type { ContractId } from "./ContractId.mts";
import { contractPrepared, type ContractPrepared } from "./events.mts";
import type { GovernmentIdInfo } from "./GovernmentIdInfo.mts";
import type { GuardianCoSignature } from "./GuardianCoSignature.mts";
import type { OfferFees, OfferSnapshot } from "./OfferSnapshot.mts";
import type { PersonId } from "./PersonId.mts";

type DraftState = { kind: "Draft" } | { kind: "Unsigned" };

export type ContractDraftStatus = DraftState["kind"];

export type ContractDraftProps = {
	id: ContractId;
	offer: OfferSnapshot;
	userInfo: {
		personId: PersonId;
		birthDate: BirthDate;
		governmentId: GovernmentIdInfo;
		governmentIdAttested: boolean;
	};
	guardianCoSignature?: GuardianCoSignature;
};

export type ContractDraftError =
	| { code: "ALREADY_PREPARED" }
	| { code: "ID_NOT_ATTESTED" }
	| { code: "ID_EXPIRED"; context: { expiry: LocalDate; asOf: LocalDate } }
	| { code: "MINOR_REQUIRES_GUARDIAN" }
	| { code: "GUARDIAN_FOR_DIFFERENT_MINOR" }
	| { code: "NEGATIVE_FEE" };

const hasNegativeFee = (fees: OfferFees): boolean =>
	fees.monthlyDues.getAmountMinor() < 0 ||
	fees.enrollmentFee.getAmountMinor() < 0 ||
	fees.penalties.some((p) => p.amount.getAmountMinor() < 0);

export class ContractDraft {
	private readonly props: ContractDraftProps;
	private state: DraftState = { kind: "Draft" };
	private events: ContractPrepared[] = [];

	private constructor(props: ContractDraftProps) {
		this.props = props;
	}

	static create(props: ContractDraftProps): ContractDraft {
		return new ContractDraft(props);
	}

	public prepare({
		at,
		asOf,
	}: {
		at: Temporal.Instant;
		asOf: LocalDate;
	}): Result<void, ContractDraftError> {
		if (this.state.kind !== "Draft") return err({ code: "ALREADY_PREPARED" });

		const { userInfo, offer, guardianCoSignature } = this.props;

		if (!userInfo.governmentIdAttested) return err({ code: "ID_NOT_ATTESTED" });

		const expiry = userInfo.governmentId.getExpiryDate();
		if (expiry?.isBefore(asOf)) {
			return err({ code: "ID_EXPIRED", context: { expiry, asOf } });
		}

		if (!userInfo.birthDate.isAtLeast(18, asOf)) {
			if (!guardianCoSignature) return err({ code: "MINOR_REQUIRES_GUARDIAN" });
			if (!guardianCoSignature.getMinorId().equals(userInfo.personId)) {
				return err({ code: "GUARDIAN_FOR_DIFFERENT_MINOR" });
			}
		}

		if (hasNegativeFee(offer.fees)) return err({ code: "NEGATIVE_FEE" });

		this.state = { kind: "Unsigned" };
		this.events.push(
			contractPrepared({ personId: userInfo.personId, fees: offer.fees }, at)
		);
		return okVoid();
	}

	public pullEvents(): ContractPrepared[] {
		const out = this.events;
		this.events = [];
		return out;
	}

	get id(): ContractId {
		return this.props.id;
	}

	get status(): ContractDraftStatus {
		return this.state.kind;
	}

	get fees(): OfferFees {
		return this.props.offer.fees;
	}

	get personId(): PersonId {
		return this.props.userInfo.personId;
	}
}
