# Skill runs — 2026-10-25

Blind runs, to compare against CodeRabbit. Each skill ran in a fresh agent that knew the skill and the code scope but not the defects being looked for. Target A: `src/contracting/unsigned-contract/` at `290ff38`, read with `git show`. Target B: the working tree on `77b3948`, draft and signed-contract, with the uncommitted FR-C14 diff. Scoring is in `docs/research/tooling/08-hosted-code-analysis.md`, "Blind skill runs vs CodeRabbit".

| Skill | Report | Findings (A / B) |
|---|---|---|
| aggregate-designer | [report](aggregate-designer.md) | 9 / 15 |
| requirements-critic | [report](requirements-critic.md) | 12 / 34 |
| test-strategy-reviewer | [report](test-strategy-reviewer.md) | 6 / 20 |

Only two extras are verified: `test-strategy-reviewer` B4 (`toMatchObject` on `Temporal.Instant`) and `requirements-critic` B4 (FR-C03 vs FR-C15). The rest are unverified.

The 2026-09-28 runs (`../README.md`) had already reported the 1-month vs 3-month conflict and the single signing order in `UnsignedContract`'s tests. Neither became a task.
