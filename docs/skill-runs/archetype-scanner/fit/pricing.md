---
archetype: pricing
fit: true
---

# Pricing Archetype Model: Membership offer

Input: `architecture/offering-user-stories.md` (OF-1, OF-2, open questions 2–4), `architecture/functional-requirements.md` (FR-C03, FR-C05, FR-C14), `src/money`.
Mode: non-interactive. Step 2 questions were answered by the agent. Sources: **(R)** requirements, **(A)** agent-answered — confirm, **(X)** assumed.

## Fit test

"How much does membership offer O cost for customer Y at time T for duration D?" — **partially yes**.

- The price has named components (enrollment fee, monthly dues, penalties) that the customer sees separately. (R)
- Contracting freezes the terms by snapshot (FR-C03), so historical reproducibility is solved by copying, not by versioning. (R)
- Offering open question 4 ("standard pricing calculation — fixed monthly dues per duration, or derived?") and open question 3 (a 20% discount) are the triggers that would turn this from stored numbers into a computed price. (R)

## Pricing Domain

**What's priced**: a membership offer, for one chosen duration (1/3/6/12 months).
**Detected complexity level**: **2 today, 5 as soon as open question 3 or 4 is answered "yes"**.

- Level 2 (currency-aware): `Money` exists, one currency per fee structure is enforced. (R + code)
- Level 4 (multi-dimensional) would apply if monthly dues depend on duration, e.g. 12 months cheaper per month. (A: likely — confirm)
- Level 5 (breakdown): enrollment + dues + penalties are itemized (FR-C05). (R)
- Levels 6–8 are **not needed**: the contract keeps a snapshot, so the offer never has to re-price a past contract. (R, FR-C03)

