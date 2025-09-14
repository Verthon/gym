import { describe, it, expect } from "vitest";
import { ActiveContract } from "../ActiveContract.mjs";
import { success } from "@/utils/test.mjs";
import { PersonId } from "@/contracting/draft/PersonId.mjs";

describe("ActiveContract", () => {
  it("dispatches a ContractSuspended event when suspended", () => {
    const personId = success(PersonId.create("person-123"));
    const activeContract = ActiveContract.create({ personId });

    activeContract.suspend();

    expect(activeContract.pullEvents()).toEqual([
      {
        occurredAt: expect.any(String),
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
