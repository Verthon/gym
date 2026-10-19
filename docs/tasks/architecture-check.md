# Architecture check

Created: 2026-09-29
Status: done

## Goal

Turn the module boundaries written in `CONTEXT.md` / `LANGUAGE.md` into a CI check, so an agent that crosses a boundary gets a failing check that names the import, not a review comment after the fact.

## Drivers

- `agy-findings.md` #2: conventions that only a failed check reveals cost the coder extra steps. Boundaries are such a convention today.
- CI runs the rules from the branch under test. An agent can make the check green by editing the rules, adding a folder no rule covers, or leaving the tool with nothing to analyze.
- TypeScript 7.0 ships no programmatic API ("We expect TypeScript 7.1 to ship with a new (and different) API", TS 7.0 announcement). Tools that `require('typescript')` break.

## Tool choice

| Tool | npm/week (2026-09) | Verdict |
|---|---|---|
| dependency-cruiser 18.6.0 | 4.6M | **Chosen.** De facto standard for Node, allowlist rules, `reachable` rules, JSON output |
| @nx/eslint-plugin | 3.8M | Needs Nx workspace/project graph. Not a fit |
| madge 8.0.0 | 3.2M | Cycles and graphs only, unmaintained (last release 2024-08) |
| skott 0.35.12 | 103k | Maintained madge successor: graph, cycles, unused files/deps. No boundary rules. Crashes with TS 7 in the tree (`@typescript-eslint/typescript-estree` loads the hoisted TS 7). Isolated with TS 6 it started but processed 1–3 files and missed an injected cycle (exit 0). Overlaps `no-circular` + knip |
| dpdm 4.3.0 | 706k | Cycles only, no boundary rules. Works with TS 7 in the tree (bundles TS 5.9.3). Needs `--js .mts,.ts,.mjs`: without it, it analyzes `[0/0]` files and exits 0. With it, found an injected cycle, exit 1 via `--exit-code circular:1`. Overlaps `no-circular` |
| eslint-plugin-boundaries 7.2.0 | 1.9M | ESLint plugin; would run through oxlint JS plugins (alpha). Revisit when stable |
| @softarc/sheriff-core 0.20.0 | 150k | Pre-1.0, active again (0.20.0, 2026-10-07). Peer `typescript >=4.8`, so it loads the repo's TS 7 |
| archunit (ArchUnitTS) 2.5.4 | 74k | Works with TS 7 (bundles TS 5.9). Fallback if the `packageExtensions` setup below breaks |
| tsarch 5.4.1 | 39k | Abandoned (TS ^3.8, last release 2024-12) |

Verified in a scratch copy of `src/` with the repo's TypeScript 7.0.2:

