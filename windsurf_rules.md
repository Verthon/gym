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

- Immutable by design: No setters or mutators, all fields readonly.
- Only construct via static factory; never expose public constructor. Self-validated in factory.
- Once created, a VO’s state can never change—every change yields a new instance.
- Follows validation from least cost heavy for CPU and memory to most heavy one (fail-fast)
- Enforce all invariants/validation inside the factory—not outside, not in constructor.
- Can have methods with the behaviors as long it doesn't mutate state
- Equality by **all** properties (structural equality).
- Composition: VOs can contain other VOs, but never entities or aggregates.
- Pure helpers only (no side effects).
- Tests for VO would require few lines of code and should be simple units

### Mini-pattern

```ts
type IsbnErr = 'EMPTY'|'TOO_LONG'|'INVALID_CHARS'|'INVALID_LENGTH';
export class Isbn {
  private constructor(canon13: string) {}
  static create(input?: string):
    | {success:true; value:Isbn}
    | {success:false; error:IsbnErr} {
    if (!input) return {success:false, error:'EMPTY'};
    const raw=input.trim(); if (raw.length>40) return {success:false,error:'TOO_LONG'};
    let s=''; for (let i=0;i<raw.length;i++){ const c=raw[i];
      if (c===' '||c==='-') continue;
      if (!((c>='0'&&c<='9')||c==='x'||c==='X')) return {success:false,error:'INVALID_CHARS'};
      s+=c.toUpperCase();
    }
    if (s.length!==10 && s.length!==13) return {success:false,error:'INVALID_LENGTH'};
    const c13 = s.length===13? s : ('978'+s.slice(0,9)+'0'); // bez checksum, demo
    return {success:true, value:new Isbn(c13)}
  }
  equals(other:Isbn){ return this.canon13===other.canon13; }
  toString(){ return this.canon13; }
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

/** Entity root */
export class Member {
  private _status: 'Pending' | 'Active';

  constructor(
    private readonly _id: MemberId,
    private_email: Email,
    status: 'Pending' | 'Active' = 'Pending'
  ) { this._status = status; }

  static register(email: Email): Member {
    return new Member(MemberId.new(), email);
  }

  activate(): Either<'AlreadyActive', MembershipActivated> {
    if (this._status !== 'Pending') return left('AlreadyActive');
    this._status = 'Active';
    return right(new MembershipActivated(this._id));
  }

  // read-only accessors
  get id()     { return this._id; }
  get status() { return this._status; }
}
```

## One-Line Refresher

```
Entity  = identity + guarded mutability + events.
Value Object = immutable + no identity + pure logic.
```
