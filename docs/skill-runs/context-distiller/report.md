# Context Distillation: Gym management (Offering, Contracting, Pass Registration, Locker)

Input: `docs/domain.md`, `architecture/functional-requirements.md`, `architecture/offering-user-stories.md`, `src/contracting/LANGUAGE.md`, `src/sandbox/locker/SPEC.md`, current code.
Mode: full domain distillation, non-interactive. Step 3 questions were answered by the agent. Each boundary decision carries its source: **(R)** requirements, **(A)** answered by agent — confirm, **(L)** linguistic analysis, **(X)** silent assumption.

## Linguistic Analysis Summary

### Nouns and verbs (Step 1, condensed)

| Noun | Appears in | Verbs acting on it |
|---|---|---|
| Offer | Offering, Contracting (read model) | draft, submit, evaluate, reject, correct, approve, publish, query |
| Fee structure / monthly dues / enrollment fee / penalties | Offering, Contracting, `src/money` | define, snapshot, validate, pay, (charge — implied) |
| Contract (Draft/Unsigned/Signed/Active) | Contracting | prepare, correct, validate, sign, lapse, pay, start, terminate (rule only) |
| Customer / Potential Customer | Contracting, Offering ("customers can see it"), Payment, Pass Registration | accept terms, pay, hold pass |
| Guardian | Contracting | co-sign |
| Sales Specialist / Sales Coordinator | Offering, Contracting | draft, publish, confirm commitment, attest ID / evaluate, approve, reject |
| Signature / consent | Contracting | confirm, accept, co-sign |
| Pass (type) | Pass Registration | register, cancel, expire |
| Locker | Locker sandbox | assign, release |
| Service package / facility | Offering, Contracting (snapshot), Pass Registration (payload) | select, snapshot, grant access |
| Person / Member | Locker ("members can rent"), code `PersonId` everywhere | identify |

### Ambiguities Detected (one word → multiple meanings)

| Word | Context A | Meaning A | Context B | Meaning B | Resolution |
|---|---|---|---|---|---|
| Customer | Contracting | Party legally bound by the contract (may be a minor) | Payment | The one who pays. For a minor, realistically the Guardian | **Split**: Customer (Contracting) vs Payer (Payment/Billing). FR-C10 "the Customer pays" is wrong for minors (A) |
| Customer | Offering | Market audience ("customers can see it") | Pass Registration | Holder of a pass | Split: Offering has no customer concept (L); Pass Registration uses Pass Holder |
| Fee structure | Offering | Price list the gym offers, editable until publish | Contracting | Agreed obligation, frozen snapshot (FR-C03) | **Representation change**: Offering `FeeSchedule` vs Contracting `AgreedFees`. Today both are `@/money/FeeStructure` (L) |
| Penalty | Offering | Line in a price list | Contracting / Billing | Charge that becomes due on an event (late payment, early termination) | Split: definition in Offering, occurrence in Billing (L) |
| Draft | Offering | Offer awaiting human review; Rejected ⇄ Corrected loop | Contracting | Contract awaiting automatic policy; correctable | Same word, different processes. **Keep separate models**; no cross-context "Draft" abstraction (Principle 4) (L) |
| Active | Contracting | Paid contract in force | Pass Registration | Pass currently usable ("no other active pass of the same type") | Split, already done by decision D4 (R) |
| Signature | Contracting (FR-C08) | Either party's consent at signing | Code `Signature.mts` | Generic VO {signer, date}, unused | See generalization G2 |
| Person / Member | Locker SPEC | Anyone staff hands a locker to ("members") | Contracting | Potential Customer / Customer / Guardian / Sales Specialist, all as `PersonId` | Split: identity (Party) vs roles per context (L) |

### Generalizations Detected (multiple words → one meaning)

