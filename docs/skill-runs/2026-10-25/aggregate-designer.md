# Aggregate Designer review: Contracting

Skill: `~/.claude/skills/aggregate-designer/SKILL.md`. It is a wizard for designing models, so I used it as a review. For each target I walk through Phases 1–9 (fit check, commands, conflict matrix, sequencing, volume, data scope, boundary, locking, final model) and derive the model from the requirements. Then I compare that model to the code. Nobody was available to answer the wizard's questions, so the answers I assumed are listed under Assumptions.

Severity scale: **High**: a requirement is violated, or state can be wrong in a realistic scenario. **Medium**: a requirement gap, or a design flaw that will bite when the next stage or a real DB is added. **Low**: an inconsistency or smell, with no wrong outcome today.

## Assumptions (stand in for the wizard's questions)

1. **Volume (Phase 5)**: low. A gym sales desk produces a few contracts per minute at most. Every command concerns exactly one contract, so instances are naturally partitioned and nothing contends across instances.
2. **Signing is in person and sequential (Phase 4)**: the Sales Specialist and the Customer sign at the desk, one after the other. This follows the project decision recorded 2026-09-27 ("Contracting has no aggregates … revisit only if remote/asynchronous signing appears"). Conflicts between the two signatures are therefore treated as *eliminated by business process*. Each finding notes when that assumption decides its severity.
3. **Only the Sales Specialist edits a draft**. The Potential Customer does not edit it from a separate channel at the same time.
4. **Payment system delivery**: callbacks are at-least-once and may arrive out of order. This is typical for payment providers but the requirements do not state it. Customer retries (FR-C12) create several payment attempts per contract.
5. **Target A requirements**: `docs/domain.md` at 290ff38 exists, so it is the baseline. The current `architecture/functional-requirements.md` is cited only as hindsight and marked as such.
6. **Persistence**: the review assumes a real store eventually loads independent copies, unlike the in-memory repo, which returns the same object reference.
7. When the wizard asks to confirm a list or matrix, I treated my inference as confirmed.

---

## Target A: `src/contracting/unsigned-contract/` at 290ff38

Files: `UnsignedContract.mts`, `events.mts`, `__tests__/UnsignedContract.spec.mts`.
Requirements (`docs/domain.md` @290ff38, lines 37–51): actors are the Sales specialist and the Potential Customer. Policies: the company representative has signed, and the potential customer has signed. Event: "Contract Signed" once both parties have signed.

### Phase 1: fit check

The core test asks whether the data behind "is this signature the second one?" can change concurrently. It can only if the two signatories act at the same moment on the same contract. Under Assumption 2 they don't, so this is **not resource contention**: it is an entity with a two-step state machine, and no lock is needed. With remote signing the answer flips to yes (see A5).

### Phase 2: commands

| # | Command | Changes |
|---|---|---|
| 1 | Confirm service commitment (Sales Specialist) | records the company signature |
| 2 | Accept terms and conditions (Customer) | records the customer signature |
| — | `toSignedContract` | **not a command in the domain.** The domain says Contract Signed fires *once both parties signed*. Promotion is a consequence of command 1 or 2, not a separate request. |
| — | Contract Signed | event (output) |

### Phase 3: conflict matrix

| A | B | Conflict? | Why |
|---|---|---|---|
| confirm | confirm | Self, retry only | Same actor double-submits; an idempotency concern |
| accept | accept | Self, retry only | Same as above |
| confirm | accept | YES (theoretical) | Each must decide "am I the second signature, so emit Contract Signed?" by reading the other's status |
| toSignedContract | any | n/a | Should not exist as a command |

Phase 4: confirm × accept is a theoretical conflict, eliminated by in-person signing (Assumption 2).

### Phase 6: data scope

| Command | Data needed to decide |
|---|---|
| confirm | has sales signed? has customer signed? |
| accept | has customer signed? has sales signed? |

Each signature is an independent fact, so the minimum shape is **two independent optional dates**, not one exclusive state. `personId` and `fees` are not needed by any decision. They are pass-through payload for the event.

