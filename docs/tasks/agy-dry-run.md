# Dry run: agy (Gemini default model) as coder

Created: 2026-09-28
Status: ready, paste the prompt below into a new Claude Code session

## Prompt

```
We're doing a dry run of the spec-first workflow from docs/tasks/P1-spec-first-workflow.md on a throwaway task: you (Claude) write a spec and locked acceptance tests, agy with its default Gemini model implements, you evaluate. Everything lives in src/sandbox/locker/ and gets deleted afterwards. Read the P1 file, AGENTS.md, and docs/architecture/building-blocks.md (plus the files it links) first.

Task (artificial): locker rental.
- LockerNumber: Value Object, integer 1–200.
- Locker: Entity identified by LockerNumber. States: Free, Assigned (to a PersonId from src/contracting/draft/PersonId.mts). assign(personId, at: LocalDate) and release(at). Assigning an assigned locker or releasing a free one fails with a { code } error. Emits LockerAssigned / LockerReleased internal events via pullEvents(), declared in events.mts.
- LockerRepository port + in-memory implementation, per docs/architecture/repository.md.
- assignLocker application service per docs/architecture/application-service.md: NOT_FOUND when the locker doesn't exist, maps domain errors to { code }.

Steps:

1. Baseline. `git status --porcelain` must be empty; if not, STOP and ask me. Record `git rev-parse HEAD`.

2. Spec. Write src/sandbox/locker/SPEC.md using the template from P1 decision 7, minimal, AC IDs AC-LK-01….

3. Acceptance tests. Write src/sandbox/locker/__tests__/acceptance.spec.mts through the assignLocker seam and the Locker/LockerNumber public API, test names prefixed with AC IDs, Given/When/Then. They must fail (missing modules is fine). Show me the spec and tests. STOP for review.

4. Lock. After I approve, record sha256 of SPEC.md and acceptance.spec.mts.

5. Run agy from the repo root, non-interactive, no --model flag (default model):
   agy -p "<coder prompt>" --mode accept-edits --output-format json > <scratchpad>/agy-run.json
   Coder prompt contains only: the spec and test paths; "work only inside src/sandbox/locker/"; "do not edit, skip, or delete acceptance tests or SPEC.md; if one looks wrong, stop and report"; "follow AGENTS.md and docs/architecture/"; "write your own unit tests below the seam"; "run pnpm check until green". No hints at the solution. Check `agy --help` first; if print mode can't edit files without approval, ask me before using --dangerously-skip-permissions.

6. Evaluate. Don't fix anything yourself. Report:
   - Model agy actually used (from the JSON output), turns/duration if available.
   - pnpm check result.
   - Containment: `git status --porcelain` and `git diff <baseline>` show changes only in src/sandbox/locker/.
   - Lock integrity: both hashes unchanged, no .skip/.only/.todo anywhere.
   - Code review against docs/architecture/: private constructors + Result factories, { code } errors, state union, events via pullEvents, repository returns null / no Result, service shape, no comments, no scope creep.
   - Its own unit tests: present, meaningful, or padding?
   - Did it stop and report on anything ambiguous, or guess?
   - Verdict and concrete changes to AGENTS.md / docs / coder prompt for the next run.

7. Write findings to docs/tasks/agy-dry-run.md → Results. Leave src/sandbox/ in place for me to inspect; I'll tell you when to delete it.
```

## Results

Run: 2026-09-28. Baseline `7dd5c89`, tree dirty only with this file (sha256 unchanged through the run).

### Run facts

- Model: `gemini-3.8-flash` (High), from the agy conversation store and CLI log. The JSON output has no model field.
- Final run: 1 turn, 255 s, 518k total tokens (483k input, 35k output, 24k thinking, 2.36M cache read).
- Two failed runs first, both on permissions (see Harness).

### Harness

- `--mode accept-edits` in print mode auto-denies every shell command. One denied command ends the whole run with `status: SUCCESS` and an empty `response`; only `denied_actions` shows it.
- Fix used: `permissions.allow` in `~/.gemini/antigravity-cli/settings.json` with `command(<prefix>)` rules. A pnpm-only list failed on `rtk ls -la`; a list of read-only commands plus pnpm scripts, each with `""`, `rtk `, `rtk proxy ` prefixes, worked. Settings restored afterwards.
- agy loads `~/.gemini/AGENTS.md` (global): rtk prefix, "no comments", "ask instead of assuming". That global file, not the repo, is what agy actually got for style rules. Confound for "no comments" and "stop and report".

### Checks

- `pnpm check`: fails. Lint error in the locked test `acceptance.spec.mts:166` (`saved[0]!`, `no-unnecessary-type-assertion`, `noUncheckedIndexedAccess` is off). My defect: I didn't lint the tests before locking. Type-check passes, 80/80 tests pass, 18/18 acceptance.
- Containment: only `src/sandbox/locker/` untracked files. Nothing outside the repo was checked.
- Lock integrity: both hashes unchanged, no `.skip` / `.only` / `.todo`.

### Code review

- `LockerNumber`: private constructor, `Result` factory, `{ code }` errors, `equals`. Dead `typeof value !== "number"` guard. Unused `toString()` (only its own test uses it).
- `Locker`: private constructor, `create`, state union `Free | Assigned`, `Result` returns, private event buffer, `pullEvents()`. Clean.
- `events.mts`: `type`, `occurredAt`, `payload`, readonly, factories take `occurredAt` without a `today()` default (better than the reference). No `id` / `sourceId` / `causationId` / `correlationId`: matches the reference events, contradicts `events.md`.
- Repository: `null` on absence, no `Result`, keyed by `number.value`. Correct.
- Service: curried, load → domain → check → save → return, `NOT_FOUND | LockerError["code"]`. Exports input/error types, harmless.
- No comments. No scope creep beyond `toString`.

### Its unit tests

Mostly padding. `LockerNumber.spec`, `Locker.spec`, and 3 of 4 `LockerService.spec` cases restate the acceptance criteria. Its "assigns free locker and saves it" test would pass without `save` (same in-memory instance), the exact gap AC-LK-10 closes. Real additions: repository null/overwrite, save-failure propagation, `-Infinity`. Ignores `Result` in setup (`locker.assign(...)` unchecked), hand-rolls helpers instead of `success` from `@/utils/test.mjs`.

### Stop and report

Yes, correctly. It hit the lint error in the locked test, did not edit it or `tsconfig.json`, and reported cause plus two fixes. It did not report that `AGENTS.md` is empty. No ambiguity guessed at; the spec left none open except event metadata, which it resolved by following the reference code.

### Verdict

The implementation is correct and conforms to the docs. The locked-test rule held under pressure. Failures were on my side (unlinted locked test) and the harness (permissions, empty `AGENTS.md`, global config leak). Unit tests are the weak spot.

### Changes for the next run

1. Lock gate: before locking, acceptance tests must pass `pnpm lint` and fail `tsc` / vitest only on missing modules. Add to P1 decision 5.
2. `AGENTS.md` is a self-reference (`@AGENTS.md`, 10 bytes) since `7dd5c89`. Restore content or make it index `docs/architecture/`.
3. `events.md` vs reference events: either add the metadata fields to the references or drop them from the doc.
4. `building-blocks.md` links `architecture/error-handling-strategy.md` relative to `docs/`; the file is at repo root.
5. Coder prompt: "unit tests cover what the acceptance tests don't: edge cases, port failures, invariants; don't restate AC", and "use `@/utils/test.mjs` helpers".
6. Harness: keep a project-scoped agy allow-list instead of editing the global one; decide whether to run agy with a clean global `AGENTS.md` to remove the confound.
