# Research: deterministic tooling that offloads the agent — summary

Created: 2026-09-29
Input: `01`–`07` in this folder. Each claim, source and measurement is in the numbered doc; this file only ranks and resolves conflicts.
Measurements come from scratch copies with the stale `.mjs` files removed, not from the working tree.

## Bottom line

- **The net has a hole under it.** `tsconfig.json` has neither `outDir` nor `noEmit`, so `tsc` writes `.mjs` next to every `.mts`. Tests import `./X.mjs` and resolve to those stale copies: a `throw` added to `Money.mts` left the tests green (03). On the working tree 20 of 22 spec files fail, knip reports 21 false unused files (07), and oxlint reports 5 false errors. Every other gate is unreliable until this is fixed.
- **Second hole: `AGENTS.md` is the 10 bytes `@AGENTS.md`**, and `CLAUDE.md` symlinks to it. Neither agent gets a root map (01).
- **One import makes every loop slow.** `LocalDate.mts` imports bare `date-fns`: vitest 12.6 s → 1.4 s, `pnpm check` 13.5 s → 2.4 s, Stryker full run 5 min 45 s → 46 s with per-function imports (06, 04). That is what makes a Stop-hook gate and mutation testing affordable.
- **All sources agree on one mechanism:** a check the repo owns whose failure message says how to fix it, wired into hooks/CI rather than requested in the prompt (01). No source measures the effect; it is practitioner evidence.
- **TS 7 has no programmatic API, and it filters the tool list:** Semgrep (skips `.mts`), typescript-eslint, type-coverage and Stryker's TS checker fail or need a TS 6 side install. ast-grep, oxlint, oxfmt, jscpd, Stryker core (with a workaround) and dependency-cruiser in an isolated TS 6 package work (02, 03, 04, `architecture-check.md`).

## Ranked plan

Leverage vs cost for a solo dev. Items 1–5 are hygiene: each takes minutes and every later item depends on them.

| # | Change | Cost | Source |
|---|---|---|---|
| 1 | Stop emitting into `src/` (decision below), delete the 36 stray files and `knip.config.js`, and add a check that fails if `.mjs` appears next to `.mts` | 15 min | 03, 07 |
| 2 | `date-fns` per-function imports | 5 min | 06 |
| 3 | CI: add `pnpm lint`; `maxWarnings: 0`; remove the duplicate `"eslint"` plugin | 10 min | 01, 07 |
| 4 | Rewrite `AGENTS.md` as a 40–100 line map: commands, one line per `docs/architecture/*.md`, locked files | 30 min | 01 |
| 5 | tsconfig: the 8 zero-error flags, `lib: es2025` | 5 min | 03 |
| 6 | Claude Code Stop/SubagentStop hook running `pnpm check` (skip if tree unchanged since last green, 3 attempts then hand to user) + PostToolUse `oxlint --fix` on the edited file | 1 h | 06 |
| 7 | Deny/ask rules on hook, harness, gate-config and locked-spec files | 30 min | 06, 04 |
| 8 | oxfmt + `format:check` in pre-commit and CI; one reformat commit in `.git-blame-ignore-revs` | 30 min | 07 |
| 9 | Built-in oxlint rules: `explicit-module-boundary-types`, `no-restricted-globals: Date` (override `LocalDate`), complexity limits at today's zero-violation levels, vitest test-quality rules | 30 min | 02, 04, 07 |
| 10 | ast-grep for DDD shape rules with `note` fix text; apply the 65 autofixes in one commit; 3 design rules at warning until decided | 2 h | 02 |
| 11 | dependency-cruiser (already planned) — put the allowed imports and the fix in each rule's `comment` | +0 | 01 |
| 12 | `pnpm gen vo` generator + doc-sync spec keeping `value-object.md` equal to its output | 2 h | 05 |
| 13 | Stryker incremental in CI, `break: 60`, ratchet up. Judge the coder's tests by surviving mutants, not test count | 2 h | 04 |
| 14 | fast-check for value objects with algebraic laws (pin `@fast-check/vitest@0.3.0`, fixed global seed) | 1 h | 04 |
| 15 | jscpd with `--baseline`, fail only on new clones | 20 min | 07 |
| 16 | Doc-reference check (dead file refs in docs) | 30 min | 01 |
| 17 | agy wrappers for the same scripts, after one more `-p` probe | 1 h | 06 |

Skip for now: scheduled doc-gardening/cleanup agents, quality grades, readiness scoring, evaluator agents (pay off at high PR volume, 01); type-coverage, `ts-reset`, `exactOptionalPropertyTypes`, `@tsconfig/strictest` (03); Semgrep, ESLint (02); Stryker TS checker (04); plop/hygen/Nx/Yeoman (05); `vitest related` per edit (06); coverage as a quality signal (04).

## Conflicts between the docs, resolved

- **`outDir: "dist"` (07) vs `noEmit: true` (03).** Open decision, below.
- **agy post-tool hook.** 07 says agy has none; 06 verified `PostToolUse` exists but returns only `{}`. Lint output has to be injected on the next `PreInvocation`. 06 is right.
- **Lint thresholds as an escape route.** `lint-strictness.md` treats raised thresholds as a loophole. Böckeler allowed small raises when the lint message said so and used them as a review index (01). Resolution: the rule message states whether raising is allowed; the Stop hook and CI diff-check flag any change to gate configs.

## Found along the way, not tooling

- Money: `fromMajor` precision check can be disabled without a failing test ("1.234" USD → 12.34); `Money(-1).multiply(0)` stores `-0` (04).
- `SignedContract.mts`, a reference file in `entity.md`, returns bare `return;` on invalid state; `ActiveContract.suspend` has no state check (02).
- `contracting/draft/FeeStructure.mts` duplicates `money/FeeStructure.mts`; the "fee cannot exceed" check is copied across three fee classes (07).
- `src/sandbox/locker` fails `tsc` by design (agy fixture) — `pnpm check` needs to exclude it or the gate is red before any task.
- Global agy RTK hook returns `"allow"` for every shell command; may auto-approve everything in interactive agy. Unverified (06).
- `block-hook-bypass.sh` blocks writes whose content merely contains `--no-verify` (06, known in `harness.md`).

## Open decisions

1. **Emit:** `noEmit: true` and run `.mts` directly on Node 24 (tested: `node src/index.ts` boots; the emitted build doesn't run anyway because `@/` isn't rewritten), or `outDir: "dist"` and keep a build.
2. **Typed ids in repositories:** `entity.md` says never raw strings, `repository.md` and `ContractDraftRepository.get(id: string)` use strings. Blocks the repository template (05) and a lint rule (02).
3. **Error codes** for `draft/FeeStructure`, `UnsignedContract`, `SignedContract` before the 3 ast-grep design rules go to error (02).
