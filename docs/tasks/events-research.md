# Events research

Created: 2026-10-11
Status: open, next session

## Goal

Find out what matters for events in this project and what issues the current event code has. Use the global skills that cover events, then decide what to fix and what to defer. Input: `docs/architecture/events.md`, `docs/tasks/event-publisher.md`.

## Skills to use

No global skill is dedicated to events. These cover them in part (`~/.claude/skills/`):

| Skill | Event angle |
|---|---|
| `problem-classifier` | Integration class: published language vs point-to-point, orchestration vs choreography, event-refreshed read models, chronological invariants |
| `linguistic-boundary-verifier` | Events crossing bounded contexts, ACL for events. Needs a `language.md` per module, which we don't have; the skill drafts it from code first |
| `aggregate-designer` | Fact/event vs command, immediate vs eventual consistency. Contracting has no aggregates (decided 2026-09-27, stages are entities), so use it only for the fact/command split |
| `context-distiller` | The same noun with different events in different contexts. Relevant once Pass Registration consumes `ContractStarted` |

First step: confirm this is the right set, or whether the skill you meant lives in another repo (`repo-router`).

## Known issues

- `docs/domain.md` misses `ContractSuspended` and `ContractExpired` (`event-publisher.md` Open).
- `ContractPrepared` has no `preparationDate` in its payload. FR-C09 ("both signatures within 30 days of the preparation date") needs it.
- `UnsignedContract` stores signing times as `Instant`. FR-C09 counts days, so signature dates may need to be `LocalDate`.
- No external event or mapper exists yet. `events.md` says the mapper serializes `occurredAt` to an ISO string.
- Metadata (`id`, `sourceId`, `causationId`, `correlationId`) and the publisher are deferred until a consumer or an outbox exists.

## Decisions

1. The skill set is confirmed (2026-10-11). `repo-router` finds no other repo that covers events.
2. Contract start and pass issuance are independent (choreography). The contract stays active whatever happens to the pass. Pass Registration reacts to `ContractStarted` with an idempotent consumer: a technical failure is retried. The "no active pass of the same type" rule belongs to Pass Registration (D4 in `architecture/functional-requirements.md`; `docs/domain.md` is stale on this), so Pass Registration can reject. It emits a named rejection event (e.g. `PassIssuanceRejected`), staff resolve it by hand, and Contracting does not react. Basis: Glofox, PerfectGym and Mindbody derive access from membership state, staff resolve failures, and none of them rolls back the contract.
3. `ContractActivated` is renamed to `ContractStarted`, both internally and for the future external event (carries out D2 in `architecture/functional-requirements.md`).
4. The internal `ContractStarted` payload stays `{ personId, fees }` until Pass Registration exists. Target shape of the external event: `ContractStarted { contractId, customerId, startDate, endDate, servicePackage }`, primitives only, no fees (`events.md` rule 3). It depends on FR-C01 (contract ID), FR-C09 and FR-C14 (dates), and on where the pass type comes from.
5. `ContractSigned` is emitted once, when the second signature arrives, in either signing order. `toSignedContract` only checks state. Covered by `UnsignedContract.spec.mts`.

## Open (from problem-classifier)

- Can two `ContractStarted` events for one customer be processed at the same time? If not (one sequential consumer), a unique constraint enforces the pass rule. If they can, it is Resource Contention inside Pass Registration. Decide when Pass Registration is built.
- "Pass type" appears nowhere in the Contracting model or in the published-language table (`docs/skill-runs/linguistic-boundary-verifier/report.md:16`).
