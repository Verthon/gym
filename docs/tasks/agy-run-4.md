# Run 4: agy coder, replication and CI=1

Created: 2026-09-28
Status: prep done (steps 1–3), paused at step 4 waiting on the repeat-plan decision. No agy run yet.

## Baseline changed on 2026-09-30 (read first)

Run 4 is no longer a clean replication of run 3. These changed after prep:

- Imports: `@/x.mjs` → `#/x.mts`, relative `./x.mjs` → `./x.mts` (ADR 0001). `acceptance.spec.mts` new hash `c6a434de7f932ad3ae3400df3a9512da469ea41fcc6f26bded9089192a319560`. `SPEC.md` unchanged.
- Skill: `.agents/skills/implement-spec/unit-tests.md` names `#/utils/test.mts` instead of `@/utils/test.mjs`.
- `AGENTS.md` was a self-reference (`@AGENTS.md`), so agents got no project instructions. It now points to `GOAL.md`.
- 36 stale `.mjs`/`.js` files deleted from `src/`. `tsconfig` has `noEmit` and `allowImportingTsExtensions`; the `build` script is gone.
- 10 design skills moved from `.agents/skills/` to `~/.claude/skills/`. agy now sees only `grilling`, `grill-with-docs`, `implement-spec`.
- Run 3's archived implementation (`~/.gemini/agy-runs/run-3/impl/`) still uses `@/…​.mjs` imports and won't type-check as-is.

Treat the next run as a new baseline (run 5), not as a repeat of run 3.

## State at handoff

- Baseline HEAD `554760006640b5e688c72beae29e5d69974a204e`. The skill under test is still `128298e`'s.
- `src/sandbox/locker/` holds only `SPEC.md` and `__tests__/acceptance.spec.mts`. Lock hashes were verified before and after prep:
  - `SPEC.md` `466740897a7abbb90c6d4ae8c8ca87f560d3361fcb1445769bd5b919516b4735`
  - `acceptance.spec.mts` `415d1862d40ce7c96bb544a99840bb7f577256b5fcbf06a7c4458911d1f5f4b6`
