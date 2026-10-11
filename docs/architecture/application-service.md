# Application Service

Purpose: orchestrate a single use case. Translate input ⇄ domain, load, call the domain, persist, publish events. No business rules here.

## Rules

- One exported function per use case, curried over its dependencies: `(deps) => async (input) => Result`.
- Depends only on ports (repositories, publisher, `Clock`), never on infrastructure.
- Reads the clock once, from `deps.clock`, and derives `asOf` from that same instant, so the time and the date always agree. Passes `at` / `asOf` to the domain.
- Returns `ok(...)` / `err(...)` for expected outcomes; infrastructure failures from ports propagate as exceptions.
- Maps domain errors to `{ code }` errors at the boundary (`NOT_FOUND | DomainError["code"]`).
- Sequence: load → call domain → check `Result` → save → publish events → return.

## Pattern

```ts
type PrepareInput = { draftId: string };

export const prepareUnsignedContract =
  (deps: { drafts: ContractDraftRepository; clock: Clock }) =>
  async (input: PrepareInput): Promise<Result<void, { code: "NOT_FOUND" | ContractDraftError["code"] }>> => {
    const draft = await deps.drafts.get(input.draftId);
    if (!draft) return err({ code: "NOT_FOUND" });

    const at = deps.clock.instant();
    const asOf = LocalDate.fromInstant(at, deps.clock.timeZone);
    const r = draft.toNotSignedContract({ at, asOf });
    if (!r.success) return err({ code: r.error.code });

    await deps.drafts.save(input.draftId, draft);
    return okVoid();
  };
```

Reference implementation: `src/contracting/draft/ContractDraftService.mts`.
