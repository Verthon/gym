# agy coder: findings from runs 1–3

Created: 2026-09-28
Status: input for deep-research sessions
Sources: `agy-dry-run.md` → Results (run 1), `agy-run-2.md` → Results, `agy-run-3.md` → Results.

## Setup

- Coder: `gemini-3.8-flash` via `agy -p`, medium effort (run 1: High), `/implement-spec` skill, locker task in `src/sandbox/locker/`.
- Evaluator: Claude, after the run, no live intervention.

| | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Total tokens | 518k | 260k | 174k |
| Steps | 126 | 52 | 45 |
| Duration | 255 s | 111 s | 108 s |
| `pnpm check` runs | ~20 | 1 | 2 |
| Verification calls after green | repeated | 6 | 0 |
| Unit tests | padded | 11 | 3 |

## Findings, most important first

### 1. A rule works when it sits at the step where it applies

The "don't verify with `git`" rule was in a separate Locked files section in run 2 and was ignored: 6 calls, 23% of steps. Moved into step 5 ("when `pnpm check` is green, write the report immediately"), it was fully obeyed in run 3.

Research: instruction placement and recency effects in agent prompts. Do models follow rules better when they're attached to a workflow step than when they're in a separate constraints section? Is there published evidence on "lost in the middle" or on how far a rule sits from the point it's needed?

### 2. Cost comes from failure loops, not from the model

Run 1's ~20 retries came from a lint error in the locked test that the coder couldn't fix. Run 3's only waste (8 of 45 steps) was an undocumented convention: type-only imports under `verbatimModuleSyntax`. Each extra call re-sends the whole context, so input tokens grow with the number of steps.

Research: how agent token cost scales with the number of tool calls (context re-sending, cache reads). What practices exist for "pre-flight" environment checks before handing a task to a coding agent? Where should repo conventions that only a failed check reveals be documented for agents?

### 3. Precise rules with an example beat general ones

- "Ignore any `Result` in setup" didn't carry over to entity calls until the example `success(locker.assign(...))` was added.
- "Don't restate an AC" didn't stop partition padding until it said "more out-of-range integers".

Research: whether rules with examples beat abstract rules for LLM instruction-following. Are there studies on how well models generalize from one example? Could an example over-constrain, so the model applies the rule only to that exact case?

### 4. A single example is where it gets its patterns

In run 3 it opened `PersonId.mts` although `value-object.md` already answered the question. It then copied an unused `toString()`, despite "Don't copy members the spec doesn't need", and added `toNumber()` for a storage concern. Possible trigger: edit 4 ("Some docs end with reference implementations"), or it needed `PersonId`'s API because the spec imports it. The run can't separate the two.

Research: how agents weigh existing code against written rules when they conflict. Is it better to give agents reference code, or only patterns in the docs? What do agent tooling vendors (Anthropic, Google, GitHub) recommend on letting agents read existing code for patterns?

### 5. Free-text report fields get answered "none"

"Doc/code conflicts found: none" came back after it read a file that conflicts with the doc in two ways. A field with no concrete check behind it gets the default answer.

Research: structured self-report and self-verification in LLM agents. Do checklist-style report fields ("for each file X, state Y") improve honesty or accuracy over open fields? What does the evidence say about LLMs reliably reporting their own rule violations?

### 6. Scoped reading works

With a table mapping each building block to its doc, the coder read each doc just before writing that block (runs 2 and 3). It didn't read the domain docs or other bounded contexts.

Research: progressive disclosure and just-in-time context loading for agent skills (Anthropic Agent Skills docs). How do other harnesses (agy, Cursor rules, Copilot instructions) scope what an agent loads?

### 7. Fewer unit tests turned out better

Run 2's 11 tests included padding, an unchecked `Result` and an overclaiming name. Run 3's 3 tests cover only what the ACs miss (`-Infinity` pins the check order, plus two port failures). Test count says nothing about quality.

Research: how to evaluate the quality of agent-written tests beyond coverage (mutation testing, test that fails on a no-op implementation, name ↔ assertion checks). Equivalence partitioning and boundary value analysis as a rule set for a less experienced tester. This feeds the planned test-design helper skill.

### 8. The runs aren't clean comparisons yet

- The global `~/.gemini/AGENTS.md` loaded in every run.
- vitest's interactive progress output inflates input tokens.
- Run 1 had the broken locked test.
- Several skill edits land per run.
- n = 1 per configuration.
- Stop-after-3 has never actually triggered, so it's still untested.

Research: how to evaluate coding agents with small n. How much run-to-run variance should we expect at fixed settings, and how many repeats do we need to trust a difference? Existing agent eval harnesses (SWE-bench methodology, Anthropic's eval guidance) and what they control for.

## Open decisions carried over

- Run 4: isolate `CI=1` (non-interactive vitest), or bundle the four proposed skill edits from run 3.
- Spec-side fix: list the API of imported cross-context types (`PersonId`) in `SPEC.md`.
- Project-scoped agy permission file: path and format unknown.
- A run without the global `AGENTS.md`.
- Test-design helper skill.
