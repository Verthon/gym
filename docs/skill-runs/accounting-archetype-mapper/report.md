# Accounting Archetype Model: Membership receivables (Billing)

Input: `architecture/functional-requirements.md` (FR-C10–C15, published language, Pass Registration reference), `src/money/PenaltyFee.mts`, and the context-distiller output (Billing/Receivables context).
Mode: non-interactive. Step 2 questions were answered by the agent. Sources: **(R)** requirements, **(A)** agent-answered — confirm, **(X)** assumed.

## Fit test

**Contracting as written: ❌ does not fit.** Contracting "stores only the payment reference, no payment data" (FR-C10). Its natural question is "what state is the contract in?" (FR-C16), which is a state machine.

**Billing (the owner of monthly dues and penalties, which isn't modeled yet): ✅ fits.**
"How much does payer P owe on contract C?" is a meaningful number with a history:
- Monthly dues for months 2…N (FR-C14 end date, FR-C03 monthly dues) (R)
- Penalties: late payment, early termination, damage, administrative (`PenaltyFee` reasons; FR-C05 "penalties") (R)
- Pass cancellation policy checks "outstanding payments" (FR downstream reference). Someone must be able to answer that. (R)
- Retries and possible double payment (FR-C12) need a refund path. (R)

The model below is for Billing.

## Domain Value

`MEMBERSHIP_RECEIVABLE` — money owed to the gym for one contract, in the contract's currency. Canonical unit: **minor units** of that currency (integer, as `Money` does). One currency per contract (R: `FeeStructure` rejects mixed currencies); no conversion.

## Concept Mapping

| Domain Concept | Accounting Archetype | Notes |
|---|---|---|
| Contract (billing view) | Scope of accounts: one set per contract | Party = payer (for a minor, the Guardian — see context-distiller) |
| Enrollment fee | Transaction `enrollment_charged` | One-off |
| Monthly dues | Transaction `dues_charged`, one per month | `applied_at` = period start |
| Penalty (late payment, early termination, damage, admin) | Transaction `penalty_charged` | The reason is a label, not a separate account (A) |
| Pay for the membership (FR-C10) | Transaction `payment_received` | From the payment system via ACL |
| Payment Failed (FR-C11) | No transaction | Nothing moved. Recorded as a fact in Contracting only |
| Payment reference | Transaction external ID | Idempotency key |
| Double payment (FR-C12 retries) | `payment_received` into customer credit + `refund_issued` | |
| Waived penalty / correction | Reversal transaction | |
| Outstanding payments (Pass cancellation policy) | Balance query of `customer_receivable` where `applied_at ≤ today` | |

## Unmapped Concepts

- **Contract lifecycle** (draft → signed → active) — state machine, stays in Contracting.
- **Minimum commitment** (FR-C15) — a rule deciding *whether* termination is allowed. It lives in the application layer. Only its consequence (an early-termination charge) enters the ledger.
- **When a penalty applies** (e.g. N days late) — policy above the ledger. The ledger receives the computed amount.

## Accounts

| Account | Type | Unit | Negative Balance Policy | Description |
|---|---|---|---|---|
| `contract_receivable` | Asset (gym's) | minor units | **block** (A) | What the payer owes on this contract |
| `contract_credit` | Liability | minor units | block | Overpayment held for the payer (double payment, prepayment) |
| `revenue_enrollment` | Revenue | minor units | allow | |
| `revenue_dues` | Revenue | minor units | allow | |
| `revenue_penalties` | Revenue | minor units | allow | One account; the reason is a label on the entry (A) |
| `payment_clearing` | Asset | minor units | allow | Money reported by the payment system, not yet settled |

## Transactions & Entries

### enrollment_charged
**Trigger**: Contract Started (FR-C13). (X — charging at signing or at payment request is also possible. Confirm, because it decides whether an unpaid signed contract owes anything.)
**Reversible**: Conditional (contract cancelled before access is used)

| Entry | Account | Direction | Amount | created_at | applied_at | Notes |
|---|---|---|---|---|---|---|
| 1 | contract_receivable | Debit | enrollment fee | now | start date | |
| 2 | revenue_enrollment | Credit | enrollment fee | now | start date | |

### dues_charged
**Trigger**: start of each month of the term, months 1…durationMonths (system-scheduled)
**Reversible**: Conditional (billing error, suspension if open question 8 introduces it)

| Entry | Account | Direction | Amount | created_at | applied_at | Notes |
|---|---|---|---|---|---|---|
| 1 | contract_receivable | Debit | monthly dues | now | period start | Month 1 coincides with enrollment (`firstPaymentTotal`) |
| 2 | revenue_dues | Credit | monthly dues | now | period start | |

### penalty_charged
**Trigger**: a policy decision above the ledger (late payment detected, early termination accepted, damage reported, admin fee)
**Reversible**: Yes (waiver)

| Entry | Account | Direction | Amount | created_at | applied_at | Notes |
|---|---|---|---|---|---|---|
| 1 | contract_receivable | Debit | penalty amount | now | event date | reason label ∈ {LATE_PAYMENT, EARLY_TERMINATION, DAMAGE_FEE, ADMINISTRATIVE_FEE} |
| 2 | revenue_penalties | Credit | penalty amount | now | event date | |

### payment_received
**Trigger**: Payment Confirmed via ACL, keyed by payment reference (idempotent: a second report with the same reference creates nothing)
**Reversible**: Yes (chargeback, refund)

| Entry | Account | Direction | Amount | created_at | applied_at | Notes |
|---|---|---|---|---|---|---|
| 1 | payment_clearing | Debit | paid amount | now | payment date | |
| 2 | contract_receivable | Credit | min(paid, open receivable) | now | payment date | Allocation below |
| 3 | contract_credit | Credit | paid − open receivable (if > 0) | now | payment date | Overpayment / double payment |

### refund_issued
**Trigger**: an overpayment is detected (double payment), or a refund is approved
**Reversible**: No

| Entry | Account | Direction | Amount | created_at | applied_at | Notes |
|---|---|---|---|---|---|---|
| 1 | contract_credit | Debit | refund amount | now | now | Blocked if credit is insufficient |
| 2 | payment_clearing | Credit | refund amount | now | now | |

## Validity Rules

| Account | Valid From | Valid To | On Expiry |
|---|---|---|---|
| `contract_receivable` | contract start | none | Receivables don't expire. The contract end date stops *new* `dues_charged`, nothing more |
| `contract_credit` | first overpayment | none (A) | Refund on contract end (X — confirm) |

No entry expires. Dues charges are dated by `applied_at` to their period, so "outstanding today" is `SUM(applied_at ≤ today)`. Future-dated charges aren't outstanding.

## Allocation Strategy

When a payment is smaller than the open receivable, or several charges are open:
1. **Oldest charge first (FIFO by `applied_at`)** — so "outstanding" and late-payment detection match what the customer expects. (A)
2. Within the same date: dues before penalties. (X — some gyms apply payments to penalties last so a customer never becomes "late" because of a disputed fee. Confirm.)

## Reversal Rules

| Transaction | Reversal Trigger | Reversible? | Constraint |
|---|---|---|---|
| enrollment_charged | Contract cancelled before first access | Conditional | References original. Who may cancel is open question 9 |
| dues_charged | Billing error; suspension (open question 8) | Conditional | Mirror entries, same `applied_at` |
| penalty_charged | Waiver by staff | Yes | Staff role checked above the ledger |
| payment_received | Chargeback / refund | Yes | Keyed by payment reference |
| refund_issued | — | No | |

## Decision sanity check

| Decision | Source |
|---|---|
| Billing exists as its own context | (X) from context-distiller — **confirm** |
| One set of accounts per contract | (A) |
| Receivable cannot go negative; overpayment goes to credit | (A) |
| Enrollment charged at contract start | **(X) — business-affecting, confirm** |
| FIFO allocation, dues before penalties | (A) / **(X)** |
| Append-only ledger, reversals only | (A) — standard, no requirement against it |
| Integer minor units | (R) `Money` |
| Payment reference as idempotency key | (R) FR-C10 + (A) |

## Implementation Notes

- **Biggest finding**: the requirements model one payment (FR-C10 "pays for the membership") and stop. A 12-month membership needs 11 more dues charges, and nothing owns them. Either the payment system handles recurring billing (then Billing is its mirror via ACL), or the gym owns it (this model). Decide before Pass Registration's "outstanding payments" rule can be implemented.
- FR open question 4 (what amount is requested at payment) is answered by this model: the payment request is for the **current open receivable**, not a fixed formula.
- A minor's contract: the payer is the Guardian, but the receivable is on the contract. Payer identity is a label on the payment, not the account owner.
- Policies above the ledger that the ledger just receives: late-payment threshold and amount, early-termination amount (FR-C15), refund approval.
