import { describe, it, expect } from "vitest";

import { Clock } from "#/utils/Clock.mts";
import { PersonId } from "#/contracting/draft/PersonId.mts";
import { failWith, success } from "#/utils/test.mts";
import { ActiveContract } from "../ActiveContract.mts";
import { ActiveContractId } from "../ActiveContractId.mts";
import {
  InMemoryActiveContractRepository,
  type ActiveContractRepository,
} from "../ActiveContractRepository.mts";
import { suspendActiveContract } from "../ActiveContractService.mts";

const clock = Clock.fixed("2026-10-19T10:00:00Z", "Europe/Warsaw");

const contractId = success(ActiveContractId.create("contract-1"));

const seeded = async () => {
  const contracts = new InMemoryActiveContractRepository();
  await contracts.save(
    ActiveContract.create({ id: contractId, personId: success(PersonId.create("person-123")) })
  );
  return contracts;
};

class FailingRepository extends InMemoryActiveContractRepository {
  override async get(): Promise<ActiveContract | null> {
    throw new Error("storage down");
  }
}

describe("suspendActiveContract", () => {
  it("suspends the stored contract and saves it", async () => {
    const contracts = await seeded();

    success(await suspendActiveContract({ contracts, clock })({ contractId: "contract-1" }));

    const stored = await contracts.get(contractId);
    expect(stored?.pullEvents()).toEqual([
      expect.objectContaining({ type: "ContractSuspended", occurredAt: clock.instant() }),
    ]);
  });

  it("reports CONTRACT_NOT_FOUND for an unknown id", async () => {
    const contracts: ActiveContractRepository = new InMemoryActiveContractRepository();

    failWith(
      await suspendActiveContract({ contracts, clock })({ contractId: "missing" }),
      "CONTRACT_NOT_FOUND"
    );
  });

  it("reports CONTRACT_NOT_FOUND for an empty id", async () => {
    const contracts = await seeded();

    failWith(
      await suspendActiveContract({ contracts, clock })({ contractId: "  " }),
      "CONTRACT_NOT_FOUND"
    );
  });

  it("reports ALREADY_SUSPENDED when suspended twice", async () => {
    const contracts = await seeded();
    const suspend = suspendActiveContract({ contracts, clock });
    success(await suspend({ contractId: "contract-1" }));

    failWith(await suspend({ contractId: "contract-1" }), "ALREADY_SUSPENDED");
  });

  it("propagates infrastructure failures", async () => {
    const contracts = new FailingRepository();

    await expect(
      suspendActiveContract({ contracts, clock })({ contractId: "contract-1" })
    ).rejects.toThrow("storage down");
  });
});
