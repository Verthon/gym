import type { FeeStructure } from "#/money/FeeStructure.mts";
import type { PersonId } from "../draft/PersonId.mts";

export type ContractSigned = Readonly<{
    type: "ContractSigned";
    occurredAt: Temporal.Instant;
    payload: Readonly<{
        personId: PersonId;
        fees: FeeStructure;
    }>;
}>;

export const contractSigned = (
    payload: ContractSigned["payload"],
    occurredAt: Temporal.Instant
): ContractSigned => ({
    type: "ContractSigned",
    occurredAt,
    payload,
});

