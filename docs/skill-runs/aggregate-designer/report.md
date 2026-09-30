# Aggregate Designer — Contract lifecycle, Offer review, Pass registration

Input: `architecture/functional-requirements.md`, `architecture/offering-user-stories.md`, `docs/domain.md` (Pass Registration rules), current code.
Mode: non-interactive. Every AskUserQuestion was answered by the agent. Answers are marked **inferred** (docs/code) or **assumed** (confirm).

> Tension with an existing decision: the project memory says "Contracting has no aggregates — no concurrent contention; no locking". This run reaches the same conclusion **only if** assumptions A1 and A2 below hold. If either is false, a version check per contract is the cheapest fix. That is still not an aggregate framework.

## Phase 1: Fit check

| Area | Can checked data change concurrently? | Result |
|---|---|---|
| Draft create/correct/prepare | No — single owner, rules check the draft's own data (**assumed**: one Sales Specialist per draft) | CRUD + validation. Not an aggregate |
| Signing | Two actors write the same signing state (**inferred**, FR-C07) | Uncertain → proceed |
| Payment + start | Payment callbacks and customer retries write the same payment state (**inferred**, FR-C11/C12) | Uncertain → proceed |
| Offer review | Specialist edits vs Coordinator decides (**assumed**, OF-1 "edited freely") | Uncertain → proceed |
| Pass registration | "No other active pass of the same type" — per customer, fed by events | Uniqueness rule → DB constraint (see end) |

## Phase 2: Commands

**Contract (per contract ID)**

1. `correctDraft` — changes draft data (FR-C04)
2. `prepareContract` — runs the validation policy, sets Prepared, starts the signing window (FR-C05/C06)
3. `confirmServiceCommitment` — Sales Specialist signature (FR-C07)
4. `acceptTerms` — Customer signature (FR-C07)
5. `requestPayment` — issues a payment request to the payment system (FR-C10/C12)
6. `recordPaymentConfirmed` — **fact** from the payment system. It's kept on the list because it triggers the start policy, and "Contract Started exactly once" is an invariant (FR-C13)
7. `recordPaymentFailed` — **fact**; kept for its ordering interaction with 6

Set aside:
- Lapse: time-derived, not a command. Evaluate it when signing and when reading status (see requirements-critic FR-C09).
- Status and count: queries.

**Offer (per offer ID)**: `editOffer`, `submitForReview`, `approve`, `reject`, `correctAndResubmit`, `publish`.

## Phase 3: Pairwise conflicts — Contract

| Command A | Command B | Conflict? | Why |
|---|---|---|---|
| correctDraft | correctDraft | NO | Descriptive last-write-wins; no invariant |
| correctDraft | prepareContract | YES | Prepare validates data that a correction is changing |
| prepareContract | prepareContract | YES (self) | Double-click → two Contract Prepared, two signing-window starts |
| confirmServiceCommitment | acceptTerms | YES | Both read "other side not signed" → neither emits Contract Signed (lost update), or both do |
| confirmServiceCommitment | confirmServiceCommitment | YES (self) | After acceptTerms, two confirms both see AcceptedByCustomer → Contract Signed twice |
| acceptTerms | acceptTerms | YES (self) | Mirror of the above |
| requestPayment | requestPayment | YES (self) | Two pending requests → double charge |
| requestPayment | recordPaymentConfirmed | YES | Retry issued while a confirmation is in flight |
| recordPaymentConfirmed | recordPaymentConfirmed | YES (self) | Duplicate callback → Contract Started twice. Parameter-dependent: same payment ref = duplicate, different ref = double payment |
| recordPaymentConfirmed | recordPaymentFailed | YES | Late Failed from an old attempt after Confirmed |
| any draft command | any signing command | NO* | Stage order: signing only exists after Prepared |
| any signing command | any payment command | NO* | Stage order: payment only after Signed |

Notes:
- **Self-conflict** is the dominant pattern: double-clicks and duplicate callbacks, not two humans fighting.
- **Parameter-dependent**: payment confirmations conflict per contract, not globally, so contracts are naturally partitioned.
- **No time-range trap** — no overlapping ranges.
- **Transitivity**: the three clusters (draft / signing / payment) never touch, because stages are strictly sequential.

## Phase 4: Process sequencing

| Pair | Answer | Basis |
|---|---|---|
| correctDraft × prepareContract | Process separates them | **assumed**: the same Sales Specialist in one UI session |
| prepareContract × itself | Genuine (double-click) | Guarded by status check; the race window is milliseconds |
| confirm × accept | **Separated if both sign at the desk (A1)**; genuine if the Customer signs remotely | **assumed**: in person — confirm |
| requestPayment × itself / × confirmed | Genuine | Customer-driven, async callbacks |
| confirmed × confirmed | Genuine | Payment providers redeliver callbacks. **A2**: deduplicate by payment reference |

## Phase 5: Volume

- Low — a gym prepares tens of contracts a day at most (**assumed**).
- Commands are naturally partitioned per contract; no cross-instance contention.

## Phase 6: Minimum data per command

| Command | Data needed to decide |
|---|---|
| prepareContract | draft status, ID info + attestation, birth date, guardian co-signature, fee structure, preparation date |
| confirmServiceCommitment / acceptTerms | signing state (who signed), preparation date (window) |
| requestPayment | stage = Signed, pending payment ref (or none), started flag |
| recordPaymentConfirmed | payment ref, pending ref, started flag |
| recordPaymentFailed | payment ref, pending ref |

**Collection note**: payment state needs the current pending ref plus a set of already-processed refs. It does not need a payment history.

