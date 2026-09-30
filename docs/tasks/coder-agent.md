# Coder agent and coder skills

Created: 2026-09-28
Status: in progress, resume from `agy-run-3.md`

## Goal

A first version of the coder agent (agy, Gemini default model) and the skills it loads, so it can implement a locked spec in this repo cheaply and without supervision. Input: `docs/tasks/agy-dry-run.md` → Results.

## What the dry run showed

- The coder follows `docs/architecture/` well when it finds it. The implementation matched every building-block rule.
- The locked-test rule held: it stopped and reported a defect in the acceptance test instead of editing it or `tsconfig.json`.
- Its unit tests restate the acceptance criteria. One would pass without `save`. It ignores `Result` in setup and hand-rolls helpers instead of `@/utils/test.mjs`.
- Cost: 126 steps, 518k input tokens. Thinking was only 24k, so effort level is not the driver. Drivers: exploring the repo with no map (`AGENTS.md` empty), about 20 `pnpm check` retries against an unfixable lint error, repeated `git status` / `git diff` to check the lock.
- Runs 1 and 2 died on headless permission denials.

## Harness facts (agy 1.2.12)

- `agy -p --mode accept-edits` auto-denies every shell command. One denial ends the run with `status: SUCCESS`, empty `response`, and a `denied_actions` entry. Always check `denied_actions`.
- Allow-rules: `permissions.allow` in `~/.gemini/antigravity-cli/settings.json`, syntax `command(<prefix>)`. Project-scoped grants exist (`ApplyProjectPermissionGrants` in the log); location not found yet.
- agy loads `~/.gemini/AGENTS.md` globally. It says to prefix commands with `rtk`, so rules need `rtk ` and `rtk proxy ` variants. It also carries "no comments" and "ask instead of assuming", so repo-level rules can't be evaluated in isolation.
- Model is not in the JSON output. It's in `~/.gemini/antigravity-cli/conversations/<id>.db` and the CLI log.
- Repo skills: agy reads `<workspace>/.agents/skills/<name>/SKILL.md` and `~/.gemini/config/skills/<name>/`, plus rules from `GEMINI.md`, `AGENTS.md`, `.agents/rules/*.md` and workflows from `.agents/workflows/*.md` (from strings in the agy binary, not docs). `.claude/skills/*` already symlink to `.agents/skills/*`, so both agents can share one file. `--disable-slash-commands` mentions "skill expansion in print mode", so `/implement-spec` in a `-p` prompt probably expands. Not verified.
- Allow-list that worked: `ls cat find grep rg head tail wc tree pwd`, `git status|diff|log|show`, `pnpm check|lint|type-check|test:unit`, `pnpm exec vitest|tsc|oxlint`, `vitest tsc oxlint`, each with `""`, `rtk `, `rtk proxy ` prefixes.

## Skills to write (initial versions)

1. `implement-spec`: the coder's main loop. Read the spec and locked tests, then the repo map, then implement bottom-up (VO → entity → events → repository → service), then run `pnpm check`. Stop conditions: a locked file is wrong, a failure can't be fixed inside the allowed paths, or the same check fails N times in a row with the same error. Report format: what's done, check status, defect with file:line, proposed fixes.
2. `unit-tests-below-seam`: tests cover what acceptance tests don't (edge cases, port failures, invariants, event shape). Never restate an AC. Assert `Result`s in setup. Use `#/utils/test.mts`. Use a recording fake when persistence matters.
3. `repo-map`: short index of where things live and which reference implementation to copy per building block. Could be the new `AGENTS.md` instead of a skill.
4. Spec-author side (Claude): `to-spec` from P1 Next 4, plus a lock gate. Acceptance tests must pass `pnpm lint` and fail only on missing modules before hashing.

Decided 2026-09-28: `AGENTS.md` stays minimal. One skill, `.agents/skills/implement-spec/`, loads context in steps: `SKILL.md` holds the loop, stop rules, report, and a table mapping each building block to its `docs/architecture/` file, read only when that block is written. `unit-tests.md` is read only before writing unit tests. This replaces skills 2 and 3. Docs win over reference code: `PersonId.mts` returns a hand-rolled union instead of `Result` and has an unneeded `toString`.

## Coder agent definition

- Prompt template: the five rules from the dry run plus "unit tests cover what acceptance tests don't" and the stop-after-N-failures rule.
- Permissions: project-scoped allow-list, not the global settings.
- Effort: start at medium and compare tokens against the dry-run baseline once the lint gate and `AGENTS.md` are fixed.
- Post-run checks (Claude): hashes, no `.skip`/`.only`/`.todo`, `git status` scoped to the allowed path, `denied_actions` empty, model and token usage from the store.

## Open questions

- Where agy reads repo skills from (`.agents/skills/`?) and whether Claude Code can share the same files.
- Project-scoped agy permission file: path and format.
- Run agy with a clean global `AGENTS.md`, or accept the confound?
- Stop-after-N value.

## Next

1. [x] Fix blockers from the dry run: `events.md` trimmed to code, `building-blocks.md` link fixed. `AGENTS.md` left alone on purpose.
2. [ ] Find agy's repo skill path and project permission file. Skill path confirmed (`.agents/skills/`); permission file still unknown.
3. [x] Write `implement-spec` (includes `unit-tests.md`)
4. [x] Decide `repo-map`: folded into `implement-spec`'s Load on demand table
5. [ ] Add the lock gate to P1 decision 5
6. [x] Rerun the locker task at medium effort: run 2, see `agy-run-2.md` → Results
7. [ ] Run 3: apply skill edits, rerun, compare. Resume from `agy-run-3.md`
