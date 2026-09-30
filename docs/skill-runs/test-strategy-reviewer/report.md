# Test Strategy Reviewer — `src/contracting`, `src/money`

Input: every `__tests__/*.spec.mts` under `src/contracting` and `src/money`, plus the production code each one tests. Excluded: `src/sandbox/locker` — it's the agent-test sandbox and its production files don't exist yet.
Mode: non-interactive. The classification-confirmation and exception questions were answered by the agent (marked **assumed**).

## Classification (Step 1)

| Unit | Class | Signals | Confirmation |
|---|---|---|---|
| `Money`, `MonthlyDues`, `EnrollmentFee`, `PenaltyFee`, `money/FeeStructure` | Transformation | Immutable, input → Result, no I/O | **assumed** yes |
| `PersonId`, `Signature`, `GuardianCoSignature` | Transformation | Immutable VO factories | **assumed** yes |
| `BirthDate`, `GovernmentIdInfo` | Transformation **with a hidden input** | `create` reads `LocalDate.today()` | **assumed**: a mix. It's pure apart from the clock |
| `ContractDraft`, `UnsignedContract`, `SignedContract`, `ActiveContract` | Stateful object | Status field, transitions, `pullEvents()` | **assumed** yes. Low concurrency (see aggregate-designer) |
| `prepareUnsignedContract` (`ContractDraftService`) | Integration | Repository port + entity | **assumed** yes. Untested |

## Reports (Step 4)

### FeeStructure.spec (money)

**Tests**: `money/FeeStructure`, `MonthlyDues`, `EnrollmentFee`, `PenaltyFee`, `Money`
**Problem class**: Transformation
**Current strategy**: output-based
**Recommended strategy**: output-based
**Verdict**: OK

The `calculateInitialCost` "back-compat" assertion tests an alias with no caller outside this test. It isn't a strategy issue, but it pins an API nobody needs.

### PersonId.spec, Signature.spec, GuardianCoSignature.spec

**Problem class**: Transformation
**Current strategy**: output-based
**Recommended strategy**: output-based
**Verdict**: OK

### BirthDate.spec, GovernmentIdInfo.spec

**Tests**: `BirthDate.create`, `GovernmentIdInfo.create`
**Problem class**: Transformation with an implicit clock input
**Current strategy**: output-based, using the real `LocalDate.today()`
**Recommended strategy**: output-based, with the date passed in explicitly
**Verdict**: MISMATCH (mild)

The factories read the clock, so the tests assert against a moving input. "accepts expiry equal to today" is only correct as long as test setup and `create` run on the same day, so it's flaky at midnight. The fix belongs in production code, not the test: make `asOf` a parameter, as `ContractDraft.toNotSignedContract(asOf)` already does. Then these become plain output-based tests.

The expiry rule is also checked twice with different reference dates: at `GovernmentIdInfo.create` (today) and at `toNotSignedContract` (asOf). FR-C05 defines only the second.

### ContractDraft.spec

**Tests**: `ContractDraft`
**Problem class**: Stateful object
**Current strategy**: output-based (Result) + state-based (`status()`, `pullEvents()`, second-promotion test)
**Recommended strategy**: same
**Verdict**: MISMATCH — two concrete problems, the strategy itself is right

1. **Time bomb.** The `validation failures` describe block does not mock `LocalDate.today()`, but uses fixed birth dates (2010-06-10, 2010-04-15) and promotes as of the real today. On **2028-04-15** "fails promotion when guardian refers to a different minor" starts failing, and on 2028-06-10 "fails promotion for a minor without guardian" follows, because the minors turn 18. Pin `today` in that block as the success block does, or pass a fixed `asOf`.
2. **Event assertions reach into VO internals.** `pullEvents()` is compared with `toEqual` against `{ fees: { enrollmentFee: { amount: { amountMinor, currency } } } }`, which are private fields of `FeeStructure` and `Money`. Renaming a private field breaks the test with no behavior change. Assert with `fees.equals(expected)` or `expect.objectContaining({ type, payload: expect.objectContaining({ personId }) })` plus a separate check of the fee total.

Missing: a test that `pullEvents()` is empty on the second call (listed in `implement-spec/unit-tests.md`).

### UnsignedContract.spec

**Tests**: `UnsignedContract`
**Problem class**: Stateful object — its invariant is order-dependent ("either may happen first", "Contract Signed exactly once")
**Current strategy**: state-based, but for only one ordering
**Recommended strategy**: state-based across **both orderings**. Derive the cases from the conflict matrix (aggregate-designer): sales→customer, customer→sales, a repeated signature.
**Verdict**: MISMATCH

- Only the sales-first path is tested. On the customer-first path the code emits `ContractSigned` twice (in `confirmServiceCommitmentBySalesSpecialist` and again in `toSignedContract`). Sales-first emits once, and only because of `toSignedContract`. One more test with the reverse order would have caught it.
- The Results of `confirmServiceCommitmentBySalesSpecialist` and `acceptTermsAndConditionsByCustomer` are ignored in setup. Per `implement-spec/unit-tests.md` they should go through `success(...)`.
- No test for a repeated signature (`INVALID_STATE`).

### SignedContract.spec

**Tests**: `SignedContract`
**Problem class**: Stateful object that receives facts from an external system
**Current strategy**: state-based through events only
**Recommended strategy**: output-based (Result per command) + state-based
**Verdict**: MISMATCH

- `recordPaymentAccepted`, `recordPaymentRejected` and `toActiveContract` return `void` and silently ignore invalid calls. So the only observable outcome is "no event", and "does not activate contract without accepted payment" can't tell "rejected by rule" from "method did nothing". Returning `Result` would make these output-based.
- "does not activate contract after rejected payment" encodes the current terminal-failure behavior. FR-C12 says a retry must be possible, and no test covers failed → retry → confirmed.
- No duplicate-callback test (confirmed twice, confirmed after failed).

### ActiveContract.spec

**Tests**: `ActiveContract.suspend`
**Problem class**: Stateful object
**Current strategy**: state-based via event
**Verdict**: OK as strategy. The behavior is out of scope: decision D3 dropped Contract Suspended, so this test protects a feature that shouldn't exist.

### (missing) ContractDraftService — `prepareUnsignedContract`

**Problem class**: Integration (repository port + entity)
**Current strategy**: none
**Recommended strategy**: the repository is a **managed** dependency, so use the in-memory repository. Verify the final state through `get`, plus a recording fake to prove `save` was called. No mocks.
**Verdict**: MISMATCH (untested)

What a test would reveal today:
- `input.guardianId` is accepted and never used, so a minor can never be prepared through the service.
- `pullEvents()` is never called, so Contract Prepared is dropped. That's intentional per `docs/tasks/event-publisher.md` (the publisher is deferred), but a service test should pin that decision.

## Summary

- 11 spec files reviewed (1 excluded). 5 OK, 5 MISMATCH, plus 1 missing integration test.
- The strategy choice is generally right: output-based for VOs, state-based for stages. The mismatches are about **inputs** (hidden clock), **orderings** (one path of an order-dependent invariant), and **commands that return void**, which forces event-only verification.
- The highest-value fix is the reverse-order test for `UnsignedContract`, which would expose the double `ContractSigned`. After that, the April 2028 time bomb in `ContractDraft.spec`.
