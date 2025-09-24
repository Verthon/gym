# Domain Modeling Guidelines

This document outlines the rules and patterns for creating domain model classes (Aggregates, Value Objects) within this project. The goal is to ensure that our domain model is robust, expressive, and always in a consistent state.

These guidelines are inspired by and aligned with the patterns in the [DomainDrivers/dd-typescript](https://github.com/DomainDrivers/dd-typescript) repository.

> Smallest set of rules + tiny snippets so an LLM can model robust code fast.

## How to Pick the Building Block

| If you need… | Choose | Key traits |
|--------------|--------|-----------|
| - stable identity- lifecycle changes- event emission | **Entity** | has `id`, mutable via behaviors |
| - pure description- no identity- safe reuse | **Value Object** | immutable, structural equality |

## 1. Value Object (V O)

**Purpose:** capture a descriptive concept (e.g., *ISBN*, *Money*).

### Mandatory attributes

- Immutable MUST-HAVE
- Immutable state (`readonly`, `Object.freeze`).
- Self-validated in factory.
- Follows validation from least cost heavy for CPU and memory to most heavy one (fail-fast)
- Can have methods with the behaviors as long it doesn't mutate state
- Equality by **all** properties (structural equality).
- Should be composable
- Pure helpers only (no side effects).
- Tests for VO would require few lines of code and should be simple units

### Mini-pattern

```ts
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: 'USD' | 'EUR'
  ) {
    if (amount  {
    if (this._status !== 'Pending') return left('AlreadyActive');
    this._status = 'Active';
    return right(new MembershipActivated(this._id));
  }

  // read-only accessors
  get id()     { return this._id; }
  get status() { return this._status; }
}
```

## 2. Entity

Purpose: track an object that matters by identity (e.g., Member, Book).
Mandatory attributes

- Mutable so we need to guarantee that mutations are done via methods that checks all the business rules
- Typed id object (avoid raw strings).
- Private fields; expose read-only getters.
- State changes ONLY via named methods.
- Each method checks invariants first.
- Emits domain events internally.

### Mini-pattern

```ts
/** Typed identifier */
export class MemberId {
  constructor(public readonly value: string) {}
  static new(): MemberId { return new MemberId(crypto.randomUUID()); }
  equals(other: MemberId) { return this.value === other.value; }
}

export class Member {
  private _status: 'Pending' | 'Active';

  constructor(
    private readonly _id: MemberId,
    private readonly _email: Email,
    status: 'Pending' | 'Active' = 'Pending'
  ) {
    this._status = status;
  }

  static register(email: Email): Member {
    return new Member(MemberId.new(), email);
  }

  activate(): Result<MembershipActivated, { code: 'AlreadyActive' }> {
    if (this._status !== 'Pending') {
      return err({ code: 'AlreadyActive' });
    }
    this._status = 'Active';
    return ok(new MembershipActivated(this._id));
  }

  // read-only accessors
  get id()     { return this._id; }
  get status() { return this._status; }
}
```

Got it 👍 thanks for sharing your **Result** implementation. Let’s align the **Application Service mini-pattern** in `agents.md` with that style.

Here’s the **concise addition**:

---

## 3. Application Service (AppSvc)

**Purpose:** orchestrate a single use case/transition. Translate DTOs ⇄ Domain, run in a `UnitOfWork`, persist, publish events. **No business rules here.**

### Mandatory attributes

* One handler = one use case.
* Depends only on **ports** (`Repository`, `EventBus`, `UnitOfWork`).
* Input/Output are **DTOs wrapped in `Result`**.
* Always return `ok(value)` or `err(error)`, never throw.
* Save aggregate via repo, publish domain events after save.
* No direct infra code, no domain rules here.

### Ports

```ts
export interface UnitOfWork { with<T>(fn: () => Promise<T>): Promise<T>; }
export interface EventBus { publish(events: DomainEvent[]): Promise<void>; }
export interface Repository<TAggregate> {
  get(id: string): Promise<TAggregate | null>;
  save(aggregate: TAggregate, expectedVersion?: number): Promise<void>;
}
export type AppError = 'NotFound' | 'RuleViolation' | 'Concurrency';
```

### Mini-pattern (Draft → Unsigned)

```ts
type MoveToUnsignedCmd = {
  id: string;
  asOf: LocalDate;
  guardian?: GuardianCoSignature;
  expectedVersion?: number;
};
type MoveToUnsignedRes = { id: string; state: 'ReadyToSign'; version: number };

export class MoveToUnsignedHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: Repository<ContractDraft>,
    private readonly bus: EventBus
  ) {}

  async execute(cmd: MoveToUnsignedCmd): Promise<Result<MoveToUnsignedRes, AppError>> {
    return this.uow.with(async () => {
      const draft = await this.repo.get(cmd.id);
      if (!draft) return err('NotFound');

      const domainRes = draft.toNotSignedContract(cmd.asOf, cmd.guardian);
      if (!domainRes.success) return err('RuleViolation');

      await this.repo.save(draft, cmd.expectedVersion);
      await this.bus.publish(draft.pullEvents());

      return ok({
        id: draft.userId().value,
        state: 'ReadyToSign',
        version: draft['version'] ?? 0
      });
    });
  }
}
```

### Heuristics (for LLM)

* Always return `Result<T, E>`; never bare values or exceptions.
* Map **domain errors → AppError** inside handler.
* Sequence: **load → call domain → check Result → save → publish events → return `ok(...)`.**
* Use `expectedVersion` for optimistic concurrency (optional now, useful later).

---

Would you like me to also adjust the **Entity mini-pattern** in `agents.md` so its methods (like `activate`) return your `Result` instead of `Either`?
