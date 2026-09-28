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

1. Snapshot. agy runs in this working tree, which has uncommitted work. Before anything, copy the tree (excluding node_modules, .git, dist) to <scratchpad>/pre-run so we can prove agy touched nothing outside src/sandbox/locker/.

2. Spec. Write src/sandbox/locker/SPEC.md using the template from P1 decision 7, minimal, AC IDs AC-LK-01….

3. Acceptance tests. Write src/sandbox/locker/__tests__/acceptance.spec.mts through the assignLocker seam and the Locker/LockerNumber public API, test names prefixed with AC IDs, Given/When/Then. They must fail (missing modules is fine). Show me the spec and tests. STOP for review.

4. Lock. After I approve, record sha256 of SPEC.md and acceptance.spec.mts.

5. Run agy from the repo root, non-interactive, no --model flag (default model):
   agy -p "<coder prompt>" --mode accept-edits --output-format json > <scratchpad>/agy-run.json
   Coder prompt contains only: the spec and test paths; "work only inside src/sandbox/locker/"; "do not edit, skip, or delete acceptance tests or SPEC.md; if one looks wrong, stop and report"; "follow AGENTS.md and docs/architecture/"; "write your own unit tests below the seam"; "run pnpm check until green". No hints at the solution. Check `agy --help` first; if print mode can't edit files without approval, ask me before using --dangerously-skip-permissions.

6. Evaluate. Don't fix anything yourself. Report:
   - Model agy actually used (from the JSON output), turns/duration if available.
   - pnpm check result.
   - Containment: diff -r against <scratchpad>/pre-run shows changes only in src/sandbox/locker/.
   - Lock integrity: both hashes unchanged, no .skip/.only/.todo anywhere.
   - Code review against docs/architecture/: private constructors + Result factories, { code } errors, state union, events via pullEvents, repository returns null / no Result, service shape, no comments, no scope creep.
   - Its own unit tests: present, meaningful, or padding?
   - Did it stop and report on anything ambiguous, or guess?
   - Verdict and concrete changes to AGENTS.md / docs / coder prompt for the next run.

7. Write findings to docs/tasks/agy-dry-run.md → Results. Leave src/sandbox/ in place for me to inspect; I'll tell you when to delete it.
```

## Results

Pending.
