# Test strategy review

Skill: `~/.claude/skills/test-strategy-reviewer/SKILL.md` (the only other file in the directory is `agents/openai.yaml`, which is UI metadata).
Date: 2026-10-25. Read-only review, nothing in the repo was changed.

## Assumptions

The skill says to confirm the classification and the right test level with the user (AskUserQuestion). No user was available, so I made these assumptions:

1. **Classification.** I treat the contract stages (`UnsignedContract`, `ContractDraft`, `SignedContract`) as **stateful entities**, not as aggregates under contention. The project memory says "Contracting has no aggregates, no concurrent contention, contract stages are entities, no locking". So the recommended strategy is output-based plus indirect state-based, and I don't raise any concurrency or locking test gaps.
2. **Value objects** (`BirthDate`, `PersonId`, `ContractId`, `GovernmentIdInfo`, `GuardianCoSignature`, `Signature`, `LocalDate`) count as **transformations**: pure, no I/O, nothing expensive behind them.
3. **`ContractDraftService`** is **integration** (it orchestrates the read models and the repository) with transformation logic embedded in it (`toFees`, `parseDate`). The draft repository is a **managed** dependency: only this app reads and writes it. The Offer and Customer read models are **incoming queries**, so they are stubs, not mocks.
4. **Test level.** The orchestration around the draft is simple (load, call `prepare`, save) and its effect can be checked through a query (`contractStatus`). The skill's criteria for that case favour facade-level tests, which `PrepareContract.acceptance.spec.mts` already provides. I kept focused aggregate tests only where the aggregate has invariants the facade can't reach easily.
5. **Target A** is judged against the requirements as they stand now (`architecture/functional-requirements.md`, FR-C07/FR-C08). At commit 290ff38 those requirements may not have existed in this form. The bugs found there are code defects regardless of when the requirements were written.
6. **Known gaps.** Gaps already listed in "Implementation gaps" or in `docs/tasks/*.md` are still reported where a test locks them in or hides them. Those findings are marked "(tracked)".

Severity scale:
- **High**: a test passes while a real defect or a requirement violation exists.
- **Medium**: a requirement or boundary goes unverified, or the strategy is mismatched in a way that will cost later.
- **Low**: coupling or noise.

---

## Target A: `src/contracting/unsigned-contract/` at 290ff38

Files: `UnsignedContract.mts`, `events.mts`, `__tests__/UnsignedContract.spec.mts` (read with `git show 290ff38:<path>`).

### UnsignedContract.spec.mts

**Tests**: UnsignedContract
**Problem class**: Stateful Object (an entity with a 4-state machine: Pending, ConfirmedBySales, AcceptedByCustomer, Signed)
**Current strategy**: Mixed. It drives the object through prior operations, which is good. But it observes state only through `toSignedContract()`, a command that also emits an event, and through `pullEvents()`. It also stubs `LocalDate.today` with `vi.spyOn`.
**Recommended strategy**: Output-based plus indirect state-based. Check every transition order through the emitted events, use distinct dates, and test the rejected (`INVALID_STATE`) transitions.
**Verdict**: MISMATCH

#### A1. Only one signing order is tested, which hides a duplicate ContractSigned event (High)
- Production: `UnsignedContract.mts:39-51` emits `ContractSigned` when the Sales Specialist confirms second. `UnsignedContract.mts:78-88` emits `ContractSigned` again in `toSignedContract()`. The customer-second branch at `:65-67` emits nothing.
- Test: `UnsignedContract.spec.mts:36-37` only covers the order "Sales Specialist first, then Customer".
- Scenario: the customer accepts on 2025-09-13 and the Sales Specialist confirms on 2025-09-14. Then `toSignedContract()` runs and `pullEvents()` returns **two** `ContractSigned` events. This violates FR-C07 ("either may happen first") and FR-C08 ("emitted exactly once"). No test exercises this order, so the suite is green.
- Fix: parametrise the success test over both orders and assert exactly one event.

#### A2. `toSignedContract()` doubles as the state probe and emits on every call (High)
- Production: `UnsignedContract.mts:73-91`. The only way to observe "Signed" is a command with a side effect, and nothing guards a second call.
- Test: `UnsignedContract.spec.mts:38-40` calls it once.
- Scenario: a caller retries `toSignedContract()` and gets one more `ContractSigned` per call. The test can't catch this because it never calls the method twice and never reads state through a side-effect-free query.
- Fix: emit the event at the transition into `Signed` only (once), and expose a `status` getter, or make `toSignedContract` idempotent. Test it by calling it twice and asserting a single event.

