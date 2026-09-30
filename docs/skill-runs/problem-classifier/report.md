# Problem Classifier — gym domain

Input: `docs/domain.md`, `architecture/functional-requirements.md` (FR-C01…C17), `architecture/offering-user-stories.md` (OF-1…OF-8), current code in `src/contracting`.
Mode: non-interactive. Questions from Step 2 were answered by the agent from the docs and code; each answer is marked **inferred** (stated in the docs/code) or **assumed** (agent's guess — confirm).

The input is composite: three subdomains, each with several operations. Classified per operation.

## Classification: Composite — CRUD-with-lifecycle + Integration, one Resource Contention hotspot per subdomain

**Confidence**: Medium. The hotspots rest on assumptions about how signatures and reviews are collected.

### Deduction trail

| # | Question asked | Answer | Signal / Implication |
|---|---|---|---|
| 1 | Is the only effect of preparing a draft that the change is shown on screen? | No — Contract Prepared is emitted and the signing window starts (FR-C06). **inferred** | Lifecycle transition, not plain CRUD |
| 2 | Can the data checked by the Contract validation policy be changed by another request during the check? | No. ID, birth date, guardian, fees all belong to the draft; only the Sales Specialist edits it. **assumed** (one specialist owns a draft) | CRUD with heavy validation + status. No aggregate needed |
| 3 | Does signing involve multiple actors on the same object? | Yes — Sales Specialist and Customer, "either may happen first" (FR-C07). **inferred** | RC signal |
| 4 | Can both signatures arrive at the same moment? | Unlikely if both sign at the desk in one session; possible if the Customer signs remotely. **assumed**: in-person, sequential | If remote: lost update → nobody emits Contract Signed, or both do. FR-C08 "exactly once" becomes an atomicity rule |
| 5 | Does payment involve an external system? | Yes, via ACL (FR-C10). **inferred** | Integration |
| 6 | Can the Customer retry payment while an earlier attempt is still pending? | Not stated. FR-C12 allows unlimited retries. **assumed**: yes | Double-charge scenario; needs idempotency / single in-flight payment |
| 7 | Do status queries (FR-C16, C17) change state? | No. **inferred** | T&P |
| 8 | Can a Sales Specialist edit an offer while a Sales Coordinator is evaluating it? | OF-1: "Draft can be saved incomplete and edited freely"; nothing forbids editing In review. **assumed**: yes | Coordinator can approve content that changed after evaluation — RC or snapshot problem |
| 9 | "Customer cannot have other active passes of the same type" — can two Contract Started events for one customer be processed simultaneously? | Only if the consumer is parallel. **assumed**: single sequential consumer | "Only one X" trap — a unique constraint suffices, not an aggregate |

### Why this class

- "Either may happen first; each happens at most once" (FR-C07) + "Contract Signed is emitted exactly once" (FR-C08) → chronological invariant across two actors.
- "The draft is correctable … until the Contract validation policy passes" (FR-C04) → input validation on a single-owner document → CRUD + status.
- "Contracting integrates through an anti-corruption layer" / "Customer may retry payment any number of times" (FR-C10–C12) → Integration with idempotency concerns.
- "Status of a particular contract", "Number of contracts signed in a given period" (FR-C16, C17) → T&P.
- OF flow "Draft → In review → Rejected ⇄ Corrected → Approved → Published" + "edited freely" → Disguised CRUD.

### What NOT to do

Don't wrap every contract stage in an aggregate with optimistic locking. Only the signing step (and, in Offering, review/approval) has a plausible race. Everything else is single-owner CRUD with validation, and the existing memory note (Contracting has no aggregates) holds for it.

### Suggested approach

1. Contract draft: a plain entity with validation; the policy is a pure function over the draft's own data.
2. Signing: keep it an entity, but store a version and reject a stale save. That's one column and one check, not an aggregate framework. Skip it only if you confirm both signatures are collected in one session.
3. Payment: model "payment requested" with a reference and accept at most one confirmation per contract; treat duplicate confirmations as idempotent no-ops.

### Open questions before modeling

- Are signatures always collected in the same session at the desk, or can the Customer sign remotely?
- Can a payment retry be issued while a previous payment request is still unresolved?
- Is editing an offer allowed while it is In review?

---

## Suggested decomposition

| Component | Class | Rationale |
|---|---|---|
| Contract draft (create, correct) | CRUD with validation | Single owner, all checked values in the draft |
| Contract validation policy → Contract Prepared | CRUD + lifecycle status | Transition gated by input-only rules |
| Signing (two signatures, 30-day window) | Resource Contention (low) | Two actors, exactly-once event |
| Payment request / outcome | Integration | External system, ACL, retries, callbacks |
| Contract start policy → Contract Started | Integration (choreography) | Reacts to Payment Confirmed; published to Pass Registration |
| Contract status, signed-count queries | T&P | Derivable read models |
| Offer descriptive fields (name, durations, facilities, fees) | CRUD | Notebook data |
| Offer review state machine | Resource Contention (low) | Coordinator decides on content the Specialist can change |
| Published offers / offer details (OF-7, OF-8) | T&P | Read model for Contracting |
| First payment total, penalty total (`src/money`) | T&P | Pure calculation, no state |
| Pass registration: one active pass per type | CRUD + unique constraint | Rule enforced on insert, sequential consumer |

Do not model them together in one class — it will force domain logic into the CRUD layer or vice versa.

## Component relationship diagram

```
 Offering                         Contracting                                   Pass Registration
┌───────────────────┐            ┌──────────────────────────────┐
│ Offer (CRUD)      │            │ Draft (CRUD+validation)      │
│   │ edited(what)  │  OF-7      │   │ Contract Prepared         │
│   ▼               │  query     │   ▼                           │
│ Review SM (RC)    │──────────▶ │ Unsigned (RC: 2 signers)      │
│   │ Offer Publ.   │ (snapshot) │   │ Contract Signed (once)    │
│   ▼               │            │   ▼                           │        Contract Started
│ Published Offers  │            │ Signed ──pay cmd──▶ [Payment system]──┐ ─────────────────▶ ┌──────────────┐
│ read model (T&P)  │            │   ▲   ◀──Confirmed/Failed─────────────┘                      │ Pass (CRUD + │
└───────────────────┘            │   │ start policy                │                              │ unique idx)  │
                                 │ Active                          │                              └──────────────┘
                                 │   │                             │
                                 │   ▼ Status / Count (T&P)        │
                                 └──────────────────────────────┘
```

## Resource Contention — next step offer

Answered: **yes** — `aggregate-designer` was run on the signing step and the offer review. See `docs/skill-runs/aggregate-designer/`.
