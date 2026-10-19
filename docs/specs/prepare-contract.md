# Prepare contract

Source: `architecture/functional-requirements.md` FR-C02, FR-C05. Status: awaiting review.

## Problem

A Sales Specialist prepares a membership contract for a Potential Customer. The contract may go to signing only when the Contract validation policy passes as of the preparation date. Today there is no way to create a draft, and the validation policy covers only part of FR-C05.

## Solution

Two commands and one query on the Contract Draft stage:

1. Draft a contract from a published offer and a known customer.
2. Prepare the contract: evaluate the Contract validation policy as of today; on success the contract becomes an Unsigned Contract.
3. Read the contract status.

## Seam

The stage's public module. Acceptance tests reach the system only through it, via the driver in the acceptance DSL. Offer and Customer are upstream read models; the driver provides in-memory fakes of both.

## Commands

### Draft a contract

Actor: Sales Specialist.
Preconditions: none.

- **AC-PC-01** Given a published offer that allows 12 months and a known customer, when the Sales Specialist drafts a contract for 12 months, then a contract exists with status Draft.
- **AC-PC-02** Given a published offer that allows 1, 3 and 6 months, when the Sales Specialist drafts a contract for 12 months, then drafting is rejected with `DURATION_NOT_OFFERED`.
- **AC-PC-03** Given no offer with the given ID, when the Sales Specialist drafts a contract from it, then drafting is rejected with `OFFER_NOT_FOUND`.
- **AC-PC-04** Given no customer with the given ID, when the Sales Specialist drafts a contract for them, then drafting is rejected with `CUSTOMER_NOT_FOUND`.

### Prepare the contract

Actor: Sales Specialist.
Preconditions: a drafted contract.

When preparation is rejected, the contract stays in status Draft.

- **AC-PC-05** Given a draft for an adult customer with an attested government ID valid past today, when the Sales Specialist prepares it, then the contract is an Unsigned Contract.
- **AC-PC-06** Given a draft whose government ID the Sales Specialist did not attest, when it is prepared, then preparation is rejected with `ID_NOT_ATTESTED`.
- **AC-PC-07** Given a draft made yesterday with an ID that expired yesterday, when it is prepared today, then preparation is rejected with `ID_EXPIRED`.
- **AC-PC-08** Given a draft with an ID that expires today, when it is prepared today, then the contract is an Unsigned Contract.
- **AC-PC-09** Given a draft made yesterday for a customer who turns 18 today, with no Guardian co-signature, when it is prepared today, then the contract is an Unsigned Contract.
- **AC-PC-10** Given a draft for a customer who turns 18 tomorrow, with no Guardian co-signature, when it is prepared today, then preparation is rejected with `MINOR_REQUIRES_GUARDIAN`.
- **AC-PC-11** Given a draft for a minor with a Guardian co-signature for that minor, when it is prepared, then the contract is an Unsigned Contract.
- **AC-PC-12** Given a draft for a minor with a Guardian co-signature for a different minor, when it is prepared, then preparation is rejected with `GUARDIAN_FOR_DIFFERENT_MINOR`.
- **AC-PC-13** Given a draft from an offer with a negative penalty, when it is prepared, then preparation is rejected with `NEGATIVE_FEE`.
- **AC-PC-14** Given a contract that is already an Unsigned Contract, when it is prepared again, then preparation is rejected with `ALREADY_PREPARED` and it stays an Unsigned Contract.
- **AC-PC-15** Given no contract with the given ID, when it is prepared, then preparation is rejected with `CONTRACT_NOT_FOUND`.

## Implementation decisions

The acceptance driver compiles against these shapes. Changing them means a new spec review.

Module: `src/contracting/draft/index.mts` is the stage's public module. This is the one file path the spec pins, because the locked driver imports it.

It exports:

```ts
type Money = { amountMinor: number; currency: string };

type OfferView = {
  offerId: string;
  durationsInMonths: ReadonlyArray<number>;
  servicePackage: ReadonlyArray<string>;
  fees: {
    monthlyDues: Money;
    enrollmentFee: Money;
    penalties: ReadonlyArray<{ reason: string; amount: Money }>;
  };
};
interface OfferReadModel { findOffer(offerId: string): Promise<OfferView | null> }

type CustomerView = { customerId: string; birthDate: string };
interface CustomerReadModel { findCustomer(customerId: string): Promise<CustomerView | null> }

interface ContractDraftRepository { /* shape is the coder's choice */ }
class InMemoryContractDraftRepository implements ContractDraftRepository { constructor() }

const createContractDraft: (deps: {
  drafts: ContractDraftRepository;
  offers: OfferReadModel;
  customers: CustomerReadModel;
  clock: Clock;
}) => (input: {
  offerId: string;
  customerId: string;
  durationInMonths: number;
  governmentId: {
    type: "PASSPORT" | "ID_CARD";
    number: string;
    expiryDate: string;
    attestedBySalesSpecialist: boolean;
  };
  guardianCoSignature?: { guardianId: string; minorId: string };
}) => Promise<Result<{ contractId: string }, { code: "OFFER_NOT_FOUND" | "CUSTOMER_NOT_FOUND" | "DURATION_NOT_OFFERED" | ... }>>;

const prepareContract: (deps: { drafts: ContractDraftRepository; clock: Clock }) =>
  (input: { contractId: string }) =>
  Promise<Result<void, { code:
    | "CONTRACT_NOT_FOUND" | "ALREADY_PREPARED" | "ID_NOT_ATTESTED" | "ID_EXPIRED"
    | "MINOR_REQUIRES_GUARDIAN" | "GUARDIAN_FOR_DIFFERENT_MINOR" | "NEGATIVE_FEE" }>>;

const contractStatus: (deps: { drafts: ContractDraftRepository }) =>
  (input: { contractId: string }) =>
  Promise<Result<"Draft" | "Unsigned", { code: "CONTRACT_NOT_FOUND" }>>;
```

- Dates at the boundary are ISO `YYYY-MM-DD` strings. `Clock` and `Result` are the existing ones from `#/utils/`.
- Drafting does not evaluate the Contract validation policy. An already expired ID still produces a draft (FR-C04: the draft is correctable).
- `prepareContract` takes no offer read model. The draft holds the offer snapshot from drafting (FR-C03).
- When several rules fail, any one failing rule's code may be returned.
- Drafting may return extra codes for malformed input that no AC covers.

## Out of scope

- Contract Prepared event (FR-C06): the publisher is deferred (`docs/tasks/event-publisher.md` decision 4), so nothing outside can observe it.
- Correcting a draft (FR-C04).
- Offer snapshot details visible from outside (FR-C03): needs a contract-terms query.
- Contract ID carried on events (FR-C01).
- Statuses after Unsigned (FR-C16).

## Open questions

Non-blocking:

1. Must the Guardian be an adult known customer? FR names the Guardian as an adult but the Customer read model has no guardian lookup.
2. Contract ID format: not specified; the driver treats it as opaque.