#### A3. Rejected transitions (`INVALID_STATE`) are never tested (Medium)
- Production: `UnsignedContract.mts:53-55` and `:68-70`.
- Test: no test re-signs. The return values of `confirmServiceCommitmentBySalesSpecialist` and `acceptTermsAndConditionsByCustomer` are ignored at `:36-37`, `:78` and `:93`.
- Scenario: the Sales Specialist confirms twice, or the customer accepts after Signed. FR-C07 says "each happens at most once". Deleting either `default:` branch, or making it return ok, survives the suite. The test helper `failWith` (`src/utils/test.mts`) requires `{ code }` errors, while these methods return the bare string `"INVALID_STATE"`. That mismatch is probably why nobody tested this path.

#### A4. Same date for both signatures, so "dated at the second signature" isn't pinned (Medium)
- Production: `UnsignedContract.mts:40` and `:66` take `at` from the second call.
- Test: `UnsignedContract.spec.mts:34-37` passes the same `today` to both calls and expects `occurredAt: "2025-09-13"` at `:42`.
- Scenario: a mutant that stores the first signature's date passes. FR-C08 requires the date of the second signature. Use two distinct dates.

#### A5. Stubbing `LocalDate.today` is unneeded and leaks across describes (Low)
- Test: `UnsignedContract.spec.mts:22-26` uses `vi.spyOn(LocalDate, "today")` in `beforeEach` and never restores it. `vitest.config.mts` at 290ff38 has no `restoreMocks`.
- Scenario: the production code takes `at` as a parameter, so the clock stub is interaction-style faking of a pure value API with no benefit. The second describe (`:69-98`) calls `LocalDate.today()` unstubbed or still stubbed depending on execution order, so its dates aren't deterministic. Pass `LocalDate.fromISO(...)` directly and drop the spy.

#### A6. The event assertion is coupled to the private representation of the value objects (Low)
- Test: `UnsignedContract.spec.mts:44-61` asserts `amountMinor`, `currency`, `penaltyFees` and `personId.value`. These are private fields of `Money`, `FeeStructure` and `PersonId`. The cause is that `events.mts:24-30` puts domain objects into the "generic" event unserialised.
- Scenario: renaming a private field in `Money` breaks this test while the `UnsignedContract` contract stays the same. Assert with `equals()` on the value objects, or serialise the payload explicitly in `toGenericEvent` and assert that published shape.

---

## Target B: `src/contracting/draft/` and `src/contracting/signed-contract/` (working tree)

Requirements: `architecture/functional-requirements.md`.

### Value object specs: BirthDate, PersonId, ContractId, GovernmentIdInfo, GuardianCoSignature, Signature

**Problem class**: Transformation
**Current strategy**: Output-based
**Recommended strategy**: Output-based
**Verdict**: OK, with the findings below.

#### B1. `Signature` value object is tested but unused in production (Low)
- `draft/Signature.mts` and `draft/__tests__/Signature.spec.mts:1-44`. No production module imports `Signature.mts`. Signing (FR-C07) isn't modelled with it.
- Scenario: the tests keep dead code green and suggest that signatures are modelled when they aren't. Delete it, or wire it into the signing stage.

#### B2. A `TEST_ID` document type exists in production and is asserted as permitted (Low)
- `draft/GovernmentIdInfo.mts:3,28` and `__tests__/GovernmentIdInfo.spec.mts:51-60`.
- Scenario: a Sales Specialist can attest a `TEST_ID` and pass the Identification rule (FR-C05). The test enshrines this as intended behaviour.

#### B3. Leap-day birthdays are untested at the age boundary (Low)
- `draft/BirthDate.mts:32-40` and `__tests__/BirthDate.spec.mts:24-45`.
- Scenario: a customer born on 2008-02-29 is prepared on 2026-02-28. The code says 17, so a guardian is required (FR-C05 age rule). Whether that's right is a business decision. Either way, no test pins it.

### ContractDraft.spec.mts

