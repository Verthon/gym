# Building Blocks

| If you need… | Choose | Key traits |
|---|---|---|
| Stable identity, lifecycle changes, event emission | [Entity](entity.md) | has typed id, mutable only via behaviors |
| Pure description, no identity, safe reuse | [Value Object](value-object.md) | immutable, structural equality |
| Orchestration of one use case | [Application Service](application-service.md) | no business rules, depends on ports |
| Load and save an entity | [Repository](repository.md) | port, `null` on absence, throws on infrastructure failure |
| A fact that happened | [Domain Event](events.md) | immutable, past tense |

Errors: every operation that can fail returns `Result<T, E>` from `@/utils/Result.mjs`. See [error-handling-strategy.md](../../architecture/error-handling-strategy.md).
