import type { PersonId } from "../draft/PersonId.mts";

export type ContractSuspended = Readonly<{
  type: "ContractSuspended";
  occurredAt: Temporal.Instant;
  payload: Readonly<{
    personId: PersonId;
  }>;
}>;

export const contractSuspended = (
  payload: ContractSuspended["payload"],
  occurredAt: Temporal.Instant
): ContractSuspended => ({
  type: "ContractSuspended",
  occurredAt,
  payload,
});