**Tests**: ContractDraft
**Problem class**: Stateful Object (Draft becomes Unsigned, guarded by the Contract validation policy)
**Current strategy**: Output-based plus state-based. It checks the result, then `status` and `pullEvents()`, including after a prior `prepare`.
**Recommended strategy**: Same. The Identification and Age rules are covered at facade level (acceptance spec), which is fine under assumption 4.
**Verdict**: OK on strategy. Three assertion and coverage defects follow.

#### B4. The `occurredAt` assertion is vacuous because `toMatchObject` doesn't compare `Temporal.Instant` (High)
- Test: `draft/__tests__/ContractDraft.spec.mts:51`, `expect(events[0]).toMatchObject({ type: "ContractPrepared", occurredAt: at })`.
- Verified with vitest 4.1.12 in a scratch run: `expect({ occurredAt: Instant("2025-09-13T10:00Z") }).toMatchObject({ occurredAt: Instant("2000-01-01T00:00Z") })` **passes**. Temporal objects have no own enumerable properties, so `subsetEquality` sees `{}` vs `{}`. `toEqual` does discriminate.
- Scenario: `ContractDraft.mts:82` passes the wrong instant, or a constant, to `contractPrepared`, and the test stays green. FR-C06 ("the preparation date starts the signing window") depends on this timestamp. Use `expect(events[0]?.occurredAt.equals(at)).toBe(true)` or `toEqual`.
- The same trap applies to any future `toMatchObject` on `LocalDate`/`Temporal` fields across the repo.

#### B5. An ID with no expiry date passes the Identification rule, and no test covers it (Medium)
- Production: `draft/GovernmentIdInfo.mts:9` (`expiryDate?`) and `draft/ContractDraft.mts:66-67` (`expiry?.isBefore(asOf)` is falsy when the date is missing).
- Test: `ContractDraft.spec.mts:35-37` always supplies an expiry. The service always parses one (`ContractDraftService.mts:88`).
- Scenario: a `ContractDraft` built with `GovernmentIdInfo.create({ type: "PASSPORT", number: "ABC123" })` prepares successfully. FR-C05 requires the document type, number **and expiry date** to be present. The aggregate is where the invariant lives, so the aggregate test should cover it.

#### B6. The `ContractPrepared` payload test locks in the missing contract ID and offer terms (Medium, tracked)
- Production: `draft/events.mts:5-12` and `ContractDraft.mts:81-83`. The payload has `personId` and `fees` only.
- Test: `ContractDraft.spec.mts:44-55` asserts exactly those two fields. `:53` uses identity (`toBe(draft.fees)`), which also pins aliasing of the draft's internal fees object.
- Scenario: FR-C01 requires every event to carry the contract ID. FR-C06 and the published language require "contract ID, customer, offer terms" (duration, service package, fees). The test passes against an event the frontend can't use. Assert the published shape, and assert value equality on fees instead of identity.

### ContractDraftService.spec.mts

**Tests**: `createContractDraft`, `prepareContract`
**Problem class**: Integration (read models plus repository) with embedded transformation (`toFees`, `parseDate`)
**Current strategy**: Interaction-based on the repository. `RecordingRepository` counts `save` calls at `:45-51, 66, 89, 122-123, 137`. Read models are stubbed and correctly never asserted.
**Recommended strategy**: The repository is a managed dependency, so use a real (in-memory) instance and verify final state through `get`/`contractStatus`. Read models stay stubs.
**Verdict**: MISMATCH (forced by a fake defect, see B7)

#### B7. The in-memory repository aliases instances, so state checks can't detect a missing `save` (High, tracked in `docs/tasks/in-memory-repo-aliasing.md`)
- Production: `draft/ContractDraftRepository.mts:19-25`. `get` returns the stored instance, and `prepareContract` mutates it in place (`ContractDraftService.mts:152`).
- Tests: the acceptance tests check `statusOf(contract)` (`PrepareContract.acceptance.spec.mts:41, 66, 76, 94, 122`). The service spec works around the problem by spying on `save`.
- Scenario: delete `await deps.drafts.save(draft)` at `ContractDraftService.mts:155`. AC-PC-05 still reports `"Unsigned"`, because the store holds the same object that `prepare` mutated. Only the `RecordingRepository` count catches it. That is a spy on a managed dependency, which couples the test to the number of `save` calls rather than to persisted state.
- Fix (per the task doc): make `get` and `save` copy or rehydrate. Then replace `drafts.saved` assertions with state queries and delete `RecordingRepository`.