**Recommendation** (per the skill's guidance for levels 1–2: prefer simplicity): don't build a pricing engine now. Store the fee schedule on the offer (mapping 1:0) and snapshot it into the contract. The model below is the target **if** duration-dependent dues or discounts are confirmed. It shows the smallest tree that covers them.

## Concept Mapping

| Domain Concept | Pricing Archetype | Notes |
|---|---|---|
| Enrollment fee | SimpleComponent + SimpleFixedCalculator | One-off, charged once at start |
| Monthly dues | SimpleComponent + DiscretePointsCalculator(duration → rate) | UNIT (per month). Collapses to SimpleFixed if dues don't vary by duration |
| Membership duration (1/3/6/12) | Parameter `durationMonths` | Chosen by the Sales Specialist (FR-C03) |
| First payment total (`FeeStructure.firstPaymentTotal`) | CompositeComponent `first-payment` = SumOf(enrollment, dues×1) | Already in code |
| Total contract value | CompositeComponent `contract-value` = enrollment + dues × durationMonths | Not in requirements; needed if payment is "full term" (FR open question 4) |
| Discount 20% (Offering open question 3) | SimpleComponent + SimpleFixedCalculator(−20%) + Applicability(`promotionCode`) | Speculative until open question 3 is answered |
| Offer validity period (Offering open question 2) | Validity `[availableFrom, availableUntil)` on the offer root | Governs *sellability*, not re-pricing |
| Currency per gym (SaaS for "any gym") | Parameter `currency` | One currency per offer (enforced by `FeeStructure.create`) |
| Price caps (≤500 / ≤1000 / ≤200 in code) | — | Validation, not pricing. See Unmapped |

## Unmapped Concepts

- **Penalties** (late payment, early termination, damage, administrative) are *conditional charges triggered by events*, not price components of the offer. They belong in Billing (see accounting-archetype-mapper). The offer only carries their amounts as a lookup.
- **Duration selection**: eligibility. The Sales Specialist chooses (application layer, FR-C03), and the pricing engine receives it as a parameter.
- **Minimum commitment (FR-C15)**: a contract rule, not a price.
- **Amount caps** in `EnrollmentFee` / `MonthlyDues` / `PenaltyFee`: validation with no business source in the requirements. They're also nominal across currencies and break for JPY (see linguistic-boundary-verifier incidental findings).

## Calculator Design

| Calculator ID | Type | Parameters | Interpretation | Notes |
|---|---|---|---|---|
| `enrollment-fixed` | SimpleFixedCalculator | constructor: amount | TOTAL | Can be 0 (promotions) |
| `dues-by-duration` | DiscretePointsCalculator | constructor: {1→a, 3→b, 6→c, 12→d}; call: `durationMonths` | UNIT (per month) | Throws for durations the offer doesn't allow — matches OF-1 |
| `discount-pct` | SimpleFixedCalculator | constructor: −0.20 | TOTAL (applied to a base via ProductOf) | Only if open question 3 = yes |

## Component Tree

```
contract-value (Composite)
├── enrollment-fee        (Simple, enrollment-fixed)
├── dues-for-term         (Composite: ProductOf(monthly-dues, durationMonths))
│   └── monthly-dues      (Simple, dues-by-duration)
└── promo-discount        (Simple, discount-pct; base = SumOf(enrollment-fee, dues-for-term); applicability: promotionCode)

first-payment (Composite)
├── enrollment-fee
└── monthly-dues          (×1)
```

| Component ID | Type | Calculator / Children | ParameterValue Dependencies | Notes |
|---|---|---|---|---|
| `enrollment-fee` | Simple | `enrollment-fixed` | — | |
| `monthly-dues` | Simple | `dues-by-duration` | — | |
| `dues-for-term` | Composite | [monthly-dues] | ProductOf(ValueOf(monthly-dues), durationMonths) | UNIT → TOTAL adapter |
| `promo-discount` | Simple | `discount-pct` | base = SumOf(enrollment-fee, dues-for-term) | Optional |
| `contract-value` | Composite | [enrollment-fee, dues-for-term, promo-discount] | SumOf(children) | |
| `first-payment` | Composite | [enrollment-fee, monthly-dues] | SumOf(children) | Exists today as `firstPaymentTotal()` |

## Validity Rules

| Component | VersionUpdateStrategy | validFrom (current) | validTo | Notes |
|---|---|---|---|---|
| offer root | REJECT_OVERLAPPING (A) | publication date | end of time, or `availableUntil` if open question 2 = yes | Editing a published offer is open question 1. If editing is allowed, it's a new version, never an overwrite |
| `promo-discount` | ALLOW_ALL (A) | campaign start | campaign end | "When the promotion ends, we do nothing": the version expires on its own |

Contracting never calls `versionAt(past)`. It keeps the snapshot (FR-C03). Versioning here only protects **Offering's** own history (for "what did we advertise on date X?", a claim the Offering doc raises under open question 1).

## Applicability Conditions

| Component | Condition Dimensions | Logic | Non-Applicable Behavior |
|---|---|---|---|
| `promo-discount` | `promotionCode` (or campaign) | code ∈ active campaign codes | exclude from breakdown (A) |
| `monthly-dues` | `durationMonths` ∈ offer durations | enforced by DiscretePoints lookup | error (duration not offered) |

## Context Dimensions (Parameters)

| Parameter | Type | Mandatory | Purpose |
|---|---|---|---|
| timestamp | LocalDate | Yes | Offer version / promotion validity |
| durationMonths | 1 \| 3 \| 6 \| 12 | Yes | Dues lookup, term multiplier |
| currency | ISO code | Yes (from offer) | Single-currency guard |
| promotionCode | string | No | Discount applicability |

## Product-Pricing Mapping

**Scenario**: **1:0 today** (the price is stored on the offer). It moves to **1:1** (one component tree per offer) if open question 3 or 4 introduces computation.

| Product | Pricing Component Root | Notes |
|---|---|---|
| Offer (per offer ID) | `contract-value` / `first-payment` | The offer *is* the product. No separate catalog |

## Interpretation

TOTAL for contract value and first payment; UNIT for monthly dues. The adapter `ProductOf(durationMonths)` produces the term total. MARGINAL is not needed.

## Implementation Notes

- (R) Snapshot at preparation replaces historical re-pricing. Don't add `definedAt` / `versionAt` to Contracting.
- (A) Dues vary by duration — **confirm**. It's the single fact that decides between level 2 (stored numbers) and level 4+.
- (A) Is VAT included? The requirements never mention tax. For a multi-gym SaaS, gross vs net and the VAT rate per country is a gap. (X — business-affecting; confirm before any invoice work.)
- (X) Rounding: `Money.multiply` rounds half-up to minor units. A 20% discount on odd amounts rounds per line, not on the total. Decide which.
- (R) Currency: one per offer. Multi-currency per gym is not required.
- The current code has two `FeeStructure` classes (`src/money` and `src/contracting/draft`). The pricing view says **Offering** owns the fee schedule, and Contracting holds only a frozen copy. See context-distiller: Fee Schedule vs Agreed Fees.
