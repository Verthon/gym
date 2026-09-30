# Linguistic Boundary Report — Contracting and neighbours

Scope: `all` — `src/contracting`, `src/money`, `src/sandbox/locker` (tests only), plus the neighbours declared in `architecture/functional-requirements.md`.
Mode: non-interactive. The confirmations the skill asks for were answered by the agent (marked **assumed**). Read-only: no code or LANGUAGE.md was changed.

## Fit test

`src/contracting/LANGUAGE.md` exists, but it has **no module description and no integration points**, which the skill requires. It's the only language file in the repo. Following the skill's fallback, the integration points below were **drafted from `functional-requirements.md` and the imports in the code**, and are treated as confirmed (**assumed**).

Drafted integration points for Contracting:

| Neighbour | Relationship | Direction | Terms crossing |
|---|---|---|---|
| Offering | OHS, Contracting is **conformist** (FR scope table, OF-7) | Offering → Contracting | offer ID, durations, service package, fee structure (monthly dues, enrollment fee, penalties) |
| Payment system | External OHS, Contracting uses an **ACL** | Payment → Contracting (translated) | Contracting's own: payment reference, Payment Confirmed, Payment Failed |
| Pass Registration | **Published language** | Contracting → Pass Registration | Contract Started {contract ID, customer, start date, end date, service package} |
| `src/money` | Not declared anywhere. By imports it acts as a **shared kernel** | money → Contracting | Money, FeeStructure, MonthlyDues, EnrollmentFee, PenaltyFee |

## Executive summary

- Health: **fair**. No neighbour module exists in code yet, so most leaks are latent. They're in published payloads and in the `money` module, whose role is undefined.
- Violations: 5. By type: 2 published-language payload leaks, 1 generalization break (money), 1 identity concept in the wrong place (PersonId), 1 test term in the domain.
- Language drift inside Contracting (code vs LANGUAGE.md): 8 terms. See the drift table; LANGUAGE.md "Open" already lists 4 of them.

## Relationship map

```
            Offering (OHS)                              Payment system (external)
                 │ conformist ✅                              │ ACL ⚠ (not built; SignedContract takes raw paymentRef/reason)
                 ▼                                            ▼
 ┌──────────────────────── Contracting ─────────────────────────────┐
 │ draft ─▶ unsigned ─▶ signed ─▶ active                             │
 │   ▲ PersonId lives in draft/ ❌ (used by all stages + locker)      │
 └──────────┬───────────────────────────────────────┬───────────────┘
            │ imports FeeStructure et al.           │ ContractActivated {personId, fees} ❌
            ▼                                       ▼
   src/money  ❌ generic Money + Offering's fee terms   Pass Registration (not built)
            ▲
            │ imports @/contracting/draft/PersonId ❌
   src/sandbox/locker (tests)
```

## Violations with fixes

### V1 — Published event carries the fee structure instead of the published payload

- Evidence: `signed-contract/events.mts:41-48`. `ContractActivated.payload = { personId, fees: FeeStructure }`.
- Type: event in foreign language. The physical direction is right (Contracting → Pass Registration), but the vocabulary is wrong.
- Behavior: Pass Registration needs "customer, start date, end date, service package" (published language table). It gets Contracting's internal fee VO, and no dates or services.
- Fix: publish `ContractStarted { contractId, customerId, startDate, endDate, servicePackage }`. Fees stay internal. Contracting is announcing, not orchestrating, so a plain event is right and Pass Registration owns any translation.

```
BEFORE                                   AFTER
Contracting ──ContractActivated──▶ PR     Contracting ──ContractStarted──▶ PR
  {personId, fees: FeeStructure} ❌         {contractId, customerId, start, end,
  PR must understand Money/FeeStructure      servicePackage} ✅  PR sees only published terms
```

### V2 — `ContractPrepared` / `ContractSigned` payloads use internal VOs

- Evidence: `draft/events.mts:6-9`, `unsigned-contract/events.mts:6-10`: `{ personId, fees: FeeStructure }`.
- Type: published-language drift. The published language table says Contract Prepared → frontend carries {contract ID, customer, offer terms}. There's no contract ID (FR-C01), and the offer terms are a single VO class.
- Fix: until a consumer exists (`docs/tasks/event-publisher.md` defers the publisher), keep these internal. When they're published, map them to the table's payload at the boundary. **assumed**: accepted as deferred and not a live violation.

### V3 — `src/money` mixes a generic concept with Offering's language

