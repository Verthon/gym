# Functional requirements

## Overview

SaaS application that **any** Gym can use. It will cover everything from the `Offer` to `diet planning`

Source: *Understand Your Domain First* (M. Jedrzejewski), Process Level board "Process of signing a contract" and the Contracting Bounded Context Canvas. Deviations from the book are listed in [Decisions](#decisions).

## Scope

MVP: **Contracting** bounded context only.

| Bounded context | Role | In MVP |
|---|---|---|
| Offering | Upstream, open-host service. Contracting conforms to its model. | No |
| Contracting | Core, revenue, execution. Converts interested customers into paying members. | Yes |
| Pass Registration | Downstream of Contracting via published language. | No |
| Payment system | External, open-host service. Contracting integrates through an anti-corruption layer. | No (external) |

Out of scope: offer preparation and publication, inquiries (handled by email/phone), pass registration/cancellation/expiration, payment processing and payment data storage, contract expiration and renewal, contract suspension, contract termination process, reporting beyond the queries below.

## Actors

- **Sales Specialist** — prepares the contract, attests the customer's ID, confirms service commitment.
- **Customer** — accepts terms and conditions, pays for the membership.
- **Guardian** — adult co-signing for a minor customer.
- **Payment system** — external; reports payment outcome.

## Contract lifecycle

Draft → Unsigned Contract → Signed Contract → Active Contract

Unsigned Contract can lapse (signing window exceeded).

## Requirements

### Identity

- **FR-C01** Every contract has a unique contract ID assigned at draft creation. Every event emitted by Contracting carries the contract ID.

### Preparation

- **FR-C02** The Sales Specialist creates a contract draft from a published offer (read model: Offer) and customer information (read model: Customer).
- **FR-C03** The draft captures a snapshot of the offer terms at preparation time: offer ID, the membership duration chosen by the Sales Specialist from the durations the offer allows (1, 3, 6 or 12 months), service package (accessible facilities), and fee structure. Later changes to the offer do not affect the contract.
- **FR-C04** The draft is correctable: missing or invalid data can be supplied or fixed until the Contract validation policy passes.
- **FR-C05** The draft becomes an Unsigned Contract only when all rules of the **Contract validation policy** pass, evaluated as of the preparation date:
  - **Identification rule** — government ID information (document type, number, expiry date) is present, its verification is attested by the Sales Specialist, and the ID is not expired on the preparation date.
  - **Age verification rule** — the customer is at least 18 on the preparation date, or a Guardian co-signature for this specific customer is present.
  - **Fee structure rule** — monthly dues, enrollment fee and penalties are each itemized; no amount is negative.
- **FR-C06** On passing validation, **Contract Prepared** is emitted (consumed by the frontend). The preparation date starts the signing window.

### Signing

- **FR-C07** The Sales Specialist confirms service commitment; the Customer accepts terms and conditions. Either may happen first; each happens at most once.
- **FR-C08** When both parties have signed, **Contract Signed** is emitted exactly once, dated at the second signature.
- **FR-C09** **Contract signing policy** — both signatures must be given within 30 days of the preparation date. After that the contract lapses: it can no longer be signed and a new contract must be prepared.

### Payment

- **FR-C10** Once signed, the Customer pays for the membership in the external payment system. Contracting issues the payment request; it stores only the payment reference, no payment data.
- **FR-C11** Contracting records **Payment Confirmed** or **Payment Failed** as reported by the payment system.
- **FR-C12** After Payment Failed the contract remains signed and awaiting payment. The Customer may retry payment any number of times.

### Start

- **FR-C13** **Contract start policy** — the contract starts when payment is confirmed. **Contract Started** is emitted exactly once.
- **FR-C14** The contract end date is the start date plus the membership duration.
- **FR-C15** **Minimum commitment** — the contract cannot be terminated earlier than 3 months after the start date. (Rule only; the termination process is not modeled.)

### Published language (outbound)

| Message | Type | Collaborator | Minimum payload |
|---|---|---|---|
| Contract Prepared | Event | Frontend | contract ID, customer, offer terms |
| Pay for the membership | Command | Payment system (via ACL) | contract ID, amount |
| Contract Started | Event | Pass Registration | contract ID, customer, start date, end date, service package |

### Queries

- **FR-C16** Status of a particular contract (Draft, Unsigned, Lapsed, Signed awaiting payment, Active).
- **FR-C17** Number of contracts signed in a given period (e.g. last month).

## Downstream reference (not Contracting requirements)

Pass Registration consumes Contract Started and enforces its own Pass registration policy: a started contract must exist; the customer has no other active pass of the same type. Pass cancellation and expiration policies (30-day minimum usage, 7-day notice, outstanding payments, contract end date, 365-day maximum, 90-day inactivity) live there too.

## Assumptions

- Contract validation rules remain stable and won't require frequent updates.

## Verification metrics

- Payment system integration failure rate below 0.1% of cases.

## Open questions

1. Do we need different contract flows for different membership types? (book)
2. Should a signed but unpaid contract lapse after some period?
3. Does the contract start on the payment confirmation date, or on a chosen start date?
4. What amount is requested at payment — enrollment fee, first month's dues, both, or the full term?
5. Is day 30 of the signing window inclusive?
6. Is lapsing a published event, and who needs it?
7. What defines a pass "type" for Pass Registration — the service package, the offer, something else?
8. Can an active contract be suspended (injury, pregnancy)? Effect on minimum commitment and pass?
9. Termination process: who initiates, notice period, penalties applied?
10. Contract expiration and renewal (skipped in the book's workshop).

## Decisions

Divergences between the book and the pre-existing model, resolved 2026-09-28.

| # | Topic | Book | Decision |
|---|---|---|---|
| D1 | Payment failed | Contract doesn't start until payment confirmed | Retry allowed; unpaid lapse is an open question |
| D2 | Contract start | Contract Started via Contract start policy | Follow book; rename `ContractActivated` → Contract Started |
| D3 | Contract Suspended | Not present | Dropped; open question |
| D4 | Pass registration rules | Belong to Pass Registration | Moved out of Contracting |
| D5 | Verified government ID | "verified" ID required | Sales Specialist attests; expired ID fails |
| D6 | Offer data | Contract prepared from offer details | Snapshot of full terms (ID, duration, services, itemized fees) |
| D7 | Canvas policies | 30-day signing window; 3-month minimum from signing (canvas) vs from start (big picture) | Both adopted; minimum commitment counted from start |
| D8 | Validation timing | Prepared → validate; failure ends process | Validation gates Contract Prepared; draft is correctable |
| D9 | Durations per offer | Offer has at least one duration | One offer, several durations; Sales Specialist picks one at preparation |

## Implementation gaps (current code vs this document)

- No contract ID; events carry only `personId` (FR-C01).
- `UnsignedContract` emits Contract Signed twice or not at all depending on signing order (FR-C08).
- Two `FeeStructure` classes; the draft uses the one without penalties (FR-C05).
- Draft carries only fees from the offer (FR-C03).
- ID verification attestation not modeled (FR-C05).
- `SignedContract` treats Payment Failed as terminal (FR-C12).
- `ContractActivated` naming; start policy implicit (FR-C13).
- Signing window, end date and minimum commitment not modeled (FR-C09, FR-C14, FR-C15).
- `ContractSuspended` exists without requirement (D3).
- `docs/domain.md` still lists pass registration rules under Active Contract (D4).