| Words | Context | Shared Behavior | Generalized As | Technique |
|---|---|---|---|---|
| Monthly dues, enrollment fee, penalty (late, early termination, damage, admin) | Billing / Receivables | "An amount becomes due from a payer on a date, for a contract" | **Charge** {payer, contract, amount, dueDate} | Generalization (drop reason → keep amount + due date) |
| Confirm service commitment, Accept terms and conditions, Guardian co-signature | Contracting / signing | "Party P, in role R, consented to this contract on date D" | **Consent** {party, role, date} | Generalization (drop the verb, keep role + date) |
| Pass, Locker assignment | Access / Entitlements | "Person P may use facility F from–to"; issue/assign ↔ cancel/release ↔ expire | **Entitlement** {holder, facility/resource, period, type} | Abstraction (new concept) |
| Gym floor, group classes, pool, sauna, locker | Access | "Something a holder may use, gated at entry" | **Facility** | Generalization |
| Contract validation rules, Offer completeness rules | each context separately | "Rule → blocker list" | Policy/Blocker pattern | Local technical pattern only, **not** a shared context (Principle 4) |

### Proposed Additional Concepts (not in input — speculative)

| Generalization | Proposed Concept | Why It Fits | Status |
|---|---|---|---|
| Charge | Personal-training session fee | Due from payer, dated, per contract | Speculative |
| Charge | Locker rental fee | Locker is in the domain; a rental likely costs something | Speculative |
| Charge | Card/key replacement | Same shape as DAMAGE_FEE | Speculative |
| Consent | Health declaration (PAR-Q) | Party consents on a date; common gym pre-condition | Speculative |
| Consent | Marketing / GDPR consent | Same {party, date}, revocable | Speculative — but revocable, which may break the model |
| Entitlement | Guest / day pass | Access for a period without a contract | Speculative — challenges "pass requires started contract" |
| Entitlement | Class booking (group classes) | Person may use facility in a slot. Capacity-bound, so this would be the first real resource contention | Speculative |
| Entitlement | Suspension (injury, pregnancy — FR OQ8) | Not a new entitlement but a period where one is paused: same period mechanics | Speculative |

## Step 3 — questions and answers (agent-answered)

| Question | Answer | Source |
|---|---|---|
| Is "Customer" who is bound the same as who pays, for a minor? | No. The guardian pays in practice | (A) — confirm |
| In Billing, does it matter *why* an amount is due (dues vs penalty), or only *that* it is due, how much, and when? | Only that, plus a reason label for the statement | (A) |
| Does Access need to know whether an entitlement came from a contract (pass) or a staff action (locker)? | No. Only holder, facility and period | (A) — confirm |
| Is the Guardian's co-signature the same kind of act as the Customer's acceptance? | Yes in effect (consent), but it happens at a different stage (draft vs signing) | (R) FR-C05, FR-C07 + (A) |
| If a new fee type appears (e.g. freeze fee), does Billing need a new process? | No, it's just a new Charge reason | (A) |
| "It depends" answers | — | none used |

## Distilled Context Map

### Offering (specific)

**Key question**: "What can we sell, and on what terms?"

**Specific concepts**: Offer, Membership Durations, Service Package, **Fee Schedule** (price list), Completeness Policy, Review.
**Type-specific processes**: human review loop (Specialist ↔ Coordinator), publish.
**Integration**: publishes Offer Details (OHS) → Contracting snapshots them.

---

### Contracting (specific, core)

**Key question**: "Is there a binding, paid agreement between the gym and this person, and on what terms?"

**Specific concepts**: Contract stages, Potential Customer / Customer, Guardian, Sales Specialist, **Agreed Fees** (snapshot, not the price list), Contract validation policy, Signing Window, Minimum Commitment.
**Generalized inside**: **Consent** (Sales commitment, Customer acceptance, Guardian co-signature).

| Original Concepts | Generalized As | What's Kept | What's Dropped |
|---|---|---|---|
| Confirm commitment, Accept T&C, Guardian co-sign | Consent | party, role, date | UI verb, channel |

**Boundaries — does NOT know**: how payment is processed; recurring charges; pass rules; offer review history.

---

### Billing / Receivables (generalized) — **not in the docs today**

**Key question**: "How much does this payer owe, when, and has it been paid?"

| Original Concepts | Generalized As | What's Kept | What's Dropped |
|---|---|---|---|
| Monthly dues, enrollment fee, penalties | Charge | payer, contract ref, amount, due date, reason label | Offer, duration, penalty rules, why it's due |

