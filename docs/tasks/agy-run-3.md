# Run 3: agy coder, skill fixes from run 2

Created: 2026-09-28
Status: not started, paste the prompt below into a new Claude Code session

## State at handoff

- Run 2 done. Full findings: `docs/tasks/agy-run-2.md` → Results. Run 1 findings: `docs/tasks/agy-dry-run.md` → Results.
- `src/sandbox/locker/` holds run 2's implementation (5 source files, 3 unit test specs) plus the locked `SPEC.md` and `acceptance.spec.mts`. Left for the user to review; delete it before run 3.
- Lock hashes (unchanged through run 2):
  - `SPEC.md` `466740897a7abbb90c6d4ae8c8ca87f560d3361fcb1445769bd5b919516b4735`
  - `acceptance.spec.mts` `415d1862d40ce7c96bb544a99840bb7f577256b5fcbf06a7c4458911d1f5f4b6`
- Uncommitted doc fixes from run 2: `docs/architecture/events.md` (metadata fields moved to "Not yet"), `docs/architecture/building-blocks.md` (link to `../../architecture/error-handling-strategy.md`).
- agy state: run 1's and the probe's conversations were moved to a Claude scratchpad (`agy-run1-backup/`) that won't survive the session. Run 2's conversation `bdcbb3de-a35d-4428-97c8-99aeaea33517` is still in `~/.gemini/antigravity-cli/{brain,conversations}` and `conversation_summaries.db`. Move it aside before run 3.
- `~/.gemini/antigravity-cli/settings.json` restored to its pre-run state (no allow-list).

## Run 2 in one table

| | Run 1 | Run 2 |
|---|---|---|
| Tokens total / input | 518k / 483k | 260k / 250k |
| Steps | 126 | 52 |
| Duration | 255 s | 111 s |
| `pnpm check` attempts | ~20 | 1 (green) |
| `git` calls | repeated | 5 after green (forbidden by skill) |

Confound: run 1's retries came from the unfixable lint error in the locked test, fixed before run 2.

## Settled

- `/implement-spec` in an `agy -p` prompt expands the skill (injected as `<SKILL>` in the user turn).
- agy reads `<workspace>/.agents/skills/<name>/SKILL.md`.
- Coder reads only the docs in the skill's table when scoped this way; no reference implementations opened.
- Model: `gemini-3.8-flash`, medium effort. Model name comes from the CLI log (`~/.gemini/antigravity-cli/log/cli-*.log`) and the conversation `.db`, not the JSON output.
- Transcript with every tool call: `~/.gemini/antigravity-cli/brain/<conversation_id>/.system_generated/logs/transcript_full.jsonl`.

## Skill edits to apply (proposed in run 2, not yet applied)

1. `SKILL.md` step 5: "When `pnpm check` is green, write the report immediately. Don't run `git`, `find`, or `ls` to verify anything."
2. `unit-tests.md` Don't: "Ignore any `Result` in setup, including entity methods (`success(locker.assign(...))`)."
3. `unit-tests.md` Don't: "Add more values to a partition an AC already tests." And: "Name a test for what it asserts; 'no duplicates' needs a count."
4. `SKILL.md` Load on demand: "Each doc ends with reference implementations" → "Some docs end with…" (`events.md`, `repository.md` have none).
5. `SKILL.md` step 2 order: Value Objects → events → entities → repository → application service.
6. Outside the skill: non-interactive vitest for agents (`CI=1` in agy's env or `--reporter=dot` in `test:unit`). Progress frames inflate input tokens.

## Open

- Commit the `events.md` / `building-blocks.md` fixes, the skill, and the task docs?
- Project-scoped agy permission file: path and format still unknown. Run 2 used the global `settings.json` again.
- Global `~/.gemini/AGENTS.md` still loaded (rtk prefix, "no comments", "ask instead of assuming"). Accept the confound or run with it moved aside?
- Stop-after-N stays at 3 (not triggered in run 2).
- `AGENTS.md` self-reference left alone on purpose.
- Test-design helper skill (equivalence partitions, boundary values, name ↔ assertion), written for a less experienced developer. Not before run 3: it would confound the comparison.

## Prompt

```
Third iteration of the agy coder run on the locker task. Read docs/tasks/agy-run-3.md first; docs/tasks/agy-run-2.md → Results only if you need detail.

1. Ask me which of "Skill edits to apply" 1–6 to apply and which "Open" items to settle. Apply what I approve.
2. Baseline: `git rev-parse HEAD`, `git status --porcelain`, verify both lock hashes. Mismatch → STOP.
3. Delete run 2's implementation from src/sandbox/locker/ (keep SPEC.md and __tests__/acceptance.spec.mts) after showing me the file list. Move run 2's agy conversation aside to a folder I name.
4. Back up ~/.gemini/antigravity-cli/settings.json, apply the allow-list from coder-agent.md → Harness facts, restore after the run.
5. Run from the repo root, medium effort:
   agy -p "/implement-spec Spec: src/sandbox/locker/SPEC.md. Locked tests: src/sandbox/locker/__tests__/acceptance.spec.mts. Allowed folder: src/sandbox/locker/." --mode accept-edits --effort medium --output-format json > <scratchpad>/agy-run-3.json
   Any `denied_actions` entry voids the run.
6. Evaluate against runs 1 and 2 with the same checklist as agy-run-2.md → Results: model, tokens, steps, duration; files read; pnpm check attempts; git calls; lock, containment, no .skip/.only/.todo; code review against docs/architecture/; unit tests against unit-tests.md; report format; verdict and skill edits. Don't fix anything.
7. Write findings to docs/tasks/agy-run-3.md → Results. Leave src/sandbox/ for me.
```

## Results
