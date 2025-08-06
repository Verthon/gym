import type { FeeStructure } from "@/money/FeeStructure.mjs";
import { LocalDate } from "@/utils/LocalDate.mjs";
import type { PersonId } from "./PersonId.mjs";
import type { DomainEvent } from "@/events/event.mjs";

/** Internal BC event (can use VO + LocalDate) */
export type ContractPrepared = Readonly<{
	type: "ContractPrepared";
	occurredAt: LocalDate;
	payload: Readonly<{
		personId: PersonId;
		fees: FeeStructure;
	}>;
}>;

/** Factory (defaults to today) */
export const contractPrepared = (
	payload: ContractPrepared["payload"],
	occurredAt: LocalDate = LocalDate.today()
): ContractPrepared => ({
	type: "ContractPrepared",
	occurredAt,
	payload,
});

/** Adapter to generic event for the publisher (string date) */
export const toGenericEvent = (
	e: ContractPrepared
): DomainEvent<"ContractPrepared", ContractPrepared["payload"]> => ({
	type: e.type,
	occurredAt: e.occurredAt.toISO(),
	payload: e.payload,
});
