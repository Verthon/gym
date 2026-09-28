# Domain Events

An event is an immutable fact from the past, named in past tense (`ContractSigned`).

## Every event carries

| Field           | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `id`            | Unique; identifies this exact occurrence (retries)   |
| `type`          | Unique string literal                                |
| `occurredAt`    | When it happened                                     |
| `sourceId`      | Which domain object emitted it                       |
| `causationId`   | ID of the command that caused it                     |
| `correlationId` | Shared by all events resulting from one command      |
| `payload`       | Event data                                           |

All fields are `readonly`.

## Two kinds

|                  | Internal                          | External (integration)                  |
| ---------------- | --------------------------------- | --------------------------------------- |
| Scope            | Inside one bounded context        | Public contract between bounded contexts |
| Payload          | Domain concepts allowed (VOs, `LocalDate`) | Primitives only                |
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
