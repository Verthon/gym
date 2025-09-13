import type { FeeStructure } from "@/money/FeeStructure.mjs";
import { LocalDate } from "@/utils/LocalDate.mjs";
import type { PersonId } from "../draft/PersonId.mjs";
import type { DomainEvent } from "@/events/event.mjs";

export type ContractSigned = Readonly<{
    type: "ContractSigned";
    occurredAt: LocalDate;
    payload: Readonly<{
        personId: PersonId;
        fees: FeeStructure;
    }>;
}>;

export const contractSigned = (
    payload: ContractSigned["payload"],
    occurredAt: LocalDate = LocalDate.today()
): ContractSigned => ({
    type: "ContractSigned",
    occurredAt,
    payload,
});

export const toGenericEvent = (
    e: ContractSigned
): DomainEvent<"ContractSigned", ContractSigned["payload"]> => ({
    type: e.type,
    occurredAt: e.occurredAt.toISO(),
    payload: e.payload,
});