## Phase 7: Inclusions / exclusions

| Item | Decision |
|---|---|
| Offer snapshot (durations, services, fees) in the signing/payment unit | Exclude. Immutable after preparation, so no rule changes it concurrently |
| Customer personal data | Exclude. Only the draft's validation reads it |
| Signing window check | Keep in the signing step, but it reads an immutable preparation date. No lock needed for the check itself |

## Phase 8: Locking

- **Recommendation**: optimistic — one `version` per contract, checked on save. Collisions are rare and a retry is harmless.
- **Alternative with no locking** (matches the memory decision), valid if A1 and A2 hold:
  - Signatures are collected sequentially in one session.
  - Payment outcomes are deduplicated by a unique `(contractId, paymentRef)` record.
  - "Started" is a unique `(contractId)` record.

  Then the database enforces the exactly-once rules and no version field is needed.
- **Consistency**: immediate, within one contract. Nothing spans two contracts.

## Phase 9: Final model

### Boundary diagram

```
┌──────────────────────────────────────────────┐
│      Contract Signing  [per contract]         │
│  → confirmServiceCommitment                   │
│  → acceptTerms                                │
│  ──────────────────────────────────────────── │
│  ⚡ each party signs at most once              │
│  ⚡ Contract Signed emitted exactly once       │
│  ⚡ both signatures within 30 days of prep.    │
│  Locking: optimistic (version) — or none if A1│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│      Contract Payment  [per contract]         │
│  → requestPayment                             │
│  → recordPaymentConfirmed                     │
│  → recordPaymentFailed                        │
│  ──────────────────────────────────────────── │
│  ⚡ at most one pending payment request        │
│  ⚡ a payment ref is processed once            │
│  ⚡ Contract Started emitted exactly once      │
│  Locking: optimistic (version) or unique keys │
└──────────────────────────────────────────────┘
      ○ correctDraft / prepareContract — single owner, status guard is enough
      ○ status / count queries         — T&P read model
      ○ offer snapshot                 — immutable after preparation
```

Signing and Payment are the same contract row at different stages. They're drawn separately because their invariants never interact, so a stage-per-entity split (current code: `UnsignedContract`, `SignedContract`) is consistent with this model.

### Consistency Unit: Contract Signing

**Root**: Unsigned Contract

| Command | Invariant | Data |
|---|---|---|
| confirmServiceCommitment | not already confirmed; within window; emit Signed iff customer already accepted | signing state, preparation date |
| acceptTerms | not already accepted; within window; emit Signed iff sales already confirmed | signing state, preparation date |

Fields: `signingState {salesConfirmedAt?, customerAcceptedAt?}`, `preparationDate`, `version`.

### Consistency Unit: Contract Payment

**Root**: Signed Contract

| Command | Invariant | Data |
|---|---|---|
| requestPayment | no pending request; not started | pendingRef?, started |
| recordPaymentConfirmed | ref not processed; if not started → start and emit Contract Started once | processedRefs, started |
| recordPaymentFailed | ignored if the ref is not the pending one or is already processed | pendingRef, processedRefs |

Fields: `pendingPaymentRef?`, `processedPaymentRefs: string[]`, `startedAt?`, `version`.

### Excluded intentionally

| Item | Reason |
|---|---|
| Draft data and validation | Single owner; checks input only |
| Offer terms snapshot | Immutable after preparation |
| Lapse | Derived from preparation date + clock |

### Open design decisions

- A1: are signatures ever collected remotely? If yes, the version check on Unsigned Contract is required.
- A2: what does the payment system guarantee about redelivery and ordering of callbacks?
- A second confirmation with a different payment ref (a real double payment) — refund flow owner?

## Code observations (current `src/contracting`)

These are what the conflict matrix predicts, checked against the code:

- `UnsignedContract.confirmServiceCommitmentBySalesSpecialist` emits Contract Signed when the Customer signed first. `acceptTermsAndConditionsByCustomer` does not emit when Sales signed first. `toSignedContract` emits again. Result: 0, 1 or 2 events depending on order. This violates "exactly once" even without concurrency (already listed in the FR implementation gaps).
- `SignedContract.recordPaymentRejected` moves to `PaymentRejected`, after which `recordPaymentAccepted` is ignored (`state.kind !== "AwaitingPayment"`). A retry can never succeed, which contradicts FR-C12.
- `recordPaymentAccepted` has no payment-ref dedupe, but it's guarded by state, so a duplicate is ignored. That works for the same ref and silently drops a different ref (a double payment goes unnoticed).

---

## Offer review (per offer)

| Command A | Command B | Conflict? | Why |
|---|---|---|---|
| editOffer | approve | YES | Coordinator approves content that changed after evaluation |
| approve | reject | YES | Two coordinators decide simultaneously |
| approve | approve | YES (self) | Offer Approved twice |
| publish | editOffer | YES | Published terms change under Contracting's snapshot reads |

Process probe: if OF-1 is rewritten so that editing is only allowed in Draft/Rejected (see requirements-critic), editOffer × approve and publish × editOffer disappear. What remains is approve/reject between coordinators: low volume, optimistic `version` per offer, or a status guard with a conditional update (`WHERE status = 'InReview'`).

## Pass registration

"The customer has no other active pass of the same type" spans passes of one customer, not one pass. The fit check says this is a uniqueness rule. Contract Started events are consumed sequentially (**assumed**), so a partial unique index `(customerId, passType) WHERE active` is enough. No aggregate is needed. Revisit if Pass Registration ever gets a manual "register pass" command that can run in parallel with the event consumer.
