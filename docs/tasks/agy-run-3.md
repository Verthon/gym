# Run 3: agy coder, skill fixes from run 2

Created: 2026-09-28
Status: prepared, paste the prompt below into a new Claude Code session

## State at handoff

- Run 2 done. Full findings: `docs/tasks/agy-run-2.md` → Results. Run 1 findings: `docs/tasks/agy-dry-run.md` → Results.
- Skill, doc fixes and task docs committed in `128298e`. The skill version under test is the one at that commit.
- `src/sandbox/` is untracked. `src/sandbox/locker/` holds only the locked files; run 2's implementation was deleted.
- Lock hashes (unchanged through run 2):
  - `SPEC.md` `466740897a7abbb90c6d4ae8c8ca87f560d3361fcb1445769bd5b919516b4735`
  - `acceptance.spec.mts` `415d1862d40ce7c96bb544a99840bb7f577256b5fcbf06a7c4458911d1f5f4b6`
- agy state: run 1's conversation is lost (was in a Claude scratchpad). Run 2's conversation `bdcbb3de-a35d-4428-97c8-99aeaea33517` archived to `~/.gemini/agy-runs/run-2/` (`brain/`, `.db`, copy of `conversation_summaries.db`; the original summaries db stays in place). Other conversations in `~/.gemini/antigravity-cli/` are not ours; leave them.
- `~/.gemini/antigravity-cli/settings.json` in its pre-run state (no allow-list).
- No `timeout`/`gtimeout` on this machine. Use the Bash tool's own `timeout: 600000` for the run.

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
- One variable per run: the global `~/.gemini/AGENTS.md` stays loaded (rtk, "no comments", "ask instead of assuming"), vitest reporter unchanged.
- Supervision: evaluate after the run, no live intervention; the skill's own stop-after-3 is under test. 600 s hard timeout.
- Archive each run's agy conversation to `~/.gemini/agy-runs/run-N/` after evaluation.

## Skill edits applied (from run 2)

1. `SKILL.md` step 5: write the report immediately after green; no `git`/`find`/`ls`. Prose only; `git status|diff` stays on the allow-list so a violation shows in the transcript instead of voiding the run.
2. `unit-tests.md` Don't: any `Result` in setup, including entity methods (`success(locker.assign(...))`).
3. `unit-tests.md` Don't: no extra values in a partition an AC already tests; name ↔ assertion ("no duplicates" → assert the count).
4. `SKILL.md`: "Some docs end with reference implementations."
5. `SKILL.md` step 2: "write a file only after the files it imports (typically VO → events → entities → repository → application service)". A rule, not a fixed chain.

Deferred: non-interactive vitest (`CI=1` for the agy run) → run 4, isolated. Running without the global `AGENTS.md` → separate later run.

## Open

- Project-scoped agy permission file: path and format still unknown. Run 3 uses the global `settings.json` again.
- Stop-after-N stays at 3.
- `AGENTS.md` self-reference left alone on purpose.
- Test-design helper skill (equivalence partitions, boundary values, name ↔ assertion), written for a less experienced developer. Not before run 3: it would confound the comparison.

## Prompt

```
Run 3 of the agy coder on the locker task. Read docs/tasks/agy-run-3.md first; docs/tasks/agy-run-2.md → Results only if you need detail. Preparation is done; don't change the skill.

1. Baseline: `git rev-parse HEAD`, `git status --porcelain`, verify both lock hashes, confirm src/sandbox/locker/ holds only SPEC.md and __tests__/acceptance.spec.mts. Mismatch → STOP.
2. Back up ~/.gemini/antigravity-cli/settings.json, apply the allow-list from coder-agent.md → Harness facts.
3. Run from the repo root with the Bash tool timeout at 600000 ms:
   agy -p "/implement-spec Spec: src/sandbox/locker/SPEC.md. Locked tests: src/sandbox/locker/__tests__/acceptance.spec.mts. Allowed folder: src/sandbox/locker/." --mode accept-edits --effort medium --output-format json > <scratchpad>/agy-run-3.json
   Restore settings.json right after, even on failure or timeout. Any `denied_actions` entry voids the run.
4. Evaluate against runs 1 and 2 with the same checklist as agy-run-2.md → Results: model, tokens, steps, duration; files read; pnpm check attempts; git/find/ls calls after green; lock, containment, no .skip/.only/.todo; code review against docs/architecture/; unit tests against unit-tests.md (edits 2 and 3 specifically); report format; verdict and skill edits. Extract numbers from the transcript with jq/grep instead of reading it whole. Don't fix anything.
5. Write findings to docs/tasks/agy-run-3.md → Results. Archive run 3's conversation to ~/.gemini/agy-runs/run-3/ (brain/, .db, copy of conversation_summaries.db, the CLI log). Leave src/sandbox/ for me.
```

## Results
