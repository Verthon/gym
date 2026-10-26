# ContractPrepared occurredAt assertion checks nothing

Created: 2026-10-25
Status: open
Source: blind `test-strategy-reviewer` run, B4 (`docs/skill-runs/2026-10-25/test-strategy-reviewer.md`)

## Problem

`src/contracting/draft/__tests__/ContractDraft.spec.mts:51` asserts `toMatchObject({ type: "ContractPrepared", occurredAt: at })`. With Vitest 4.1.12, `toMatchObject` passes for any `Temporal.Instant`. A scratch run with 2020 vs 2099 passed, while `toEqual` on the same values failed. A wrong `occurredAt` would go unnoticed.

This is the only `toMatchObject` on a Temporal value in `src`. The other one, `contracting.acceptance.dsl.mts:118`, compares `{ success: true }`.

The case is also recorded for the advisors library: `~/Projects/advisors/distillates/testing-tomatchobject-temporal.md` (status not yet pronounced).

## Plan

- [ ] Red first: change `at` in the assertion to a different instant and watch the test still pass, which proves the assertion is empty.
- [ ] Assert `occurredAt` with `toEqual` or `.equals()`, then repeat the wrong-instant check: now it must fail.
- [ ] Decide whether a lint or convention rule should forbid `toMatchObject` on objects that carry Temporal values.
- [ ] Optional: does Stryker kill an `occurredAt` mutant before and after the fix?
