# Contracting — Context

Purpose: prepare a membership contract, get it signed by both parties, and activate it once paid.

Flow: Draft → Unsigned Contract → Signed Contract → Active Contract

Out of scope: offering, pass registration, payment processing (payment system is external).

Decisions: `docs/tasks/event-publisher.md`

## Stage handoff

Each stage has its own actors and policies (`docs/domain.md`), so each stays a separate model. Stages do not import each other. The only exception is `draft/PersonId.mts`.

The handoff from one stage to the next is production code in one place: `src/contracting/process/` (the orchestrator).

- Each stage's `index.mts` exports a plain-data snapshot of its result. The orchestrator reads one stage's snapshot and calls the next stage.
- `process/` is the only code that imports `<stage>/index.mts`.
- Why this exists: two coders collapsed the stages into one entity when the handoff was undefined (`docs/tasks/agy-run-5.md`). The arch check constrains imports, not where behaviour lives, so a missing handoff is not caught.
- The orchestrator reads the clock once and derives the business date (`asOf`) in the gym time zone. Domain objects receive a `LocalDate`, not a time zone.

### Contract ID

One contract has one ID value from draft to active. Each stage wraps the value in its own typed ID (`ContractId`, `ActiveContractId`, …); the orchestrator converts with `Id.create(other.toString())`.

Cost: the per-stage ID classes are identical and are kept in sync by convention, not by a check.

## Cross-stage acceptance tests

- They live in `src/contracting/__tests__/`.
- They import only `process/index.mts`, `src/utils/` and vitest. They do not import any `<stage>/index.mts`.
- `process/index.mts` exports an in-memory wiring (repositories, read-model fakes) for tests and composition.
- They call public use cases only and never pass data from one stage to another. The orchestrator does that. `pnpm arch` enforces the imports.
- Per-stage acceptance tests stay in `<stage>/__tests__/`.