#### B8. "Saves the new draft" checks the call count, not what was persisted (Medium)
- Test: `ContractDraftService.spec.mts:60-67` checks `drafts.saved` has length 1.
- Scenario: the service persists a draft with the wrong `durationInMonths`, an empty `servicePackage`, or fees from a different offer. The test passes. FR-C03 (snapshot of offer ID, chosen duration, service package and fees) has no assertion anywhere. `ContractDraft` exposes no snapshot getter, so the snapshot can't be observed except through `fees`.

#### B9. Snapshot independence from later offer changes is untested (Medium)
- DSL: `draft/__tests__/contracting.acceptance.dsl.mts:86-103` (`publishOffer` overwrites the offer in the map). Production: `ContractDraftService.mts:116-123` copies the offer at draft time.
- Scenario: FR-C03 says "later changes to the offer do not affect the contract". No acceptance test drafts, re-publishes the offer with different fees or durations, then prepares and checks the prepared terms. The DSL already supports this. The missing piece is an observable for the terms (see B6, B8).

#### B10. Time-zone wiring of `asOf` isn't pinned at the service or facade level (Medium)
- Production: `ContractDraftService.mts:86` and `:151` use `LocalDate.fromInstant(..., clock.timeZone)`. `LocalDate.fromInstant` is unit-tested in isolation (`src/utils/__tests__/LocalDate.spec.mts:5-14`).
- DSL: `contracting.acceptance.dsl.mts:43` always uses 10:00Z, far from midnight.
- Scenario: someone changes `:151` to use `"UTC"`, or derives `asOf` from `at.toString().slice(0, 10)`. A preparation at 2026-10-18T22:30Z (2026-10-19 in Warsaw) with an ID expiring on 2026-10-18 should be `ID_EXPIRED` but is accepted. A customer born 2008-10-19 would be wrongly rejected. FR-C05 evaluates rules "as of the preparation date". Add one acceptance case near midnight.

#### B11. Decision logic is embedded in the orchestration shell (Low)
- Production: `ContractDraftService.mts:41-65` (`parseDate`, `toMoney`, `toFees`) and `:79-81`.
- Test: covered only through the async service (`ContractDraftService.spec.mts:92-100`).
- The skill's separation heuristic applies here. `toFees`/`toOfferSnapshot` is a pure read-model-to-snapshot transformation and could be tested output-based on its own. That is where the duration rule from `docs/tasks/membership-duration.md` belongs (FR-C03 allows only 1/3/6/12. Offer `[7]` with `months: 7` passes `:79` today and no test rejects it, tracked).

#### B12. Guardian adulthood isn't checked or tested (Low)
- Production: `ContractDraftService.mts:103-114` and `draft/GuardianCoSignature.mts:25-49` check only distinct IDs.
- Scenario: a "guardian" who is a 15-year-old sibling co-signs for a minor and preparation is accepted. The Actors section says the Guardian is an adult. FR-C05 doesn't state that explicitly, so this may be a requirements gap rather than a code gap.

#### B13. The draft can't be corrected, and the tests don't notice (Low)
- FR-C04 says the draft is correctable until validation passes. AC-PC-06/07/10/12/13 confirm a rejected draft stays `Draft`, but no operation exists to fix the data, and no test for one. The "stays Draft" assertions are necessary but not sufficient for FR-C04.

### PrepareContract.acceptance.spec.mts and contracting.acceptance.dsl.mts

**Tests**: the draft facade (`createContractDraft`, `prepareContract`, `contractStatus`)
**Problem class**: Integration, verified at facade level
**Current strategy**: State-based through a query (`statusOf`) with stubbed read models. This is the right level per assumption 4.
**Verdict**: OK on strategy. Undermined by B7 (aliasing) and missing B9/B10.

### SignedContract.spec.mts

**Tests**: SignedContract
**Problem class**: Stateful Object (AwaitingPayment, then PaymentAccepted or PaymentRejected, then Active)
**Current strategy**: Output-based plus indirect state-based through `pullEvents()` after prior operations. The rejected-transition suite (`:145-188`) is well-formed.
**Recommended strategy**: Same, plus cross-stage acceptance at facade level once an orchestrator exists.
**Verdict**: OK on strategy. Requirement mismatches follow.

