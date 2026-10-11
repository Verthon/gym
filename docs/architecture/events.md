# Domain Events

An event is an immutable fact from the past, named in past tense (`ContractSigned`).

## Every event carries

| Field        | Purpose               |
| ------------ | --------------------- |
| `type`       | Unique string literal |
| `occurredAt` | When it happened, `Temporal.Instant` |
| `payload`    | Event data            |

All fields are `readonly`.

`occurredAt` is metadata: it orders events and gives the audit trail a time of day. A business date that a rule depends on (e.g. a preparation date) goes into the payload as `LocalDate`. The application service reads the clock once and derives the business date from the same instant, so the two always agree.

Not yet: `id`, `sourceId`, `causationId`, `correlationId`. Add them when commands and transport exist; don't invent them before.

## Two kinds

|                  | Internal                          | External (integration)                  |
| ---------------- | --------------------------------- | --------------------------------------- |
| Scope            | Inside one bounded context        | Public contract between bounded contexts |
| Payload          | Domain concepts allowed (VOs, `LocalDate`) | Primitives only, `occurredAt` as ISO string |
| Versioning       | None, compiler enforces latest    | Explicit version, old versions supported |
| Consumers import | Producer's types                  | Only the published contract             |
| Persisted        | Rarely (event sourcing)           | Usually (outbox)                        |

## Rules

1. Domain objects emit internal events only.
2. An external event is created by an explicit mapper at the bounded context boundary, never by exposing an internal one.
3. Value objects never appear in an external event.
4. Changing an external event means a new version, not an edit.
5. Events are declared per domain object in its `events.mts`, so one file shows everything it emits.

Publishing and transport are out of scope here.
