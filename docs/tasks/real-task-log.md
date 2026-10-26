# Real task log

One section per task. The owner writes the prediction before the run. After the run: files the coder read, checks that failed and what changed after each, and which source the design came from (doc, code, or neither).

## Task 0: ActiveContract can't be suspended twice (`d1063a6`)

- Prediction: none recorded.
- Read: both sibling stages plus `architecture/error-handling-strategy.md`, not `docs/architecture/entity.md`.
- Checks: only its own new test failed first.
- Source: `Result` + `{ code }` from the docs; it named the SignedContract/UnsignedContract conflict itself.

## Task 1: SignedContract reports rejected transitions (`0a6c1c8`)

- Prediction: none recorded.
- Read: `entity.md` and `UnsignedContract`.
- Checks: oxlint `consistent-function-scoping` on its own test helper, fixed.
- Source: `entity.md`, exact code `NOT_AWAITING_PAYMENT`.
- Note: not a fresh session.

## Task 2: suspend an active contract by id (`9f35ecb`)

- Prediction: "it will copy ContractDraftRepository".
- Read: not recorded.
- Checks: not recorded.
- Source: not recorded. The commit adds `ActiveContractId`, `ActiveContractRepository`, `ActiveContractService`, `index.mts`, a `suspend` change in `ActiveContract.mts` and an `ActiveContractService.spec.mts`, which is the same file set as the draft stage's repository/service/id.

## Task 3: FR-C14 end date, Run 1 (direct task, uncommitted)

- Prediction (owner, 2026-10-21): the end-date arithmetic (FR-C14) ends up in the orchestrator or a domain/application service, not in `ActiveContract`. Reason: an `ActiveContract` asking whether it is still active is nonsense; moving a contract through its lifecycle is the orchestrator's job.
- Read: not recorded (no transcript reviewed).
- Checks: `pnpm check` passes on the final diff (lint, type-check, arch, 104 tests). Failures during the run not recorded.
- Source: `CONTEXT.md` (the entity receives a `LocalDate`, not a clock) and FR-C14. The arithmetic is in `SignedContract.toActiveContract(at, startDate)`, which emits `ContractStarted { startDate, endDate }` via the new `LocalDate.plusMonths`. Not in `ActiveContract`, not in an orchestrator (none exists).
- Result against prediction: half right. Not in `ActiveContract`. Also not in a service or orchestrator; it landed in the entity of the stage that starts the contract.
- Gaps: `durationInMonths` is a new required prop of `SignedContract`, but nothing passes it from the draft yet; the agent wrote this into `functional-requirements.md`. End-of-month clamping (Jan 31 + 1 month = Feb 28) is a business decision the agent made and tested without being asked.
