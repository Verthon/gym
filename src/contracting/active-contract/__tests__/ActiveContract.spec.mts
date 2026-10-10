import { describe, it, expect } from "vitest";
import { ActiveContract } from "../ActiveContract.mts";
import { success } from "#/utils/test.mts";
import { LocalDate } from "#/utils/LocalDate.mts";
import { PersonId } from "#/contracting/draft/PersonId.mts";

const today = LocalDate.fromISO("2025-09-13");

describe("ActiveContract", () => {
  it("dispatches a ContractSuspended event when suspended", () => {
    const personId = success(PersonId.create("person-123"));
    const activeContract = ActiveContract.create({ personId });

    activeContract.suspend(today);

    expect(activeContract.pullEvents()).toEqual([
      {
        occurredAt: today,
        payload: {
          personId: {
            value: "person-123",
          },
        },
        type: "ContractSuspended",
      },
    ]);
  });
});
