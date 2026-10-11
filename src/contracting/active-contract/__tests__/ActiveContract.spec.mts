import { describe, it, expect } from "vitest";
import { ActiveContract } from "../ActiveContract.mts";
import { success } from "#/utils/test.mts";
import { PersonId } from "#/contracting/draft/PersonId.mts";

const at = Temporal.Instant.from("2025-09-13T10:00:00Z");

describe("ActiveContract", () => {
  it("dispatches a ContractSuspended event when suspended", () => {
    const personId = success(PersonId.create("person-123"));
    const activeContract = ActiveContract.create({ personId });

    activeContract.suspend(at);

    expect(activeContract.pullEvents()).toEqual([
      {
        occurredAt: at,
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
