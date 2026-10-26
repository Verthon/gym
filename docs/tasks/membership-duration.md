# Membership duration is a raw number across stages

Created: 2026-10-25
Status: open
Source: CodeRabbit CLI review of the uncommitted FR-C14 diff on `77b3948` (see `docs/research/tooling/08-hosted-code-analysis.md`)

## Problem

FR-C03 allows only 1, 3, 6 or 12 months. No code enforces that.

- `ReadModels.mts:5` types an offer's durations as `ReadonlyArray<number>`.
- `ContractDraftService.mts:79` checks that the chosen duration is one the offer lists, not that it is a valid duration. An offer with `[0]` or `[7]` passes.
- `OfferSnapshot.durationInMonths` and `SignedContractProps.durationInMonths` are `number`. `SignedContract.create` accepts anything.
- `toActiveContract` computes `endDate = startDate.plusMonths(durationInMonths)`, so 0 gives an end date equal to the start date and -1 gives one before it, inside `ContractStarted`.

CodeRabbit flagged `SignedContract.create` (`SignedContract.mts:15`) and asked for a guard there. A guard only in the last stage leaves the draft and the snapshot holding invalid values. The rule belongs where the duration enters the system.

## Why it happened

- FR-C03 lists the allowed values inside a sentence about snapshots, not as its own rule, so it reads as description rather than an invariant.
- The draft task modeled "the offer allows it" (D9) and stopped there. Every later stage trusted the draft.
- Task 3 (FR-C14, `real-task-log.md`) added `durationInMonths: number` to `SignedContract` by copying the existing field type. Nothing passes it from the draft yet, so no test crosses the stages with a bad value.

## Open question

FR-C03 allows a 1-month duration, but FR-C15 says a contract can't be terminated earlier than 3 months after the start date. D7 adopted both rules. Either the minimum commitment doesn't apply to durations under 3 months, or 1 month isn't a valid duration. Settle this before encoding the allowed set. Found by a blind `requirements-critic` run (B4).

## Plan

- [ ] Decide where an invalid duration is rejected: when the offer is read (offer read model), or when the draft is prepared. Owner's call.
- [ ] One duration type used by `OfferSnapshot`, the draft input and `SignedContractProps`, so a raw `number` can't reach `SignedContract`.
- [ ] Test: an offer listing an invalid duration can't produce a draft (red first).
- [ ] Test: no `ContractStarted` with `endDate <= startDate` is possible through the public API.
