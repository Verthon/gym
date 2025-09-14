import { LocalDate } from "@/utils/LocalDate.mjs";
import type { DomainEvent } from "@/events/event.mjs";
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

export const toGenericEvent = (
  e: ContractSuspended
): DomainEvent<"ContractSuspended", ContractSuspended["payload"]> => ({
  type: e.type,
  occurredAt: e.occurredAt.toISO(),
  payload: e.payload,
});