### Phase 9: derived model

```
┌────────────────────────────────────────────────────┐
│     Unsigned Contract [per contract]  (entity)     │
│                                                    │
│  → Confirm service commitment (Sales Specialist)   │
│  → Accept terms and conditions (Customer)          │
│  ───────────────────────────────────────────────── │
│  ⚡ Each signature recorded at most once           │
│  ⚡ Contract Signed emitted exactly once, on the   │
│    second signature                                │
│                                                    │
│  Locking: none (in-person, sequential signing).    │
│  If remote signing: optimistic version per contract│
└────────────────────────────────────────────────────┘
          ○ toSignedContract    — not a domain command; promotion = 2nd signature
          ○ personId, fees      — payload only, no invariant reads them
```

Fields: `contractId` (identity, for the event), `salesConfirmedAt?`, `customerAcceptedAt?`, plus `personId` and `fees` as carried payload.

### Comparison: findings

#### A1. Contract Signed is emitted twice when the customer signs first. **High**
- `UnsignedContract.mts:39-51`: when `confirmServiceCommitmentBySalesSpecialist` runs in state `AcceptedByCustomer`, it pushes `contractSigned`.
- `UnsignedContract.mts:73-88`: `toSignedContract` pushes `contractSigned` again whenever the state is `Signed`.
- Scenario: the customer accepts, then sales confirms (event #1), then the caller calls `toSignedContract()` (event #2). `pullEvents()` returns two `ContractSigned` events for one contract. The domain says "once both parties signed", which means exactly once (made explicit later as FR-C08).

#### A2. Emission depends on signing order (the sales-first path emits only via `toSignedContract`). **High**
- `UnsignedContract.mts:65-67`: the `ConfirmedBySales → Signed` transition in `acceptTermsAndConditionsByCustomer` emits nothing. Lines 39-51, the mirror transition, do emit.
- Scenario: sales confirms, then the customer accepts. No event fires until someone calls `toSignedContract`. If the orchestrator relies on the signature commands alone, the sales-first contract never produces Contract Signed. If it always calls `toSignedContract`, the customer-first contract produces two (A1). No caller policy is correct for both orders.
- Root cause: per the derived model, the event belongs to the second signature, and `toSignedContract` should not exist as a separate command.

#### A3. `toSignedContract` is repeatable and emits on every call. **High**
- `UnsignedContract.mts:73-91`: there is no state change after promotion, so the `Signed` state is never left.
- Scenario: a retried handoff (orchestrator crash after `pullEvents`, then a retry) calls `toSignedContract()` twice and gets two `ContractSigned` events. Even without the concurrency problem, the exactly-once guard is missing in the sequential case.

#### A4. Two independent signatures are encoded as one exclusive state field. **Medium**
- `UnsignedContract.mts:8-12, 21`: `Pending | ConfirmedBySales | AcceptedByCustomer | Signed` is a single slot that both commands overwrite.
- Scenario 1 (data loss, sequential): `Signed.at` stores only the second signature's date (`:40`, `:66`). The first signatory's date is gone, so an audit of "when did the company sign?" cannot be answered.
- Scenario 2 (concurrent, only if signing is remote; see A5): both commands load `Pending`. Sales saves `ConfirmedBySales`, then the customer saves `AcceptedByCustomer`. Last write wins, one signature is silently lost, and neither path ever reaches `Signed`.
- The derived model's two independent optional fields make the "both signed" check a pure derivation. They keep both dates and shrink the race to the emit decision alone.

#### A5. Concurrency safety rests on an unstated process assumption. **Low** (in-person) / **High** (if remote)
- `UnsignedContract.mts:32-71`: there is no version or concurrency token. That is correct under the 2026-09-27 decision.
- Scenario: if the customer accepts on a phone or link while sales confirms in the back office, the confirm × accept conflict from Phase 3 becomes real. The result is the lost update from A4, or a duplicate or missing Contract Signed when both read the other's signature as absent. The code and the domain doc at 290ff38 don't record the assumption that rules this out. Per the skill (Phase 4), a process-eliminated conflict should be documented as such.

#### A6. Contract Signed carries no contract identity. **Medium**
- `events.mts:9-12`: the payload is `{ personId, fees }`, and `UnsignedContractProps` (`UnsignedContract.mts:14-17`) has no ID.
- Scenario: one person has two contracts (renewal, or a second membership type). A consumer receiving `ContractSigned` cannot tell which contract was signed. Hindsight: the later FR-C01 makes this explicit. The derived model needs `contractId` because the unit is "per contract", and the code has no key to partition on.

#### A7. Error shapes are inconsistent across commands. **Low**
- `UnsignedContract.mts:34, 54, 59, 69` return `err("INVALID_STATE")` (a string). `:75` returns `err({ code: "NOT_FULLY_SIGNED" })`.
- Scenario: the test helper `failWith` (`src/utils/test.mts:19-26` @290ff38) requires `{ code }`, so a second-signature rejection cannot be asserted with it. Callers have to branch on two error shapes.

#### A8. The tests cover only one signing order and never assert event cardinality per order. **Medium**
- `__tests__/UnsignedContract.spec.mts:28-66` covers only sales-first followed by `toSignedContract`. No test covers customer-first (which exposes A1), a double call of `toSignedContract` (A3), or a repeated signature (`INVALID_STATE`).
- The skill's Optional C asks for one test per conflict-matrix cell. The confirm × accept cell in both orders is missing.

#### A9. The event factory reads the clock implicitly. **Low**
- `events.mts:17`: `occurredAt = LocalDate.today()` is the default. Every current call site passes `at`, but a call without it silently uses the wall clock, outside the domain's control.

---

## Target B: current working tree, `src/contracting/draft/` and `src/contracting/signed-contract/`

Requirements: `architecture/functional-requirements.md` (FR-C01…FR-C17, Published language, Decisions).

### Phase 1: fit check

- **Draft**: one actor (the Sales Specialist) creates, corrects, and prepares. There is no concurrent contention, so it is an entity, consistent with the project decision. The only self-conflict is a double-submit of `prepare`, which is an idempotency concern.
- **Signed Contract**: here there *are* concurrent writers to the same contract: the external payment system (possibly redelivering and out of order) and Customer retries (FR-C12). Per the skill's Phase 2, though, Payment Confirmed and Payment Failed are **facts** recorded from an external system, not commands that need permission. The skill's answer is not a lock. It is to record the facts without guarding them (idempotent by payment reference) and derive the status from them. The code models them as guarded commands that can be refused and that overwrite each other. That is the central finding (B1).

### Phase 2: commands

| Stage | Command / fact | Kind | In code? |
|---|---|---|---|
| Draft | Create draft (FR-C02, C03) | command, new instance | `ContractDraftService.mts:67-134` |
| Draft | Correct draft data (FR-C04) | command | **missing** |
| Draft | Prepare: run validation policy, emit Contract Prepared (FR-C05, C06) | command | `ContractDraft.mts:53-85` |
| Signed | Request payment (FR-C10) | command (outbound to payment system) | **missing** |
| Signed | Payment Confirmed (FR-C11) | **fact** | `recordPaymentAccepted`, `SignedContract.mts:62-79` (guarded) |
| Signed | Payment Failed (FR-C11) | **fact** | `recordPaymentRejected`, `SignedContract.mts:81-98` (guarded) |
| Signed | Start contract (start policy, FR-C13) | policy reaction to Payment Confirmed | `toActiveContract`, `SignedContract.mts:41-60` |
| — | Contract status (FR-C16) | query | `contractStatus`, `ContractDraftService.mts:159-165` |

### Phase 3: conflict matrix

| A | B | Conflict? | Why |
|---|---|---|---|
| prepare | prepare | Self, double-submit | Both copies see `Draft`, both emit Contract Prepared |
| correct | prepare | YES (theoretical) | Prepare could validate data being replaced. Eliminated by single-actor process (Assumption 3) |
| create | anything | NO | New instance |
| payment confirmed | payment confirmed (same ref) | Self, redelivery | Duplicate callback |
| payment confirmed (ref 2) | payment failed (ref 1) | YES, realistic | Customer retried after a failure. The late failure for attempt 1 races the success for attempt 2 |
| payment failed | payment failed | NO | Each failure is its own fact |
| request payment | payment facts | NO* | Different data. The request only records a new reference |
| start | payment confirmed | Sequential dependency | Start is a reaction, not a concurrent command |
| start | start | Self, retry | Contract Started must be exactly once (FR-C13) |

Phase 4: correct × prepare is eliminated by process. Payment confirmed × payment failed is **not** eliminated: the payment system controls timing, not the business process.

### Phase 6: data scope

| Decision | Minimum data |
|---|---|
| prepare | ID info + attestation, birth date, guardian minor ID, fee amounts, `asOf`, current status |
| record payment fact | set of known payment references (for idempotency) |
| derive "paid" | does any recorded fact say Confirmed? |
| start | paid? already started? |

Draft fields not read by any invariant: `offer.offerId`, `durationInMonths`, `servicePackage`. They are snapshot payload for the handoff (FR-C03). Carrying them costs nothing because there is no contention. That's fine.

### Phase 9: derived model

```
┌──────────────────────────────────────────────┐
│  Contract Draft [per contract]  (entity)     │
│  → Create draft                              │
│  → Correct draft data                        │
│  → Prepare                                   │
│  ─────────────────────────────────────────── │
│  ⚡ Contract validation policy as of asOf     │
│  ⚡ Contract Prepared exactly once            │
│  Locking: none (single actor); idempotent    │
│  prepare                                     │
└──────────────────────────────────────────────┘
           │ handoff via process/ (contract ID, offer terms, preparation date)
           ▼
┌──────────────────────────────────────────────┐
│  Signed Contract [per contract]  (entity)    │
│  → Request payment (new paymentRef)          │
│  → Start contract (reaction to first         │
│    Payment Confirmed)                        │
│  ─────────────────────────────────────────── │
│  ⚡ Contract Started exactly once             │
│  ⚡ Paid ⇔ some recorded Payment Confirmed    │
│  Locking: none needed if facts are           │
│  append-only and keyed by paymentRef         │
└──────────────────────────────────────────────┘
   ○ Payment Confirmed / Payment Failed — facts, recorded unguarded,
     idempotent by paymentRef, never refused, never overwrite each other
   ○ Contract status — query
```

Fields (Signed): `contractId`, `personId`, `fees`, `durationInMonths`, `servicePackage`, `signedAt`, `payments: {ref, outcome?, at}[]`, `startedAt?`.

### Comparison: findings

#### B1. Payment outcomes are modelled as guarded, mutually exclusive commands instead of recorded facts. **High**
- `SignedContract.mts:22-26, 62-98`: `AwaitingPayment → PaymentAccepted | PaymentRejected` is a single slot, and each record call is refused unless the state is `AwaitingPayment`.
- Scenario 1 (sequential, violates FR-C12): attempt 1 fails, so `recordPaymentRejected` sets the state to `PaymentRejected`. The customer retries and attempt 2 succeeds, but `recordPaymentAccepted` returns `NOT_AWAITING_PAYMENT` (`:66-67`). The customer has paid and the contract can never start. The test `__tests__/SignedContract.spec.mts:167` ("rejects accepting a payment after it was rejected") locks this behaviour in. FR line 130 already lists it as a gap.
- Scenario 2 (concurrent, with a real store): the success for attempt 2 and a late failure callback for attempt 1 arrive together. Both load `AwaitingPayment` and both pass the guard. Whichever saves last wins. If the failure wins, a paid contract reads as rejected, with both PaymentConfirmed and PaymentFailed emitted.
- Per the skill's Phase 2, these are facts. Recording them append-only, keyed by `paymentRef`, with "paid" derived as "any confirmed", removes the conflict without a lock.

#### B2. A payment failure is not correlated to a payment attempt. **High**
- `SignedContract.mts:81-84, 25`: `recordPaymentRejected` takes no `paymentRef`, and `PaymentRejected` state stores none. `events.mts:26-29` PaymentFailed has no reference either.
- Scenario: with retries (FR-C12) there are several attempts. A failure callback can't be matched to its attempt, so a late failure for attempt 1 cannot be told apart from a failure for the current attempt, and redeliveries cannot be deduplicated.

#### B3. Recording a duplicate Payment Confirmed is an error, not a no-op. **Medium**
- `SignedContract.mts:66-67`: a second `recordPaymentAccepted` with the same `paymentRef` returns `NOT_AWAITING_PAYMENT`. `__tests__/SignedContract.spec.mts:146` asserts that.
- Scenario: the payment system redelivers a webhook (at-least-once delivery). The ACL receives an error for a fact it already recorded and may retry or dead-letter forever. With independent loaded copies, two concurrent redeliveries both pass the guard and emit PaymentConfirmed twice. Recording should be idempotent per reference.

#### B4. No contract ID in the Signed Contract or in any of its events (FR-C01). **High**
- `SignedContract.mts:12-16` (props), `events.mts:9-12, 27-29, 45-50` (PaymentConfirmed, PaymentFailed, ContractStarted payloads) contain only `personId`.
- Scenario: Pass Registration consumes ContractStarted for a person with two contracts. It cannot tell which contract started, and FR-C01 ("every event … carries the contract ID") is violated. The payment ACL also cannot route a callback to a contract without the ID. The consistency unit is "per contract", but the code has no key to partition on.

#### B5. Contract Prepared lacks contract ID and offer terms (FR-C01, published language). **Medium**
- `draft/events.mts:8-11` payload is `{ personId, fees }`, built at `ContractDraft.mts:82`. The draft *does* hold `id` (`:16`) and the full `OfferSnapshot` (`:17`), but neither reaches the event.
- Scenario: the frontend, the documented consumer, receives Contract Prepared and cannot show which contract it is, or the duration and service package. The published-language table (FR line 74) requires "contract ID, customer, offer terms".

#### B6. Contract Started payload omits service package and contract ID required by Pass Registration. **Medium**
- `events.mts:44-50`: the payload is `personId, fees, startDate, endDate`. `SignedContractProps` (`SignedContract.mts:12-16`) has no `servicePackage`, so the data cannot be supplied.
- Scenario: Pass Registration needs the service package to decide pass type (FR line 76, open question 7) and receives none. The field has to travel from `OfferSnapshot.servicePackage` (`draft/OfferSnapshot.mts:12`) through the handoff.

#### B7. The draft is not correctable (FR-C04). **Medium**
- `ContractDraft.mts:41` makes `props` readonly. The class (`:40-108`) and the service (`ContractDraftService.mts`) expose only create, prepare and status. There is no command to supply or fix data.
- Scenario: `prepare` fails with `ID_NOT_ATTESTED` or `MINOR_REQUIRES_GUARDIAN`. The Sales Specialist cannot add the attestation or co-signature to this draft and has to create a new one, which gets a new contract ID (`ContractDraftService.mts:117`). The old draft stays in `Draft` forever. This is also where the only draft-level conflict (correct × prepare) would live. It is safe under Assumption 3, but the command has to exist first.

#### B8. Preparation date (start of the signing window) is not retained on the draft. **Medium**
- `ContractDraft.mts:11, 80`: `{ kind: "Unsigned" }` carries no date. The date exists only as `occurredAt` (an Instant) on the transient event (`:82`).
- Scenario: the signing policy (FR-C09, 30 days from preparation) needs the preparation date as a `LocalDate` in the gym time zone. Once the event has been pulled, reloading the draft gives no way to compute the window. The next stage would have to re-derive a date from an Instant, which CONTEXT.md:20 explicitly forbids for domain objects.

#### B9. `prepare` is guarded only by in-memory aliasing against double-submit. **Low**
- `ContractDraft.mts:60` checks `ALREADY_PREPARED` against loaded state. `ContractDraftRepository.mts:19-25` returns the *same* object instance on every `get`.
- Scenario: the Sales Specialist double-clicks "prepare". In memory, the second call sees the mutated shared instance and gets `ALREADY_PREPARED`, so AC-PC-14 passes. With a real store, both requests load independent `Draft` copies, both pass, and both emit Contract Prepared. An idempotency key or a conditional status update closes this; no aggregate lock is needed. This is related to the existing task `docs/tasks/in-memory-repo-aliasing.md`.

#### B10. Lifecycle state is duplicated across stages. **Low**
- `ContractDraft.mts:11` (`Unsigned` lives inside the draft), and `SignedContract.mts:26, 47` (`Active` inside the signed contract) while a separate `active-contract/` stage exists. `ContractDraftService.mts:159-165` answers the status query from the draft repository only.
- Scenario: after handoff, the draft says `Unsigned` forever, while the unsigned and signed stages hold the real status. FR-C16 (status: Draft, Unsigned, Lapsed, Signed awaiting payment, Active) has no single source. The orchestrator that would own the handoff (`src/contracting/process/`, CONTEXT.md:15) does not exist.

#### B11. Missing Request payment command; payment reference originates outside the entity. **Medium**
- `SignedContract.mts` has no command for FR-C10 ("Contracting issues the payment request; it stores … the payment reference"). The `paymentRef` first appears as an argument to `recordPaymentAccepted` (`:63`).
- Scenario: a callback arrives with a reference that Contracting never issued, for example a spoofed or misrouted webhook. The entity accepts it as payment because it has no record of issued references to check against.

#### B12. The start policy is a free-standing command with a caller-supplied start date. **Low**
- `SignedContract.mts:41-44`: `toActiveContract(at, startDate)` accepts any `startDate`, unrelated to the payment confirmation. The exactly-once guard (`:45-47`) holds sequentially.
- Scenario: the orchestrator passes a start date before the payment, or calls start twice concurrently against independent copies. That produces a wrong end date (FR-C14) or a duplicate Contract Started (FR-C13). Open question 3 (which date the contract starts on) is unresolved. Until it is, the start date should derive from the Payment Confirmed fact, not a free parameter.

#### B13. Snapshot invariants are weaker in the entity than in the requirement. **Low**
- `ContractDraft.mts:66-69`: `expiry?.isBefore(asOf)` passes when the expiry is absent, while `GovernmentIdInfo.mts:9` has `expiryDate?` as optional. FR-C05 requires the expiry date to be present. Only the service (`ContractDraftService.mts:88-89`) guarantees it.
- `ContractDraftService.mts:110`: the guardian co-signature `signedAt` is set to the draft-creation `asOf` rather than when the guardian signed.
- `SignedContract.mts:15`: `durationInMonths: number` is not constrained to 1/3/6/12 (FR-C03).
- Scenario: a second caller of `ContractDraft.create` (for example the future correction path, B7) supplies an ID without expiry and the draft prepares.

#### B14. Two fee models across the handoff. **Low**
- `draft/OfferSnapshot.mts:3-7` (`OfferFees`, plain Money with penalties) vs `SignedContract.mts:4, 14` (`#/money/FeeStructure`).
- Scenario: the orchestrator has to convert one into the other. Penalty items or currency can be dropped in that conversion without any check. FR line 127 already lists this gap.

#### B15. Signed date not retained for reporting. **Low**
- `SignedContractProps` (`SignedContract.mts:12-16`) has no `signedAt`.
- Scenario: FR-C17 ("contracts signed in a given period") cannot be answered from the Signed Contract. It needs a separate projection of Contract Signed events, and that event has no contract ID either (B4, A6).

### Excluded intentionally (per the skill)

- Version fields and optimistic locking on Draft and Signed Contract: not needed. Under Assumptions 1–3 there is no multi-actor contention, and B1's race is removed by modelling payment outcomes as facts rather than by locking.
- `offerId`, `durationInMonths`, `servicePackage` on the draft: carried for the handoff, read by no invariant, harmless because nothing contends.
