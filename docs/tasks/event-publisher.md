# Event publisher and internal events

Created: 2026-09-27
Status: resolved, publisher deferred

## Goal

Align event code with `docs/architecture/events.md` and resolve the `no-unsafe-type-assertion` error in `src/events/publisher.mts:14`.

## Drivers

- MVP scope is Contracting only. Pass Registration comes later.
- Stages create the next stage by direct method calls (`toSignedContract`, `toActiveContract`), not by reacting to events.
- The event storming board has no reactive policy inside Contracting. The purple policies are preconditions.
- In the MVP, events are recorded facts with no consumer.

## Decisions

1. `toGenericEvent` is removed. Domain objects keep typed internal events (rule 1).
2. There is no shared `DomainEvent` base type. `pullEvents()` returns each module's own event type (`ContractPrepared`, `ContractSigned`, `SignedContractEvent`, `ContractSuspended`).
3. Metadata fields (`id`, `sourceId`, `causationId`, `correlationId`) are deferred until events are published or persisted.
4. The publisher is deferred. `src/events/` is deleted, and `prepareUnsignedContract` no longer takes a `bus`.
5. The duplicate `ContractSigned` in `signed-contract/events.mts` is removed.

## Revisit when

- A real consumer exists (for example, Pass Registration reacting to `ContractStarted`), or events must be persisted (outbox).

## Open

- `docs/domain.md` is missing `ContractSuspended` and `ContractExpired`.