- Evidence: `money/Money.mts` is generic. `money/FeeStructure.mts`, `MonthlyDues.mts`, `EnrollmentFee.mts`, `PenaltyFee.mts` are Offering's terms (OF-1 fee structure), and `PenaltyFee` hard-codes the reasons `"LATE_PAYMENT" | "EARLY_TERMINATION" | "DAMAGE_FEE" | "ADMINISTRATIVE_FEE"`. EARLY_TERMINATION is a Contracting concept (FR-C15).
- Type: breaks generalization. A module named for a generic concept holds specific business vocabulary and business caps (enrollment ≤ 500, dues ≤ 1000, penalty ≤ 200).
- Fix: split by owner. `money/` keeps `Money` only (the generic kernel). Fee terms move to Offering's model, which is where fees are defined. Contracting holds a **snapshot** type in its own language (FR-C03), e.g. `contracting/…/OfferTerms`. The caps move with fees to Offering's completeness policy, or are dropped if nobody owns them.

```
BEFORE                                         AFTER
money/  Money + FeeStructure + PenaltyReason ❌  money/        Money ✅ (generic)
   ▲ imported by every contracting stage         offering/     FeeStructure, penalties, caps ✅
                                                 contracting/  OfferTerms snapshot (own language) ✅
```

### V4 — `PersonId` is owned by the draft stage but is the identity for everyone

- Evidence: `contracting/draft/PersonId.mts` is imported by `active-contract`, `signed-contract`, `unsigned-contract` and by `src/sandbox/locker/__tests__/acceptance.spec.mts` (a different context: locker rental).
- Type: API/identity in the wrong place. The locker context depends on Contracting's internal draft module.
- Also a naming issue: LANGUAGE.md has Potential Customer, Customer, Sales Specialist and Guardian, and the code has one `PersonId` for all of them (LANGUAGE.md Open already notes this).
- Fix: move the identity to a shared kernel (e.g. `src/shared/PersonId`, or a `party` module if one is introduced). Inside Contracting, use role-named types (`CustomerId`, `GuardianId`) or at least role-named fields.

### V5 — Test vocabulary in the domain

- Evidence: `draft/GovernmentIdInfo.mts:3,29`: `type GovernmentIdType = "PASSPORT" | "ID_CARD" | "TEST_ID"`.
- Type: string from a foreign "context" (the test suite).
- Fix: remove `TEST_ID`. Tests should use a real type.

## Language drift inside Contracting (code vs LANGUAGE.md)

| Code term | Location | LANGUAGE.md term | Status |
|---|---|---|---|
| `ReadyToSign` | `ContractDraft.mts:10` | Unsigned Contract | New drift |
| `toNotSignedContract` | `ContractDraft.mts` | Unsigned Contract | In Open |
| `promotion`, `ID_EXPIRED_AT_PROMOTION` | `ContractDraft.mts:25`, tests "promotes" | (preparation — FR-C05 "as of the preparation date") | New drift |
| `userInfo`, `userId()`, `applicant` (tests) | `ContractDraft.mts` | Potential Customer | In Open |
| `PaymentAccepted` / `PaymentRejected`, `recordPaymentAccepted/Rejected` | `SignedContract.mts` | Payment Confirmed / Payment Failed | In Open |
| `ContractActivated` | `signed-contract/events.mts` | (LANGUAGE.md has Active Contract; FR D2 decided **Contract Started**) | In Open |
| `ContractSuspended` | `active-contract/events.mts` | listed in LANGUAGE.md, but dropped by FR D3 | New: **LANGUAGE.md contradicts FR D3** |
| `maintenanceFee` | `draft/FeeStructure.mts` (dead file) | — | New: term with no source. Delete with the dead file |

Missing from LANGUAGE.md but required by the FRs: Contract ID, Contract validation policy (Identification / Age verification / Fee structure rules), Signing window, Lapsed, Contract Started, Membership duration, Service package, Minimum commitment, Payment reference.

## Recommendations (prioritized)

1. Add a module description and integration points to `src/contracting/LANGUAGE.md` (the table under "Fit test" is a ready draft). Without them this skill can only guess.
2. Fix LANGUAGE.md itself: drop Contract Suspended (D3), add Contract Started and the terms listed above.
3. Decide the owner of fee terms (V3) before building Offering. That's the moment the `money` leak becomes a real cross-context dependency.
4. Move `PersonId` out of `draft/` (V4) before the locker sandbox becomes a real module.
5. Shape the Contract Started payload to the published-language table when Pass Registration is built (V1).

## Incidental findings (outside this skill's scope)

- `EnrollmentFee` / `MonthlyDues` / `PenaltyFee` with a 0-minor-unit currency (JPY): the cap is built with `Money.fromMajor("500.00", "JPY")`, which fails `INVALID_PRECISION`. `create` then returns `INVALID_CURRENCY` for every JPY amount, even though `Money` lists JPY as supported. The caps are also nominal in any currency (500 of anything).
- `draft/Signature.mts` and `draft/FeeStructure.mts` are imported only by their own tests or by nothing. They're dead code.