**Commands**: raiseCharge, recordPayment, reverseCharge. **Events**: ChargeRaised, ChargePaid, ChargeOverdue.
**Boundaries — does NOT know**: contract lifecycle, offer terms, what a penalty means.

> **Gap found**: the FRs cover only the *first* payment (FR-C10: "pays for the membership"). Nothing owns monthly dues for months 2…N, late-payment penalties, or early-termination penalties. The payment system is external and only *processes* payments. This context is the missing owner. (X) → boundary-affecting, **confirm**.

---

### Access / Entitlements (generalized) — replaces "Pass Registration" as a broader context

**Key question**: "May person P use facility F right now?"

| Original Concepts | Generalized As | What's Kept | What's Dropped |
|---|---|---|---|
| Pass, Locker assignment | Entitlement | holder, facility/resource, from–to, type | contract terms, fees, why it was granted |
| Gym floor, classes, pool, sauna, locker | Facility | facility ID | description, equipment |

**Commands**: grant, revoke, expire. **Events**: EntitlementGranted/Revoked/Expired.
**Rule**: at most one active entitlement per (holder, type) — the pass rule, generalized.
**Boundaries — does NOT know**: payment, contract status beyond "Contract Started" / end date.

**Specific facets kept outside the generalization**:
- Pass: cancellation policy — 30-day minimum usage, 7-day notice, outstanding payments. **Outstanding payments reads Billing** — a type-specific process.
- Locker: physical number 1–200, assign/release by staff.

---

### Party (generic, supporting)

**Key question**: "Who is this person?"
**Concepts**: Person, Government ID (verified document), Birth Date.
**Boundaries**: roles (Customer, Guardian, Pass Holder, Locker holder) live in each context, not here. The `PersonId` currently in `contracting/draft/` belongs here (see linguistic-boundary-verifier V4).

---

### Context map

```
   Offering ──Offer Details (OHS)──▶ Contracting ──Contract Started──▶ Access/Entitlements ◀── Locker (staff)
                                        │   ▲                              ▲
                     raiseCharge        │   │ ChargePaid (first)           │ outstanding payments?
                                        ▼   │                              │
                                   Billing/Receivables ───────────────────┘
                                        │ ▲
                                 pay cmd│ │outcome (ACL)
                                        ▼ │
                                   Payment system (external)
   Party (identity) ◀── used by all
```

## Generalization Safety Notes

**Boundaries that may shift:**
- Entitlements vs Pass Registration: if pass cancellation rules (outstanding payments, 7-day notice) grow, Pass may split back out as its own context behind the Entitlement facade.
- Consent: if T&C acceptance becomes revocable, or needs document versioning (which T&C text was accepted), Consent gains a document reference. Still generic.

**Generalizations to revisit if:**
- Group-class booking arrives. It adds capacity, which makes it resource contention, and Entitlement would need slot + capacity. Split "Booking" out rather than widen Entitlement.
- Billing must know *why* a charge exists to apply rules (e.g. dues are refundable, penalties not). Then the reason becomes a behavior flag (`refundable`), not an identity — keep the principle "behavior, not identity".

## Step 5 — decision sanity check

| Decision | Source |
|---|---|
| Offering and Contracting are separate contexts | (R) |
| Fee Schedule vs Agreed Fees split | (L) + (R) FR-C03 |
| Consent generalization inside Contracting | (L) + (A) |
| **Billing/Receivables exists as its own context** | **(X) — boundary-affecting; confirm** |
| **Pass Registration generalizes to Entitlements, including lockers** | **(X) — boundary-affecting; confirm** |
| Payer ≠ Customer for minors | (A) — confirm |
| Party as a generic identity context | (L) |

## Notes

- Highest-value finding: **recurring charges have no owner**. The domain stops at "first payment → Contract Started", but a membership is paid monthly and penalties exist. Next step: run `accounting-archetype-mapper` on Billing (done, see `docs/skill-runs/accounting-archetype-mapper/`).
- The `@/money` fee classes are shared across Offering and Contracting today. The Fee Schedule / Agreed Fees split says they should be two types (pricing-archetype-mapper covers the Offering side).
- The minor/guardian case exposes that "Customer pays" (FR-C10) conflates bound party and payer.
