import { LocalDate } from "@/utils/LocalDate.mjs";
import type { PersonId } from "../draft/PersonId.mjs";

export type ContractSuspended = Readonly<{
  type: "ContractSuspended";
  occurredAt: LocalDate;
  payload: Readonly<{
    personId: PersonId;
  }>;
}>;

export const contractSuspended = (
  payload: ContractSuspended["payload"],
  occurredAt: LocalDate = LocalDate.today()
): ContractSuspended => ({
  type: "ContractSuspended",
  occurredAt,
  payload,
});