- dependency-cruiser installed next to TS 7: `✔ no dependency violations found (4 modules, 4 dependencies cruised)` with two injected violations. **False green**, exit code 0. Switching to the swc parser did not help: swc skips `.mts`/`.cts` when no usable TypeScript is installed ([dependency-cruiser #1104](https://github.com/sverweij/dependency-cruiser/issues/1104)).
- dependency-cruiser installed in its own package (`tools/arch/`) with `typescript@6`: both injected violations reported, 45 modules, 130 dependencies.

Re-verified 2026-10-18 with dependency-cruiser 18.6.0, pnpm 12.6.0 and `#/` subpath imports:

- `packageExtensions` in `pnpm-workspace.yaml` gives dependency-cruiser its own TS 6 (`typescript: npm:@typescript/typescript6@6.0.2`). The root `tsc` stays 7.0.2. `depcruise --info` shows `typescript@6.0.3`. No separate workspace package needed.
- The same block in the `pnpm` field of `package.json` is ignored by pnpm 12 without a warning: `depcruise --info` showed no TypeScript at all.
- `#/` imports resolve: 41 modules, 115 dependencies. Only external packages missing from the scratch copy were unresolved.
- Injected `utils → money`, type-only `money → contracting`, and a cycle `PersonId → Result → Money → PersonId`: all three reported, exit 18.

Cycle detection is covered by dependency-cruiser's `no-circular`. Not adding skott or dpdm: a second config and a second TypeScript resolution path for a check the gate already does.

oxlint `import/no-cycle` (native, already in the lint run): reports the cycle when every edge is a value import. With one `import type` edge it reports nothing, exit 0. Useful as earlier feedback for runtime cycles, not as a replacement for `no-circular`.

## Target rules (allowlist)

Current cross-folder imports, from `src/**/*.mts`:

| From | May import |
|---|---|
| `src/utils` | nothing outside `src/utils` (`Temporal` is a global) |
| `src/money` | `src/utils` |
| `src/contracting/<stage>` | own `<stage>`, `src/contracting/draft/PersonId`, `src/money`, `src/utils` |

Plus: no circular dependencies, no orphans outside `__tests__` and `index.ts`, and every `src/**/*.mts` file belongs to one row above.

Test code stays out of production: `src/utils/test.mts`, anything under `__tests__/`, and `vitest` may only be imported from `__tests__/`.

Stage transitions (`toSignedContract`, `toActiveContract`) currently don't import the next stage. If they start to, that is a design decision for `CONTEXT.md`, not a rule exception.

## Tasks

### 1. Setup

- [x] Root devDependency `dependency-cruiser@18.6.0` (exact)
- [x] `pnpm-workspace.yaml`: `packageExtensions.dependency-cruiser.dependencies.typescript: npm:@typescript/typescript6@6.0.2`. Not in `package.json` `pnpm`: pnpm 12 ignores it there
- [x] Check with `depcruise --info`: `typescript` row must show `6.x`, and `tsc -v` must still show 7.x
- [x] `.dependency-cruiser.cjs` at repo root: `tsConfig: { fileName: "tsconfig.json" }`, `tsPreCompilationDeps: true` (type-only imports count). Do not set `extraExtensionsToScan: [".mts"]`: it drops the cruised dependencies to near zero
- [x] Rules from the table above as `allowed` + `allowedSeverity: "error"`, plus `forbidden` for `no-circular`, `no-orphans` and test code in production
- [x] Script `arch` in root `package.json`, added to `pnpm check`
- [x] `.githooks/pre-commit`: `pnpm arch` after `pnpm type-check`. The hooks call scripts one by one, not `pnpm check`
- [x] `.github/workflows/check.yml`: `Arch` step after `Type-check`, same `if:` condition as the other steps
- [x] `oxlint.config.mts`: `"import/no-cycle": "error"` for lint-time feedback on runtime cycles

### 2. Guard against an empty or blind run

- [x] Script fails if cruised modules < number of `src/**/*.mts` files, or if output contains `missing-typescript-transpiler`. This also catches the `packageExtensions` block being dropped or moved
- [x] Verification: inject `money → contracting` and `unsigned-contract → active-contract` imports, confirm both fail; inject an import from a new folder `src/shared/`, confirm the allowlist fails it; import `#/utils/test.mts` from a domain file, confirm it fails

Verified 2026-10-18: `money → contracting` and `unsigned-contract → active-contract` (both type-only), `src/shared/` and `src/utils/test.mts` from `src/money` all fail, plus a type-only cycle `Result ↔ LocalDate`: 6 errors, exit 1. Excluding `src/money` fails the guard with 31 of 37 files cruised. Dropping `packageExtensions` gives `0 modules` and `missing-typescript-transpiler`, and the guard fails.

### 3. Guard against rule edits

Trunk-based, no PRs (ADR 0003): every guard runs before the commit. CI-from-`origin/main`, CODEOWNERS and branch protection give no protection here.

Threat: an agent taking a shortcut to green, not an adversary. The usual spellings are blocked, deliberate evasion isn't (decided 2026-10-19, `harness.md` question 1). No sandbox, no mod.

- [x] `.claude/settings.json` deny `Edit(...)` on the safety-net files: `.githooks/**`, `.github/**`, `.claude/settings.json`, `.claude/hooks/**`, `scripts/**`, `.dependency-cruiser.cjs`, `pnpm-workspace.yaml`, `oxlint.config.mts`, `tsconfig.json`, `knip.config.ts`, `vitest.config.mts`, `stryker.config.mjs`. Not `Write(...)`: Claude Code ignores path rules on `Write`
- [x] `.githooks/pre-commit` fails when `CLAUDE_CODE_CHILD_SESSION` is set and a safety-net file or the `scripts` field of `package.json` is staged. Human override: commit from your own terminal
- [x] `block-hook-bypass.sh` narrowed: strips heredoc bodies and quoted strings before matching flags; blocks case-insensitive `core.hookspath` writes, `GIT_CONFIG_*`, `chmod`/`rm`/`mv`/`git checkout` on `.githooks`, and hiding `CLAUDE_CODE_CHILD_SESSION`
- [x] Coder skill: rule files listed as locked, next to the step that runs `pnpm check`

Verified 2026-10-19: the hook blocks 5 of the 6 bypasses from the `harness.md` probe table plus 12 other spellings. The sixth, `> .githooks/pre-commit`, is denied by the deny rule. `git config core.hooksPath` (read), `--no-verify` inside a commit message or heredoc, `git commit --amend` pass. `printf '' | tee -a tsconfig.json` is denied too. Staged-file check in a scratch repo: `.githooks/pre-commit` and a `scripts` change fail, a non-script `package.json` change passes.

Residual: a hooks-path override hidden from the command string (variable, `sh -c`, a script), and writes by subprocesses (node, python). Not verified: whether `!` commands get `CLAUDE_CODE_CHILD_SESSION`.

### 4. Out of scope, known gaps

- Copied code instead of an import: no dependency, nothing to catch. Candidate: `jscpd` (3.5M/week), separate task
- Computed dynamic `import(path)`: not statically visible
- Deferred rules: one generic stage-isolation rule with `$1` group matching, no `node:*` in `src/contracting` / `src/money`

## Cost (measured 2026-10-18, 37 `.mts` files)

- `depcruise` 0.31 s per run (direct binary), oxlint `no-cycle` < 0.1 s. Pre-commit goes from ~0.7 s to ~1.0 s
- 24 MB TS 6 + 1.6 MB dependency-cruiser in `node_modules`
- Changing a boundary needs the human override for rule-file commits

## Revisit

- TypeScript 7.1 API ships (stable planned 2026-11-24, [#63703](https://github.com/microsoft/TypeScript/issues/63703)) → dependency-cruiser supports `typescript@>=7` → drop the `packageExtensions` alias
- dependency-cruiser release after 18.6.0 with swc fixes #1105/#1106 → try `parser: "swc"` without TS 6. Accept only if all injected violations fail. Known gap: swc doesn't report `typeof import("x")` in type arguments, and runs still warn `missing-typescript-transpiler` (the §2 guard would need changing)
- oxlint JS plugins leave alpha → consider eslint-plugin-boundaries for editor-time feedback. It needs an `import/resolver`; without one, unresolved alias imports are treated as `external` and skip boundary checks. Not checked with `#/` imports
- oxlint native `import/no-restricted-paths` lands ([oxc #13789](https://github.com/oxc-project/oxc/issues/13789)) → boundary feedback at lint time without a JS plugin
