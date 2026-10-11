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
| `context-distiller` | The same noun with different events in different contexts. Relevant once Pass Registration consumes `ContractActivated` |

First step: confirm this is the right set, or whether the skill you meant lives in another repo (`repo-router`).

## Known issues

- `UnsignedContract` emits `ContractSigned` twice on the path "customer accepts, then sales confirms" (`event-publisher.md` Open). No test covers it.
- `ContractActivated` in code vs "Contract started" on the board (`event-publisher.md` Open).
- `docs/domain.md` misses `ContractSuspended` and `ContractExpired` (`event-publisher.md` Open).
- `ContractPrepared` has no `preparationDate` in its payload. FR-C09 ("both signatures within 30 days of the preparation date") needs it.
- `UnsignedContract` stores signing times as `Instant`. FR-C09 counts days, so signature dates may need to be `LocalDate`.
- No external event or mapper exists yet. `events.md` says the mapper serializes `occurredAt` to an ISO string.
- Metadata (`id`, `sourceId`, `causationId`, `correlationId`) and the publisher are deferred until a consumer or an outbox exists.
