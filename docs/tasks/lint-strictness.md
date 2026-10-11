# Lint strictness for agent feedback loops

Created: 2026-09-27
Status: exploration

## Goal

Decide how strict lint should be, and which rules to use, when agents write most of the code in this repo. Base the decision on published practice, then test it here before adopting it.

## Current state

- oxlint 1.85, `oxlint.config.mts`: `correctness` error, `suspicious`/`perf` warn, `style` off
- No type-aware linting, no complexity/size limits, no import-boundary rules
- `tsconfig`: `strict: true` only, no `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`
- No coverage threshold (see `harness.md` §4)
- `--no-verify` already blocked (`.claude/hooks/block-hook-bypass.sh` + permission deny)
- Lint/coverage config files are not protected against agent edits
- `src/utils/` exists. Tune's `no-restricted-imports` setup bans folders like this.

## Research summary (pasted, not re-verified)

| Expert | Tooling | Strictness |
|---|---|---|
| Nick Tune (Jan 2026) | ESLint + typescript-eslint, dependency-cruiser, Vitest, SonarQube, CodeRabbit | All rules at error. Bans `any`, `no-unsafe-*`, non-null `!`, `as` (`assertionStyle: 'never'`). complexity ≤ 12, nesting depth ≤ 3, file ≤ 400 lines. Bans `utils/ helpers/ shared/ common/ core/ lib/`. 100% coverage on every metric |
| Nick Tune (Apr–Sep 2026) | Oxlint custom rules + "Rivière" DSL | Role rules at error. Example: a command use case has exactly 1 public method, typed I/O, and forbidden imports |
| Birgitta Böckeler (May 2026) | ESLint, tsc, Semgrep, dependency-cruiser, Stryker | Custom limits on arg count, file length, function length, and complexity. dependency-cruiser at error. The agent may suppress `no-explicit-any` if it writes a reason |
| Factory.ai / Alvin Sng (Sep 2025) | Tool-agnostic | Rules start as warn, then move to error. "Lint green" is the definition of done. Waivers are time-boxed |
| Adam Tornhill (Feb 2026) | CodeScene Code Health via MCP | Target score ≥ 9.5 |
| Addy Osmani (Jun 2026) | Generic | Keep deterministic gates strict |
| Matt Pocock | Husky + lint-staged + tsc + tests | Pre-commit gate only |
| Dex Horthy (Dec 2025) | Wrapper script | Output shape: "Success = ✓. Failure = full output." Fail-fast |

Findings:

- Agents route around rules unless the harness blocks the escape routes: `--no-verify`, editing config, raising thresholds (Böckeler)
- Strict size limits move complexity elsewhere, e.g. many small units with many params. Guardrails that conflict make the agent bounce between them and burn tokens (Tune, Böckeler)
- Rule messages act as prompts. Custom messages and autofixes drive self-correction (Böckeler, Factory)
- Architecture and import-boundary rules gave the most value. Tune saw Claude break layering despite instructions
- Oxlint type-aware mode has been stable since 2026-07-22 and covers 59 of 61 typescript-eslint type-aware rules. Oxc reports it as 12–18× faster

Confidence gaps:

- Pocock's `noUncheckedIndexedAccess` recommendation: not verified from a primary source
- CodeScene's claim of "35–45% more tokens on unhealthy code": seen only in a search summary
- Tornhill's 9.5 threshold comes from Python competitive-programming files, not TS
- Tune's role rules are unproven by his own account
- Warn vs error: only Factory states a policy, and it is a migration path

Sources: Tune ("Code Quality Foundations for AI-assisted Codebases", "Deterministic Code Conventions with Oxlint", "Enforced application architecture", "Code quality feedback loops", Techworld with Milan interview); Böckeler ("Maintainability sensors for coding agents"); Sng ("Using Linters to Direct Agents"); Tornhill ("Agentic AI Coding: Best Practice Patterns"); Osmani ("Agentic Code Review"); Pocock ("Essential AI Coding Feedback Loops for TypeScript"); Horthy ("Context-Efficient Backpressure"); Oxc ("Type-Aware Linting Stable"); Willison ("Ruff v0.16.0").

## Exploration tasks

### 1. Verify sources

- [ ] Read Tune's Jan 2026 config post and his Apr–Sep 2026 Oxlint posts. Extract the exact rule list and custom-rule API
- [ ] Read Böckeler's article for her thresholds and the rule conflicts she saw
- [ ] Confirm oxlint type-aware setup (`oxlint-tsgolint`?) and which 2 rules are missing
- [ ] Confirm or drop the Pocock `noUncheckedIndexedAccess` claim

### 2. Baseline

- [ ] Enable type-aware linting and record rule violation counts and runtime
- [ ] Measure complexity, nesting, file length, and function length per file to see what limits would cost now

### 3. Candidate rules (decide per item: adopt / warn / reject)

- [ ] `no-explicit-any`, `no-unsafe-*`, `no-non-null-assertion` at error
- [ ] Ban `as` (`consistent-type-assertions` `assertionStyle: 'never'`). Check fit with `Result` narrowing and branded VOs
- [ ] Ban `let` (Tune, interview only)
- [ ] complexity / max-depth / max-lines / max-lines-per-function / max-params. Watch for Böckeler's "many small units, many params" effect
- [ ] tsconfig: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
- [ ] Coverage threshold. 100% vs a lower bar
- [ ] Custom rule messages that tell the agent what to do, not just what is wrong

### 4. Architecture boundaries

- [ ] Define layers/bounded contexts (`contracting`, `money`, `events`, ...) and the allowed imports between them
- [ ] Tool: oxlint `no-restricted-imports` vs dependency-cruiser vs custom oxlint plugin
- [ ] Decide on `src/utils/` (rename/split into owning domain vs allow)
- [ ] Only `src/utils/Clock.mts` reads `Temporal.Now`, `new Date()` or `GYM_TIME_ZONE` (ADR 0002). Today only a grep checks this. Check which `no-restricted-*` rules oxlint supports
- [ ] Role rules for DDD building blocks (e.g. Value Object: private ctor + static `create` returning `Result`; application service: single exported function). Prototype one as a custom oxlint rule

### 5. Harness escape routes

- [ ] Protect `oxlint.config.mts`, `tsconfig.json`, `vitest.config.mts`, `.githooks/`, `.claude/` from agent edits (PreToolUse hook on Edit/Write)
- [ ] Policy for inline suppressions: forbid, or allow with a required reason (Böckeler) plus an expiry (Factory)
- [ ] Output shape of `pnpm check` for agents: quiet on success, full output on failure, fail-fast (Horthy)

### 6. Rollout policy

- [ ] Warn→error migration vs error from day one
- [ ] Record the decision (ADR or `AGENTS.md` section) with the reasons

## Open questions

- How many strictness rules can this small codebase take before the agent starts thrashing between them?
- Is a code-health metric (CodeScene) worth adding on top of lint, or does it duplicate complexity rules?
