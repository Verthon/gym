# Archetype Scan: Gym membership (Offering + Contracting + downstream)

Run note: the skill runs one agent per archetype in parallel, then a merge agent. Here the two mappers were run inline, one after the other, on the same input, and their outputs were reused as `fit/accounting.md` and `fit/pricing.md`. The merge was also done inline.

## Quick View

| Archetype | Fit | Core Reason |
|---|---|---|
| accounting | ✅ (Billing only) | "How much does the payer owe on contract C?" — monthly dues, penalties, outstanding payments. ❌ for Contracting as written (state machine, stores only a payment ref) |
| pricing | ✅ (weak — level 2, becomes 5 if Offering open question 3/4 = yes) | Offer price has itemized components and may depend on duration or promotion. Snapshot at preparation removes the need for historical re-pricing |

## Matched Archetypes

### Accounting ✅

- **What matched**: the receivable a membership creates over its term — dues each month, one-off enrollment, event-driven penalties, payments, and refunds for double payments.
- **Domain value / key entity**: `MEMBERSHIP_RECEIVABLE` in minor units, one account set per contract.
- **Key decisions surfaced**:
  - Does Billing exist as a context, or does the external payment system own recurring billing? (X — confirm)
  - Is enrollment charged at contract start, at signing, or at the payment request? (X — confirm)
  - Allocation: FIFO by date, with dues before penalties? (A/X)
  - Overpayment goes to a credit liability, refunded on request or at contract end? (A/X)
  - Payment reference as the idempotency key. (R + A)

### Pricing ✅

- **What matched**: the offer's fee schedule — enrollment + monthly dues (possibly per duration) + an optional discount, and a first-payment composite (exists in code).
- **Domain value / key entity**: `contract-value` and `first-payment` component trees per offer.
- **Key decisions surfaced**:
  - Do monthly dues vary by duration? This decides level 2 vs 4+. (A — confirm)
  - Discounts (Offering open question 3): applicability by promotion code. (speculative)
  - VAT gross or net, rate per country for a multi-gym SaaS. (X — confirm)
  - No `versionAt` for Contracting: the snapshot (FR-C03) is the reproducibility mechanism. (R)
  - Rounding of percentage discounts: per line or on the total. (X)

## Domain Concept Distribution

| Domain Concept | Archetype(s) | Role in Archetype | Unmapped? |
|---|---|---|---|
| Enrollment fee | pricing, accounting | Component (price) / Transaction `enrollment_charged` | |
| Monthly dues | pricing, accounting | Component UNIT per month / Transaction `dues_charged` monthly | |
| Penalties | accounting | Transaction `penalty_charged` (reason label) | Pricing: unmapped (conditional charge, not price) |
| Fee structure | pricing | Component tree (Offering side) | |
| Membership duration | pricing | Parameter `durationMonths` | |
| First payment total | pricing, accounting | Composite `first-payment` / first open receivable | |
| Discount 20% | pricing | Component + Applicability | speculative |
| Offer validity period | pricing | Validity on offer root | speculative |
| Payment (confirmed) | accounting | Transaction `payment_received` | |
| Payment Failed | accounting | no transaction (fact only) | |
| Payment reference | accounting | Idempotency key | |
| Double payment / refund | accounting | `contract_credit` + `refund_issued` | |
| Outstanding payments (pass cancellation) | accounting | Balance query | |
| Contract lifecycle (draft → active) | — | — | ⚠️ Yes |
| Contract validation policy | — | — | ⚠️ Yes |
| Signing window / lapse | — | — | ⚠️ Yes |
| Minimum commitment | — | — | ⚠️ Yes (rule; only its penalty reaches accounting) |
| Offer review workflow | — | — | ⚠️ Yes |
| Pass / Entitlement (one active per type) | — | — | ⚠️ Yes |
| Guardian / Customer / Payer identity | — | — | ⚠️ Yes |

## Overlaps

- **Enrollment fee, monthly dues, first payment** appear in both. This is the same concept from two angles, not a conflict. Pricing answers "what does this offer cost" at sale time. Accounting answers "what is owed and paid" over the term. The hand-off is the Contracting snapshot: pricing computes → Contracting freezes → Billing charges from the frozen terms.
- **Penalties**: pricing only defines the amounts; accounting records occurrences. Keep the amounts in the offer's fee schedule and the occurrences in the ledger. Don't let the ledger look up the offer.

## Gaps — Not Covered by Any Archetype

| Concept | Why no archetype covers it | Suggested next step |
|---|---|---|
| Contract lifecycle, validation policy, signing window | State machine with policies | problem-classifier (done): CRUD + lifecycle, RC only at signing |
| Offer review workflow | Workflow / state machine | Model directly; decide the edit freeze (requirements-critic OF-1) |
| Pass registration (one active per type) | Uniqueness state | DB constraint; context-distiller suggests an Entitlements context |
| Party roles (Customer vs Payer vs Guardian) | Identity, not value | Needs a party model. A "party" archetype isn't in the registry — candidate for a new mapper |

## Archetype Rejection Reasons

- Accounting for **Contracting as written**: its natural question is "what state is the contract in?" (FR-C16), and it keeps no payment data (FR-C10).
