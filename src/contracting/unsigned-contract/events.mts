import type { FeeStructure } from "@/money/FeeStructure.mjs";
import { LocalDate } from "@/utils/LocalDate.mjs";
import type { PersonId } from "../draft/PersonId.mjs";

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

