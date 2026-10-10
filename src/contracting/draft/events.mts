import type { FeeStructure } from "#/money/FeeStructure.mts";
import type { LocalDate } from "#/utils/LocalDate.mts";
import type { PersonId } from "./PersonId.mts";

/** Internal BC event (can use VO + LocalDate) */
export type ContractPrepared = Readonly<{
	type: "ContractPrepared";
	occurredAt: LocalDate;
	payload: Readonly<{
		personId: PersonId;
		fees: FeeStructure;
	}>;
}>;

export const contractPrepared = (
	payload: ContractPrepared["payload"],
	occurredAt: LocalDate
): ContractPrepared => ({
	type: "ContractPrepared",
	occurredAt,
	payload,
});
