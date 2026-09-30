# Architecture check

Created: 2026-09-29
Status: open

## Goal

Turn the module boundaries written in `CONTEXT.md` / `LANGUAGE.md` into a CI check, so an agent that crosses a boundary gets a failing check that names the import, not a review comment after the fact.

## Drivers

- `agy-findings.md` #2: conventions that only a failed check reveals cost the coder extra steps. Boundaries are such a convention today.
- CI runs the rules from the branch under test. An agent can make the check green by editing the rules, adding a folder no rule covers, or leaving the tool with nothing to analyze.
- TypeScript 7.0 ships no programmatic API ("We expect TypeScript 7.1 to ship with a new (and different) API", TS 7.0 announcement). Tools that `require('typescript')` break.

## Tool choice

| Tool | npm/week (2026-09) | Verdict |
|---|---|---|
| dependency-cruiser 18.4.0 | 4.6M | **Chosen.** De facto standard for Node, allowlist rules, `reachable` rules, JSON output |
| @nx/eslint-plugin | 3.8M | Needs Nx workspace/project graph. Not a fit |
| madge 8.0.0 | 3.2M | Cycles and graphs only, unmaintained (last release 2024-08) |
| skott 0.35.12 | 103k | Maintained madge successor: graph, cycles, unused files/deps. No boundary rules. Crashes with TS 7 in the tree (`@typescript-eslint/typescript-estree` loads the hoisted TS 7). Isolated with TS 6 it started but processed 1–3 files and missed an injected cycle (exit 0). Overlaps `no-circular` + knip |
| dpdm 4.3.0 | 706k | Cycles only, no boundary rules. Works with TS 7 in the tree (bundles TS 5.9.3). Needs `--js .mts,.ts,.mjs`: without it, it analyzes `[0/0]` files and exits 0. With it, found an injected cycle, exit 1 via `--exit-code circular:1`. Overlaps `no-circular` |
| eslint-plugin-boundaries 7.2.0 | 1.9M | ESLint plugin; would run through oxlint JS plugins (alpha). Revisit when stable |
| @softarc/sheriff-core 0.19.6 | 150k | Pre-1.0, last release 2025-09 |
| archunit (ArchUnitTS) 2.5.4 | 74k | Works with TS 7 (bundles TS 5.9). Fallback if the isolated setup below fails under pnpm |
| tsarch 5.4.1 | 39k | Abandoned (TS ^3.8, last release 2024-12) |

Verified in a scratch copy of `src/` with the repo's TypeScript 7.0.2:

- dependency-cruiser installed next to TS 7: `✔ no dependency violations found (4 modules, 4 dependencies cruised)` with two injected violations. **False green**, exit code 0. Switching to the swc parser did not help.
- dependency-cruiser installed in its own package (`tools/arch/`) with `typescript@6`: both injected violations reported, 45 modules, 130 dependencies.

## Target rules (allowlist)

Current cross-folder imports, from `src/**/*.mts`:

| From | May import |
|---|---|
| `src/utils` | `date-fns` only, nothing in `src/` |
| `src/money` | `src/utils` |
| `src/contracting/<stage>` | own `<stage>`, `src/contracting/draft/PersonId`, `src/money`, `src/utils` |
| `src/sandbox` | anything in `src/` |
| anything | nothing imports `src/sandbox` |

Plus: no circular dependencies, no orphans outside `__tests__` and `index.ts`, and every `src/**/*.mts` file belongs to one row above.

Stage transitions (`toSignedContract`, `toActiveContract`) currently don't import the next stage. If they start to, that is a design decision for `CONTEXT.md`, not a rule exception.

## Tasks

### 1. Setup

- [ ] `tools/arch/package.json` with `dependency-cruiser@18.4.0` and `typescript@6` (exact versions), registered in `pnpm-workspace.yaml` `packages:`
- [ ] Verify pnpm resolves `typescript@6` for dependency-cruiser from `tools/arch/` (tested with npm only). Check with `depcruise --info`: `typescript` row must show `6.x`
- [ ] `.dependency-cruiser.cjs` at repo root: `tsConfig: { fileName: "tsconfig.json" }`, `tsPreCompilationDeps: true` (type-only imports count). Do not set `extraExtensionsToScan: [".mts"]`: it drops the cruised dependencies to near zero
- [ ] Rules from the table above as `allowed` + `allowedSeverity: "error"`, plus `forbidden` for `no-circular` and `no-orphans`
- [ ] Script `arch` in root `package.json`, added to `pnpm check`

### 2. Guard against an empty or blind run

- [ ] Script fails if cruised modules < number of `src/**/*.mts` files, or if output contains `missing-typescript-transpiler`
- [ ] Verification: inject `money → contracting` and `unsigned-contract → active-contract` imports, confirm both fail; inject an import from a new folder `src/shared/`, confirm the allowlist fails it

### 3. Guard against rule edits

- [ ] CI step checks out `.dependency-cruiser.cjs` and `tools/arch/**` from `origin/main` before running `pnpm arch`, so a PR's own rule edits have no effect until merged
- [ ] `CODEOWNERS`: `.dependency-cruiser.cjs`, `tools/arch/**`, `.github/**` → owner; branch protection requires owner review
- [ ] `.claude/settings.json` deny `Edit`/`Write` on the same paths (same as `harness.md` §6)
- [ ] Coder skill: list the rule files as locked, next to the step that runs `pnpm check`

### 4. Out of scope, known gaps

- Copied code instead of an import: no dependency, nothing to catch. Candidate: `jscpd` (3.5M/week), separate task
- Computed dynamic `import(path)`: not statically visible

## Revisit

- TypeScript 7.1 API ships → dependency-cruiser supports `typescript@>=7` → drop `tools/arch/` isolation
- oxlint JS plugins leave alpha → consider eslint-plugin-boundaries for editor-time feedback
