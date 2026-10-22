# In-memory repositories hand out live references

Created: 2026-10-22
Status: open
Source: CodeRabbit CLI review of `6c6c40b..9f35ecb` (see `docs/research/tooling/08-hosted-code-analysis.md`)

## Problem

`InMemoryActiveContractRepository.get` and `InMemoryContractDraftRepository.get` return the stored instance itself. A service that mutates the loaded object changes the store even if it never calls `save`.

- Tests can't tell whether a service persists. Delete `await deps.contracts.save(contract)` from `ActiveContractService.mts:20`, and "suspend then get → suspended" still passes.
- A real store loads a fresh object on each `get`, so the fake doesn't behave like what it stands in for.

CodeRabbit flagged this as "a failed save leaves the contract suspended" and suggested making the transition and the save atomic. The atomicity framing is wrong: `Map.set` never rejects, and a real repository wouldn't share instances. The aliasing is the actual defect.

## Plan

- [ ] Both in-memory repositories return a copy or rehydrated object from `get` (and store one on `save`).
- [ ] Test: a service that skips `save` fails its tests.
- [ ] Stryker on `ActiveContractService` and `ContractDraftService`: the removed-`save` mutant is killed.
