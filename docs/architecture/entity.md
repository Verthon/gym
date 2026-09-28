# Entity

Purpose: track an object that matters by identity (e.g. a contract at a given stage).

## Rules

- Typed id Value Object, never a raw string.
- Private fields; expose read-only getters.
- State changes only through named methods.
- Each method checks invariants first and returns `Result` when it can fail.
- State modeled as a discriminated union (`{ kind: ... }`).
- Emits internal domain events into a private buffer, drained by `pullEvents()`. See [events.md](events.md).
- Contracting stages are entities, not aggregates: no version fields, no locking.

## Pattern

```ts
type ContractState =
  | { kind: "AwaitingPayment" }
  | { kind: "PaymentAccepted"; paymentRef: string };

export type SignedContractError = { code: "NOT_AWAITING_PAYMENT" };

export class SignedContract {
  private state: ContractState = { kind: "AwaitingPayment" };
  private events: SignedContractEvent[] = [];

  private constructor(private readonly _personId: PersonId) {}

  static create(personId: PersonId): SignedContract {
    return new SignedContract(personId);
  }

  recordPaymentAccepted(paymentRef: string): Result<void, SignedContractError> {
    if (this.state.kind !== "AwaitingPayment") return err({ code: "NOT_AWAITING_PAYMENT" });
    this.state = { kind: "PaymentAccepted", paymentRef };
    this.events.push(paymentConfirmed({ personId: this._personId, paymentRef }));
    return okVoid();
  }

  pullEvents(): SignedContractEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get personId() {
    return this._personId;
  }
}
```

Reference implementations: `src/contracting/*/` (`ContractDraft`, `UnsignedContract`, `SignedContract`, `ActiveContract`).
