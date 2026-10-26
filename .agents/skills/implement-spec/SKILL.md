---
name: implement-spec
description: Implement a locked spec and its acceptance tests inside one allowed folder. Use when a prompt gives a SPEC.md path, locked acceptance tests, and an allowed path.
---

# Implement a locked spec

## Inputs

The prompt gives you a spec path, locked acceptance test paths, and one allowed folder. Read those files first. Read nothing else until a step below tells you to.

## Locked files

Never edit, skip, or delete the spec or the acceptance tests. Never edit files outside the allowed folder, including configs. The lock is verified after your run; don't check it with `git`.

## Steps

1. From the spec's Seam and Implementation decisions, list the building blocks you need.
2. Build bottom-up: write a file only after the files it imports (typically Value Objects → events → entities → repository → application service). Before writing a block, read only its row in the table below.
3. Before writing your own unit tests, read [unit-tests.md](unit-tests.md).
4. Run `pnpm check`. While fixing, narrow the loop: `pnpm exec vitest run <allowed folder>`, `pnpm lint`, `pnpm type-check`. The rule files are locked: `.githooks/`, `.github/`, `.claude/settings.json`, `.claude/hooks/`, `scripts/`, `.dependency-cruiser.cjs`, `pnpm-workspace.yaml`, `oxlint.config.mts`, `tsconfig.json`, `knip.config.ts`, `vitest.config.mts`, `stryker.config.mjs`, `package.json` scripts. If a check fails because of a rule, stop and report it; don't change the rule.
5. When `pnpm check` is green, write the report immediately. Don't run `git`, `find`, or `ls` to verify anything.

## Load on demand

| Writing | Read |
|---|---|
| Value Object | `docs/architecture/value-object.md` |
| Entity | `docs/architecture/entity.md` |
| Domain events | `docs/architecture/events.md` |
| Repository | `docs/architecture/repository.md` |
| Application service | `docs/architecture/application-service.md` |
| `Result` helpers | `src/utils/Result.mts` exports only |

Some docs end with reference implementations. Open one only if the doc's pattern doesn't answer your question. The doc is the rule: if a reference disagrees with it, follow the doc and list the conflict in the report. Don't copy members the spec doesn't need. Don't read `docs/domain.md`, `docs/tasks/`, or other bounded contexts unless the spec names them.

## Stop and report

Stop immediately and report when:

- a hook, a permission rule, or a git hook blocks a command or an edit;
- a check can't pass without changing a rule file;
- a locked file looks wrong (fails lint, contradicts the spec, can't pass);
- a fix needs a change outside the allowed folder;
- the same check fails 3 times in a row with the same error;
- the spec leaves a decision open that changes behavior.

When a guard blocks you, don't reach the same result another way: no other spelling, flag, tool, script, or change to the test or the rule. Commands after the blocked one in the same chain did not run, so don't assume their effects. If you can ask the user (AskUserQuestion), ask; otherwise end the run with the report.

## Report

- Done: files created, one line each.
- `pnpm check`: green, or the failing command and its first error.
- Stopped on: `file:line`, cause, the guard's message verbatim if a guard blocked you, up to two proposed fixes. Omit if you didn't stop.
- Doc/code conflicts found.
