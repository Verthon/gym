# Skill runs — 2026-09-28

The ported architecture skills, each run once against the docs and code as of commit `5547600` plus the uncommitted docs. They ran non-interactively: questions a skill would ask were answered by the agent and marked **inferred** / **assumed** / (A) / (X) in each report. Nothing in `src/` was changed.

| Skill | Output | Top finding |
|---|---|---|
| problem-classifier | [report](problem-classifier/report.md) | Mostly CRUD + lifecycle. Contention only at signing (two signers) and offer review — both conditional on how the process runs |
| requirements-critic | [report](requirements-critic/report.md) | 1-month duration vs 3-month minimum commitment. Offering doesn't validate the fees Contracting rejects |
| aggregate-designer | [report](aggregate-designer/report.md) | "No aggregates" holds only if signatures are collected in one session and payment callbacks are deduplicated by reference |
| test-strategy-reviewer | [report](test-strategy-reviewer/report.md) | `ContractDraft.spec` fails from 2028-04-15. `UnsignedContract` is tested in one signing order only |
| linguistic-boundary-verifier | [report](linguistic-boundary-verifier/report.md) | `src/money` mixes generic Money with Offering's fee terms. `PersonId` lives in `draft/`. `TEST_ID` is in the domain. JPY breaks the fee caps |
| context-distiller | [report](context-distiller/report.md) | Recurring charges (dues months 2…N, penalties) have no owning context. Customer ≠ payer for minors |
| pricing-archetype-mapper | [report](pricing-archetype-mapper/report.md) | Level 2 today. Don't build an engine unless dues vary by duration or discounts arrive |
| accounting-archetype-mapper | [report](accounting-archetype-mapper/report.md) | Fits Billing, not Contracting. A receivable ledger per contract answers "outstanding payments" |
| archetype-scanner | [summary](archetype-scanner/fit/summary.md) | Pricing → Contracting snapshot → Billing is the hand-off chain |

## Decisions the reports need from you

1. Can the Customer sign remotely? (decides locking at signing, and the consumer-withdrawal exception to FR-C15)
2. Who owns recurring billing — the gym (a Billing context) or the payment provider?
3. Is the 1-month duration valid given the 3-month minimum commitment?
4. Do monthly dues vary by duration?
5. Is editing an offer frozen once it's submitted for review?
