# Harness tasks

Audit date: 2026-09-27

## 1. Safety net

- [x] Git hooks via `core.hooksPath` (`.githooks/`, activated by `prepare` on `pnpm install`)
  - [x] `pre-commit`: `pnpm lint` + `pnpm type-check`
  - [x] `pre-push`: `pnpm run test:unit`
- [x] `pnpm check` runs lint → type-check → `test:unit` (bare `pnpm test` with no `test` script exits 0 without running anything)
- [x] Fix `ContractDraftService.mts:13` — `DomainEventPublisher` undefined (resolved by event-publisher changes)
- [ ] CI workflow (`.github/workflows/check.yml`) running `pnpm check` on push/PR — hooks are bypassable with `--no-verify`
- [ ] Claude Code Stop hook in `.claude/settings.json` running `pnpm check`, so the agent can't finish on a red tree
- [ ] Vitest `typecheck` or keep type-check separate — note tests pass while `tsc` fails

## 2. Lint

- [x] oxlint 1.16 → 1.85 so `oxlint.config.mts` is auto-loaded (1.16 only read JSON, so no config was applied); TS config support is experimental upstream
- [x] Removed `oxlint.config.json`
- [x] Test override globs fixed to `.spec.mts` / `__tests__/**`
- [x] `style` category off (was 400+ warnings: `sort-keys`, `id-length`, `sort-imports`, `no-magic-numbers`, …)
- [x] `no-underscore-dangle` off (conflicts with `_field` entity convention)
- [x] Removed dead `factor` in `Money.fromString`
- [ ] Decide which `style` rules to re-enable individually
- [ ] Consider `--deny-warnings` in the hook once warnings are at zero

## 3. Agent instructions

- [ ] Rewrite `AGENTS.md` as the single source of truth
  - remove pasted chat reply ("Got it 👍 …", "Would you like me to …")
  - fix mangled Money snippet (`if (amount  {`)
  - replace `Either/left/right` with the real `Result` (`success`/`value`/`error`)
  - drop `Object.freeze` requirement or adopt it in code
  - private constructor in typed-id example
  - align application service pattern with `ContractDraftService` (function + deps, `{ code }` errors)
- [ ] `CLAUDE.md`: `@AGENTS.md` + commands + "run `pnpm check` before claiming done"; drop self-description
- [ ] Delete `GEMINI.md` / `WARP.md` (stale copies) or reduce to a pointer to `AGENTS.md`
- [ ] Fill or delete `architecture/main.md`; decide whether `llm/main.md` belongs in the repo

## 4. Tests

- [ ] `Money` (parsing, precision, overflow, negative, arithmetic)
- [ ] `LocalDate`, `Result`
- [ ] `EnrollmentFee`, `MonthlyDues`, `PenaltyFee`
- [ ] Coverage reporting (`@vitest/coverage-v8`) with a threshold

## 5. Hygiene

- [ ] Exclude `**/__tests__/**` and `*.spec.mts` from `tsc` build output
- [ ] Clean stale `dist/` (duplicate `dist/src/` tree)

## 6. Toolchain enforcement

- [x] `devEngines.runtime`: node `^24.0.0`, `onFail: download` — pinned 24.21.0 in lockfile, scripts run on `node_modules/.bin/node`
- [x] `devEngines.packageManager`: pnpm `>=12 <13`, `onFail: error` — `npm install` fails with `EBADDEVENGINES`
- [x] `.npmrc` → `pnpm-workspace.yaml` (`savePrefix: ''`, `allowBuilds: { esbuild: true }`); pnpm 12 reads only auth/registry from `.npmrc`
- [x] Claude Code PreToolUse hook `.claude/hooks/block-hook-bypass.sh` blocks `--no-verify`, `git commit -n`, `core.hooksPath` overrides
- [x] `.githooks/*` fail with an explicit "do not bypass" message when `pnpm` is missing
- [ ] Make `pnpm` resolvable in non-interactive shells (details below)
- [ ] Protect `.claude/settings.json`, `.claude/hooks/**`, `.githooks/**` from agent edits (deny `Edit(...)`), so an agent can't disable the guard
- [ ] Decide on bare `node`: pnpm 12 global shim is not active (`command -v node` → nvm), so `node x.js` outside pnpm scripts uses nvm's version, not the lockfile pin
- [ ] Bypass hook matches the flag string anywhere in a Bash command (heredocs, `echo`, docs) — narrow to actual `git` invocations if false positives get annoying

### Make `pnpm` resolvable in non-interactive shells

**Problem.** zsh reads `~/.zshrc` only for interactive shells (a terminal you type into). The `PNPM_HOME` / `PATH` block that puts `~/Library/pnpm/bin` on PATH lives in `~/.zshrc`. Anything that runs `zsh -c "..."` without a terminal — other agents, IDE task runners, GUI git clients firing `.githooks` — never reads it and gets `pnpm: command not found`.

Verified 2026-09-27:

| Command | Result |
|---|---|
| `zsh -i -c 'command -v pnpm'` (interactive) | `~/Library/pnpm/bin/pnpm` |
| `zsh -c 'command -v pnpm'` (non-interactive) | not found |

**Why it matters.** "command not found" is the trigger for an agent to improvise: `npm i -g pnpm`, `corepack enable`, `brew install pnpm`, `npx vitest`, or skipping git hooks. Removing the trigger is better than blocking every workaround.

**Fix.** zsh reads `~/.zshenv` for every shell, interactive or not.

1. Create `~/.zshenv` with the block moved from `~/.zshrc` (lines `# pnpm` … `# pnpm end`):
   ```sh
   export PNPM_HOME="$HOME/Library/pnpm"
   case ":$PATH:" in
     *":$PNPM_HOME/bin:"*) ;;
     *) export PATH="$PNPM_HOME/bin:$PATH" ;;
   esac
   ```
2. Remove that block from `~/.zshrc`.
3. Caveat: macOS `/etc/zprofile` runs `path_helper` after `~/.zshenv` in login shells and may reorder PATH. pnpm stays on PATH, only order changes — check `which pnpm` still wins over any other install.

**Verify.**
- `zsh -c 'command -v pnpm'` → `~/Library/pnpm/bin/pnpm`
- `env -i HOME=$HOME zsh -c 'pnpm --version'` → `12.x`
- New Claude Code session: `pnpm --version` works without absolute path
