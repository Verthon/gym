# Repository

Purpose: port for loading and saving one entity type. Domain-facing interface; implementations live in infrastructure.

## Rules

- `get` returns the entity or `null`. Absence is an expected outcome, not an error.
- `save` persists the entity.
- Infrastructure failures reject the promise. No `Result`: callers cannot act on them. They propagate to the top-level handler, which logs and returns a generic 500.
- No versioning or optimistic locking in Contracting (no concurrent contention).
- Speaks domain types only; no storage details in the signature.

## Pattern

```ts
export interface ContractDraftRepository {
  get(id: string): Promise<ContractDraft | null>;
  save(id: string, draft: ContractDraft): Promise<void>;
}
```