#### B14. A test enshrines Payment Failed as terminal, which contradicts FR-C12 (High, tracked)
- Production: `signed-contract/SignedContract.mts:85-87` and `:66-67` (only `AwaitingPayment` accepts payment).
- Test: `SignedContract.spec.mts:167-177`, "rejects accepting a payment after it was rejected", expects `NOT_AWAITING_PAYMENT`. The same goes for `:111-130`.
- Scenario: the customer's card is declined and the retry succeeds. The payment system reports Payment Confirmed, Contracting rejects it, and the contract can never start. FR-C12 says "the contract remains signed and awaiting payment. The Customer may retry payment any number of times." The test asserts the bug as the spec, so a correct fix turns the suite red. It needs replacing with a failed-then-confirmed case that expects `PaymentFailed`, then `PaymentConfirmed`, then `ContractStarted`.

#### B15. The start policy isn't tested: payment confirmation and start are separate commands (Medium, tracked)
- Production: `SignedContract.mts:41-60` (`toActiveContract`) and `:62-79` (`recordPaymentAccepted`). `startDate` is an independent argument.
- Test: `SignedContract.spec.mts:26, 42` calls both, with the same `at`/`startDate`.
- Scenario: FR-C13 says "the contract starts when payment is confirmed". A contract can sit in `PaymentAccepted` forever, and `toActiveContract(at, someOtherDate)` emits `ContractStarted` with a start date unrelated to confirmation. No test, and no orchestrator to test at facade level. Open question 3 leaves the start date undecided. The coupling itself is still unverified.

#### B16. End-date calculation is tested for one duration on a mid-month date only (Medium)
- Production: `SignedContract.mts:54`.
- Test: `SignedContract.spec.mts:24, 57` uses 12 months from 2025-09-13. Month-end clamping is tested only in `LocalDate.spec.mts:60-62`, not through `SignedContract`.
- Scenario: durations 1/3/6 (FR-C03) and a start on 2026-01-31 with 1 month (expected 2026-02-28) are never checked against `ContractStarted.endDate` (FR-C14). Values of 0 or -1 give `endDate <= startDate` and are accepted by `create` (tracked in `membership-duration.md`). A table-driven output-based test over durations would close the gap.

#### B17. The `ContractStarted` payload is asserted weakly and against the wrong published shape (Medium, partly tracked)
- Test: `SignedContract.spec.mts:52-55`, `fees: expect.objectContaining({ enrollmentFee: expect.any(Object), monthlyDues: expect.any(Object) })`.
- Scenario: fees from the wrong contract, or swapped dues and enrollment, still pass. The published language for Contract Started (consumed by Pass Registration) requires the contract ID and the **service package**. Neither is in `signed-contract/events.mts:41-50`, so neither can be asserted (FR-C01).

#### B18. Payload assertions reach into `PersonId`'s private field (Low)
- Test: `SignedContract.spec.mts:33-35, 49-51, 83-85` use `personId: { value: "person-123" }`.
- Scenario: renaming `PersonId.value` (a private field, `draft/PersonId.mts:8`) breaks three tests with no behaviour change. Compare with `PersonId.create(...)`'s value or `.equals`.

#### B19. No cross-stage test of the draft-to-signed handoff, and the fee types differ (Medium)
- Production: the draft holds `OfferFees` with raw `Money` and no currency check (`draft/OfferSnapshot.mts:3-7`, `ContractDraftService.mts:54-65`). `SignedContract` requires `FeeStructure` (`signed-contract/SignedContract.mts:12-16`), and `FeeStructure.create` rejects mixed currencies (`src/money/FeeStructure.mts`). No conversion exists.
- Scenario: an offer with PLN dues and an EUR penalty drafts and prepares successfully (`hasNegativeFee` is the only fee check), but can never become a `SignedContract`. Each stage's tests build their own inputs (`SignedContract.spec.mts:17-24`), so the incompatibility is invisible. A cross-stage acceptance test from draft through to Contract Started would expose it. The same test is what `membership-duration.md` asks for.

#### B20. Contract status (FR-C16) can't be queried past Unsigned (Low, tracked)
- Production: `ContractDraft.mts:11` (`Draft | Unsigned`) and `ContractDraftService.mts:159-165`. `SignedContract` has no status getter. "Lapsed", "Signed awaiting payment" and "Active" are unreachable through any query.
- Effect on strategy: tests of `SignedContract` can only verify state through events. Facade-level state tests (the recommended level for the draft) aren't possible for the later stages until such a query exists.
