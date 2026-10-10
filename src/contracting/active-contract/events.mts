import type { LocalDate } from "#/utils/LocalDate.mts";
import type { PersonId } from "../draft/PersonId.mts";

export type ContractSuspended = Readonly<{
  type: "ContractSuspended";
  occurredAt: LocalDate;
  payload: Readonly<{
    personId: PersonId;
  }>;
}>;

export const contractSuspended = (
  payload: ContractSuspended["payload"],
  occurredAt: LocalDate
): ContractSuspended => ({
  type: "ContractSuspended",
  occurredAt,
  payload,
});
