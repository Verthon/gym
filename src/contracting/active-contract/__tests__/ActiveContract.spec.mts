import { describe, it, expect } from "vitest";
import { ActiveContract } from "../ActiveContract.mts";
import { failWith, success } from "#/utils/test.mts";
import { ActiveContractId } from "../ActiveContractId.mts";
import { PersonId } from "#/contracting/draft/PersonId.mts";

const at = Temporal.Instant.from("2025-09-13T10:00:00Z");
const later = Temporal.Instant.from("2025-09-14T10:00:00Z");

const activeContract = () =>
  ActiveContract.create({
    id: success(ActiveContractId.create("contract-1")),
    personId: success(PersonId.create("person-123")),
  });

describe("ActiveContract", () => {
  it("dispatches a ContractSuspended event when suspended", () => {
    const contract = activeContract();

    success(contract.suspend(at));

    expect(contract.pullEvents()).toEqual([
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

  it("rejects suspending an already suspended contract", () => {
    const contract = activeContract();
    success(contract.suspend(at));
    contract.pullEvents();

    failWith(contract.suspend(later), "ALREADY_SUSPENDED");
    expect(contract.pullEvents()).toEqual([]);
  });
});
