import type { FeeStructure } from "#/money/FeeStructure.mts";
import { LocalDate } from "#/utils/LocalDate.mts";
import type { PersonId } from "../draft/PersonId.mts";

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