- Run 3's implementation is archived to `~/.gemini/agy-runs/run-3/impl/` (7 files, byte-checked).
- Metrics script: `~/.gemini/agy-runs/run-4-prep/metrics/agy_metrics.py`, with `pbraw.py` next to it (a minimal protobuf decoder, since there's no protoc on this machine).
- Raw CI=1 measurements: `~/.gemini/agy-runs/run-4-prep/ci/` (`*.raw` is the `script -q` capture; `*.txt` is the same capture with ANSI stripped).
- agy state untouched: `settings.json` has no allow-list, and no `brain/` cleanup has been done yet.

## Open decision

How many repeats per arm. Recommendation: 3× the unchanged run-3 config, and 1–2× CI=1 as a smoke test only (behaviour, `allowOnly`), without claiming anything about tokens. Adopt CI=1 based on the offline measurement below. The alternative is 3 + 3 as in `agy-findings-research.md` → Ranked changes, item 1. Options: 3 + 1, 3 + 2, 3 + 3.

## Remaining procedure (after the decision)

For each repeat:

1. Clean agy state as before run 2: archive `brain/`, `implicit/` and the conversation summaries.
2. Back up `~/.gemini/antigravity-cli/settings.json` and apply the allow-list from `coder-agent.md` → Harness facts. Run as in `agy-run-3.md` → Prompt step 3, with a `CI=1` prefix for that arm, and save the JSON output. Restore `settings.json` even on failure. Any `denied_actions` entry voids the run.
3. `python3 ~/.gemini/agy-runs/run-4-prep/metrics/agy_metrics.py <brain>/<id>/.system_generated/logs/transcript_full.jsonl --json <output.json>`
4. Archive the conversation and the implementation to `~/.gemini/agy-runs/run-4-<arm>-<n>/`. Reset `src/sandbox/locker/` to the locked files and re-verify the hashes.

Then write a per-run table, the median and range per arm, pass^k for "no git/find/ls after green" and "no reads outside the table", and a verdict on CI=1 and on whether run 3's results held.

## Results

### Offline CI=1 measurement

- **What the agent runs.** The agent runs `rtk pnpm check`, not `pnpm check`. rtk passes the output through unchanged. agy runs commands in a pseudo-terminal (CRLF, vitest's TTY progress) and strips the ANSI codes, so every `[queued]` redraw frame ends up in the context.
- **Method.** I ran `rtk pnpm check` under `script -q`, alternating the two arms, with run 3's implementation temporarily restored, and discarded one warm-up pair. Sizes below are ANSI-stripped. Tokens are chars/4, an approximation (no offline Gemini tokenizer).

| | run 1 | run 2 | run 3 | ≈ tokens |
|---|---|---|---|---|
| no CI | 5207 B | 4052 B | 5435 B | 1.0–1.4k |
| `CI=1` | 1439 B | 1437 B | 1437 B | ~0.36k |

- pnpm's output doesn't change: everything before vitest (pnpm, oxlint and tsc lines) is byte-identical in both arms. Only vitest's progress frames go away. The pnpm assumption in the research doc is checked.
- Inside agy the agent saw more: 6124 chars (run 2) and 6267 chars (run 3), because slower runs produce more frames. The saving per green check is about 2.6–4.8k chars, roughly 0.65–1.2k tokens.
- A red check that fails in lint saves nothing, because vitest never runs. Run 3's red check was one of these.
- Each saved result is re-sent on every later model call, so the saving per run depends on how many calls follow the check:
  - Run 3: about 1.2k tokens (the green check was re-sent once). That's about 0.2% of 642k processed.
  - Run 2: about 10k tokens (the check was re-sent 7 times, plus one narrow vitest run). That's about 1.3% of 746k, and mostly cache reads.
  - Failure loops like run 1 (~20 checks) would save more. Run 1's transcript is lost, so that case is unmeasured.
- Effect size vs. noise: one extra model call costs about 29k processed tokens (run 3: 642k / 22 calls). The CI=1 saving in a clean run is smaller than one extra step, so agent runs can't detect it in tokens at any feasible n. The offline number is the answer on tokens.

### Metrics script validation

- Tokens are not in `transcript_full.jsonl`. They're in the conversation `.db`, table `gen_metadata`, one protobuf row per model call:

  | Field | Meaning |
  |---|---|
  | `1.4.2` | uncached input |
  | `1.4.5` | cache read |
  | `1.4.3` | output |
  | `1.4.9` | thinking |

  The mapping was identified against run 3's JSON output and matches to the token.
- Validation against `agy-run-2.md` → Results:

| | script | doc | |
|---|---|---|---|
| input uncached / cached | 249930 / 495868 | 250k / 496k | ✓ |
| output / thinking / total | 10217 / 5649 / 260147 | 10k / 5.6k / 260k | ✓ |
| steps | 52 | 52 | ✓ |
| `pnpm check` | 1, green | 1, green | ✓ |
| after green | 6 (5 `git`, 1 `find`) | 5 `git` + 1 `find` | ✓ |
| reads outside table / markers | 0 / 0 | none / none | ✓ |
| tool calls | 25 calls, 26 model calls | "26 tool calls" | definition |
| duration | 107 s | 111 s | source |

- **Tool calls:** the earlier docs count these inconsistently. Run 2's "26" is model calls, and run 3's "21" is steps containing tool calls (it made 22 calls). The script prints all three counts. From run 4 on, report model calls and tool calls separately.
- **Duration:** transcript timestamps exclude startup and the final turn, so they read about 4–5 s short (run 3: 103 s from timestamps vs 108.1 s in the JSON). Run 2's JSON wasn't archived. Always pass `--json`, which also reports `denied_actions`.
- **Run 3 check:** the script reproduces run 3's Results too: 2 checks (red, then green), 0 calls after green, and `PersonId.mts` as the one read outside the table.
