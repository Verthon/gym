import type { PersonId } from "./PersonId.mts";
import type { OfferFees } from "./OfferSnapshot.mts";

/** Internal BC event (can use VO + LocalDate) */
export type ContractPrepared = Readonly<{
	type: "ContractPrepared";
	occurredAt: Temporal.Instant;
	payload: Readonly<{
		personId: PersonId;
		fees: OfferFees;
	}>;
}>;

export const contractPrepared = (
	payload: ContractPrepared["payload"],
	occurredAt: Temporal.Instant
): ContractPrepared => ({
	type: "ContractPrepared",
	occurredAt,
	payload,
});
