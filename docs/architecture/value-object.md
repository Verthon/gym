# Value Object

Purpose: capture a descriptive concept (e.g. `Money`, `PersonId`).

## Rules

- Immutable: `private readonly` fields, no setters.
- Private constructor; created only through a static factory returning `Result<VO, VOError>`.
- Validation in the factory, fail-fast, cheapest checks first.
- Errors are a union of `{ code }` objects, with `context` where it helps.
- Equality by all properties (`equals`).
- Behaviors allowed if they don't mutate state; operations return a new VO.
- Composable, pure, no side effects.
- Doesn't read the current time. Takes `asOf: LocalDate` for date rules from the caller, so tests set the time instead of racing the clock.
- Tests are small units.

## Pattern

```ts
export type PersonIdError =
  | { code: "EMPTY" }
  | { code: "TOO_SHORT"; context: { value: string } };

export class PersonId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string | null | undefined): Result<PersonId, PersonIdError> {
    if (!input) return err({ code: "EMPTY" });
    const v = input.trim();
    if (v.length < 3) return err({ code: "TOO_SHORT", context: { value: input } });
    return ok(new PersonId(v));
  }

  equals(other: PersonId): boolean {
    return this.value === other.value;
  }
}
```

Reference implementations: `src/contracting/draft/PersonId.mts`, `src/money/Money.mts`.
