import type { Clock } from "#/utils/Clock.mts";
import { err, okVoid, type Result } from "#/utils/Result.mts";
import type { ActiveContractError } from "./ActiveContract.mts";
import { ActiveContractId } from "./ActiveContractId.mts";
import type { ActiveContractRepository } from "./ActiveContractRepository.mts";

type SuspendErrorCode = "CONTRACT_NOT_FOUND" | ActiveContractError["code"];

export const suspendActiveContract =
  (deps: { contracts: ActiveContractRepository; clock: Clock }) =>
  async (input: { contractId: string }): Promise<Result<void, { code: SuspendErrorCode }>> => {
    const id = ActiveContractId.create(input.contractId);
    if (!id.success) return err({ code: "CONTRACT_NOT_FOUND" });
    const contract = await deps.contracts.get(id.value);
    if (!contract) return err({ code: "CONTRACT_NOT_FOUND" });

    const suspended = contract.suspend(deps.clock.instant());
    if (!suspended.success) return err({ code: suspended.error.code });

    await deps.contracts.save(contract);
    return okVoid();
  };
