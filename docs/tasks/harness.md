# Harness tasks

Audit date: 2026-09-27

## 1. Safety net

- [x] Git hooks via `core.hooksPath` (`.githooks/`, activated by `prepare` on `pnpm install`)
  - [x] `pre-commit`: `pnpm lint` + `pnpm type-check`
  - [x] `pre-push`: `pnpm run test:unit`
- [x] `pnpm check` runs lint → type-check → `test:unit` (bare `pnpm test` with no `test` script exits 0 without running anything)
- [x] Fix `ContractDraftService.mts:13` — `DomainEventPublisher` undefined (resolved by event-publisher changes)
- [x] CI workflow (`.github/workflows/check.yml`) running `pnpm check` on push/PR — hooks are bypassable with `--no-verify`
- [ ] Claude Code Stop hook in `.claude/settings.json` running `pnpm check`, so the agent can't finish on a red tree. Researched, not built: tested prototype in `06-agent-hooks.md` §6, ranked item 3 in `09-safety-net-gaps.md`
- [x] Vitest `typecheck` or keep type-check separate: kept separate. `tsconfig.json` has no `include`, so `tsc` already type-checks the specs (`03-tsc-strictness.md`)

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

Research and ranked audit for the open items below (2026-10-23): [09-safety-net-gaps.md](../research/tooling/09-safety-net-gaps.md). `ask` instead of `deny` for the safety-net files: [10-ask-vs-deny-safety-net.md](../research/tooling/10-ask-vs-deny-safety-net.md).

- [x] `devEngines.runtime`: node `26.12.1`, `onFail: download` — pinned 26.12.1 in lockfile, scripts run on `node_modules/.bin/node`
- [x] `devEngines.packageManager`: pnpm `>=12 <13`, `onFail: error` — `npm install` fails with `EBADDEVENGINES`
- [x] `.npmrc` → `pnpm-workspace.yaml` (`savePrefix: ''`, `allowBuilds: { esbuild: true }`); pnpm 12 reads only auth/registry from `.npmrc`
- [x] Claude Code PreToolUse hook `.claude/hooks/block-hook-bypass.sh` blocks `--no-verify`, `git commit -n`, `core.hooksPath` overrides
- [x] `.githooks/*` fail with an explicit "do not bypass" message when `pnpm` is missing
- [ ] Make `pnpm` resolvable in non-interactive shells (details below)
- [x] Protect `.claude/settings.json`, `.claude/hooks/**`, `.githooks/**` from agent edits (deny `Edit(...)`), so an agent can't disable the guard. Done with the full safety-net list, see `architecture-check.md` §3
- [ ] Block `git push --force`, `--force-with-lease` and `+<refspec>` pushes to `main`. Not covered by `block-hook-bypass.sh` today
  - Server side done 2026-10-23: branch ruleset `protect-main` (id 25726217), Restrict deletions + Block force pushes, no PR rule, empty bypass list. Open: local pre-push ref check (09 item 2), and `gh api` write deny rules so the agent can't disable the ruleset (user's edit)
- [x] Research (deep-research): how teams stop a coding agent from weakening its own safety net under trunk-based development, with no PR review to catch it. Results in [Safety-net guards under trunk](#safety-net-guards-under-trunk). Scope:
  - Files: `.githooks/**`, `.claude/**`, `.github/**`, `oxlint.config.mts`, `tsconfig.json`, `.dependency-cruiser.cjs`, `pnpm-workspace.yaml`, `package.json` scripts
  - Edit paths: `Edit`/`Write` tools and Bash (`sed`, heredoc, `git checkout`), not only the tools
  - Candidates to compare: Claude deny rules, PreToolUse hooks, pre-commit check on staged rule files with a human override, sandboxing, server-side checks
  - Output feeds `architecture-check.md` §3 and the trunk ADR
- [x] Decide the safety-net guard setup: four layers vs settings-only minimum. Decided 2026-10-19: usual spellings blocked, deliberate evasion not. Deny rules + staged-file check + narrowed hook, no sandbox, no mod. See [Open: lighter setup without custom scripts](#open-lighter-setup-without-custom-scripts)
- [x] Decide `ask` vs `deny` for the safety-net files. Researched 2026-10-23 in [10-ask-vs-deny-safety-net.md](../research/tooling/10-ask-vs-deny-safety-net.md). Decided 2026-10-24: `deny` for all of them, no `ask`. The rule files decide what counts as passing (`vitest.config.mts` `include`, lint rules, `package.json` scripts), so they are part of the acceptance mechanism. An `ask` approved by habit would let the agent fake a green run. The "Who" column in 09's audit stays as it is
  - Rule changes a spec needs are made by the human when the spec and its acceptance tests are locked, before the run. The spec lists them
  - Before every spec run, the locked acceptance tests must fail for the right reason: the stage module is missing (compile/import error), not "no tests found" or a config error. Enforced by a script, not a manual step (ai-guru `steer-enforce`; `eval-design` delta 1: a check earns its place only if the baseline fails it). The script is the user's edit (`scripts/` is locked)
  - A `deny` hit during a run means the spec missed a rule change. The agent stops and reports why it needed the change (`implement-spec` STOP step), and the guard logs when. `deny` refusals reach no hook, so the log needs the PreToolUse hook to match the paths itself, or OTel `safety_event`
- [ ] Pre-run gate script: run the locked acceptance tests, pass only on the expected failure (missing stage module). Open: how to tell "module missing" from other failures, and where `implement-spec` calls it
- [ ] Decide when an agent blocked by the safety net stops and asks instead of trying workarounds. Threshold unknown. See [Open: escalation when the safety net blocks](#open-escalation-when-the-safety-net-blocks)
- [ ] Projection over agent transcripts: blocked/denied calls and red checks per session, with the agent's next action. See [Open: log of agent attempts](#open-log-of-agent-attempts)
- [ ] Decide on bare `node`: pnpm 12 global shim is not active (`command -v node` → nvm), so `node x.js` outside pnpm scripts uses nvm's version, not the lockfile pin
- [x] Bypass hook matches the flag string anywhere in a Bash command (heredocs, `echo`, docs) — narrowed 2026-10-19: flags are matched after stripping heredoc bodies and quoted strings

### Make `pnpm` resolvable in non-interactive shells

Corrected 2026-10-23 (`09-safety-net-gaps.md` §3): `~/.zshenv` reaches only zsh. The git hooks are `#!/bin/sh` and read no zsh file, so from a GUI git client they still get launchd's PATH and miss pnpm; that needs a fallback lookup in the hooks. Inside Claude Code pnpm resolves because PATH is inherited from the terminal, so the `zsh -c` row below is not reproducible there.

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
- `PATH=/usr/bin:/bin:/usr/sbin:/sbin /bin/zsh -c 'pnpm --version'` → `12.x` (`env -i` is blocked by the bypass hook)
- New Claude Code session: `pnpm --version` works without absolute path

### Safety-net guards under trunk

Researched 2026-10-18, Claude Code 2.1.302. Sources: Claude Code docs ([permissions](https://code.claude.com/docs/en/permissions), [permission modes](https://code.claude.com/docs/en/permission-modes), [sandboxing](https://code.claude.com/docs/en/sandboxing), [hooks](https://code.claude.com/docs/en/hooks), [env vars](https://code.claude.com/docs/en/env-vars), [managed settings](https://code.claude.com/docs/en/managed-settings)), [git githooks](https://git-scm.com/docs/githooks), GitHub docs ([about rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)). No primary source found on how teams handle this under trunk-based development. The comparison is built from the tool docs and local probes.

**Short answer.** No single guard covers every edit path. Permission deny rules cover the edit tools and the shell commands Claude Code recognizes. The Bash sandbox covers every shell subprocess at OS level. A pre-commit check on staged rule files catches what got past both, and the human override is free because the check fires only inside Claude Code. Bypasses that write no file (`git -c core.hookspath=…`, `GIT_CONFIG_*` env) are visible only to a PreToolUse hook, by string matching. Server-side push rulesets (file paths) are not available for this repo; branch rulesets that block force push and deletion are (corrected 2026-10-23, `09-safety-net-gaps.md` §1).

#### Probe of the current guard

`block-hook-bypass.sh` fed sample commands as hook input JSON on stdin, 2026-10-18:

| Command | Result |
|---|---|
| `git -c core.hookspath=/dev/null commit …` | passes. git config keys are case-insensitive: `git -c core.hookspath=/tmp/x rev-parse --git-path hooks` → `/tmp/x` |
| `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hookspath …` | passes |
| `git config core.hooksPath .githooks-off` | passes: the regex allows any value that starts with `.githooks` |
| `chmod -x .githooks/pre-commit` | passes. Git ignores hooks without the executable bit (githooks docs) |
| `echo "exit 0" > .githooks/pre-commit`, `git checkout HEAD~5 -- .githooks/pre-commit` | passes: out of the hook's scope |
| `git commit -m "docs: mention --no-verify"`, `git config core.hooksPath` (read) | blocked: false positives. The read, a test script and a heredoc writing this section were all blocked during this research |

#### What Claude Code already protects

- Protected paths (permission modes docs): `.git`, `.claude` (most of it), `.husky`, `.pre-commit-config.yaml`, `lefthook.yml` and others. In auto mode, writes there go to the classifier, not to the user. In `default`/`acceptEdits` they prompt. `bypassPermissions` allows them.
- Not protected: `.githooks/**`, `.github/**`, `oxlint.config.mts`, `tsconfig.json`, `.dependency-cruiser.cjs`, `pnpm-workspace.yaml`, `package.json`. In auto mode "file edits in your working directory are auto-approved" (permission modes docs), so today the agent can edit all of them with no prompt and no classifier review.
- Sandbox protected paths (sandboxing docs): `.claude` settings files and `.claude/hooks`, plus `hooks` and `config` inside `.git`. Not `.githooks/`.

#### Comparison

| Candidate | Blocks | Misses | Human override and its cost |
|---|---|---|---|
| **Deny rules** `Edit(<path>)` | Edit/Write tools; Bash `cat`, `head`, `tail`, `sed`, `tee`; `>`/`>>` redirect targets. Deny wins in every mode incl. `bypassPermissions`, and over an allow from any other scope (permissions docs) | `git checkout -- <file>`, `chmod`. `cp`/`mv` aren't in the documented list but were refused in a live test (2026-10-23, `10-ask-vs-deny-safety-net.md`). Heredoc bodies aren't checked (the redirect target is). Subprocesses that write files themselves (node, python). Docs: a Bash rule "isn't a security boundary around the program" | User edits the file in the editor or their own terminal; no in-session approval. Cost: low, rule changes are rare |
| **Ask rules** `Edit(<path>)` | Edit/Write tools only: prompts in every interactive mode, denied in `-p` | Every shell write: `sed`, `tee`, `>`, `cp`, `mv` ran without a prompt in a live test (2026-10-23, `10-ask-vs-deny-safety-net.md`). Not merged into the sandbox (only `Edit` deny is) | Approve the prompt in-session. Cost: one prompt per edit, plus the risk of approving by habit |
| **PreToolUse hook** | Anything visible in the command string: `git -c`, `GIT_CONFIG_*`, `chmod`, `unset` of env vars. Exit 2 blocks before permission rules, so it beats allow rules (permissions docs) | Anything not literally in the string: variables, `sh -c "$X"`, scripts. Docs recommend the permission system, not a hook, for a hard allow/deny. Current script: 6 bypasses and 2 false positives above | None built in; the user runs the command themselves. Cost: false positives block legitimate reads, commits and doc edits |
| **Bash sandbox** (`sandbox.enabled`, `allowUnsandboxedCommands: false`, `failIfUnavailable`) | OS-level write denial for every shell command and its children: `sed`, heredoc, `git checkout`, `chmod`, node scripts. `Edit` deny rules are merged into the sandbox deny-write list. Also denies writes to `.git/config` and `.git/hooks`, so `git config core.hooksPath x` fails | Edit/Write tools (they follow permission rules); hooks; `excludedCommands`; commands the user types at `!`. In-process overrides that write no file (`git -c`, env vars). Docs: "not a complete isolation boundary" | User edits outside the sandbox (editor, own terminal, `!`). Cost: setup and a network allowlist (pnpm registry, GitHub). SSH `git push` and `gh` may need `excludedCommands` (docs name `gh` TLS failures). `package.json` can't be deny-written: `pnpm add` writes it |
| **Pre-commit check on staged rule files** | Any edit path, at commit time: `git diff --cached --name-only` against the list. Detects the agent by `CLAUDE_CODE_CHILD_SESSION=1`, which Claude Code sets in Bash tool subprocesses and hooks, not in IDE terminals (env vars docs; present in this session) | Doesn't run when hooks are skipped or redirected (`-c core.hookspath`, `chmod -x`). The agent can `unset` the variable (string-matchable by the PreToolUse hook). `package.json` needs a diff of the `scripts` field, not the whole file | Commit from your own terminal, where the variable isn't set. Cost: zero. Unverified: whether `!` commands also get the variable |
| **ConfigChange hook** | Stops a mid-session change to user/project/local settings from taking effect (hooks docs) | Only `.claude` settings files. The change stays on disk and can be committed | Restart the session. Cost: low |
| **Managed settings** (`/Library/Application Support/ClaudeCode/managed-settings.json`) | Deny rules and hooks the repo can't override. The directory is root-owned on this machine, so the agent needs `sudo` to change them | Same edit-path coverage as the rules it holds | Edit with `sudo`. Cost: the rules live outside the repo, unversioned |
| **Server-side** (GitHub rulesets) | Push ruleset "Restrict file paths" blocks direct pushes, no PR needed. Branch ruleset "Block force pushes" + "Restrict deletions" works without a PR rule and is available here (`09-safety-net-gaps.md` §1) | Push rulesets exist only for private/internal repos (creating-rulesets docs; plan pages tie them to Team/Enterprise). This repo is public on a personal account: **push rulesets not available**. Branch rulesets can't tell the agent from the human: the agent pushes with the user's credentials | n/a |
| **CI after push** | Nothing before `main` moves (ADR 0003: reports, doesn't block) | Everything, until after the push | n/a |

The auto mode classifier blocks "Running a command with a flag that disarms a safety guard" and "disabling CI checks" (permission modes docs). That is judgment, not a rule, and the docs say boundaries "can be lost" on compaction. Not counted as a guard.

#### Recommendation

Superseded 2026-10-19: the setup is deny rules + staged-file check + narrowed hook, with no sandbox, and nothing is copied to managed settings (see the decision in §6 and `architecture-check.md` §3). The four layers below are kept as the research record.

Four layers:

1. **Deny rules** `Edit(...)` for the rule files, in project settings and copied to managed settings so a repo edit can't remove them. Not `package.json`.
2. **Sandbox in strict mode.** Turns the deny rules into OS-level write denial for every shell path and protects `.git/config`. Highest setup cost; the only layer that closes `git checkout`, `chmod` and scripts.
3. **Pre-commit staged-file check** gated on `CLAUDE_CODE_CHILD_SESSION=1`, with a `scripts` diff for `package.json`. Catches what the first two miss. Human override: commit from your own terminal.
4. **PreToolUse hook narrowed to the no-file bypasses**: case-insensitive `core.hookspath`, `GIT_CONFIG_*`, `-c` overrides, `chmod` on `.githooks`, `unset`/`env -u` of `CLAUDE_CODE_CHILD_SESSION`. Match only `git`/`chmod`/`env` invocations, so docs and reads stop tripping it.

Residual risk after all four: a hooks-path override hidden from the command string (variable, `sh -c`). Only a server-side check closes that, and none is available for a public personal repo. CI after push detects it late.

#### Follow-ups

- `architecture-check.md` §3:
  - Replace "deny `Edit`/`Write`" with `Edit(...)` deny only. Claude Code ignores path rules on `Write` and warns at startup (permissions docs).
  - "Block edits through Bash" = layer 2 (sandbox). "A commit that stages these files without a human override" = layer 3; override = commit from your own terminal.
  - Verify `pnpm install` / `pnpm add` still work with `pnpm-workspace.yaml` deny-written by the sandbox.
- ADR 0003:
  - Trade-offs: "Server-side guards give no protection" holds, but not only because there are no PRs. Push rulesets would block direct pushes and are offered only for private/internal repos on Team/Enterprise. Record that, so going private on a paid plan is a revisit trigger.
  - Constraints: "a Claude Code hook blocks the agent from skipping the git hooks" overstates it (6 bypasses above).
  - Measure: a shell edit fails before the commit only with the sandbox on, or at the commit via the staged-file check. Say which, and name the residual no-file hooks-path bypass.
  - Measure needs a human-override clause: the human changes safety-net files outside Claude Code.
  - Safety-net file list: add `pnpm-workspace.yaml` and `package.json` scripts (in this task's scope, missing from the ADR).
- This file: the checkboxes "Protect `.claude/settings.json` …" and "Bypass hook matches the flag string …" are done with the three-layer setup decided 2026-10-19, not the four layers.

#### Open: lighter setup without custom scripts

Status: for further analysis. User feedback 2026-10-18: the sandbox and the four layers feel like overkill; prefer no custom shell scripts.

**Mods don't remove custom code.** Checked against the [mods overview](https://code.claude.com/docs/en/plugins/mods/overview), Claude Code 2.1.302:

- A mod is a plugin "made of JavaScript or TypeScript event handlers". It is custom code in JS instead of shell, not configuration.
- A `tool.call` hook can refuse a call ("Answer: handle the event itself … such as refusing a command"). So a mod could replace `block-hook-bypass.sh`. It still matches the command text, so it has the same blind spots (variables, `sh -c`).
- What a mod adds over a shell hook: it can hold a call and ask the user in the UI. The sample [`blast-radius`](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/blast-radius) holds a risky command "with buttons to proceed or cancel". That is an in-session human override, but it's a sample shared "as they are, without support".
- Risk: a mod "can approve one that an `ask` rule would prompt for, or that one of your own `PreToolUse` hooks blocked", and on a personal machine without managed settings it can approve a call a deny rule refuses (permissions docs). A guard mod has to be written so it never approves.
- No built-in mod protects files or permissions. `cc-plugin-sec-default` guards organization-managed config from user-installed mods, which is a different problem.

**No-script minimum, settings only:**

| Piece | Covers | Leaves open |
|---|---|---|
| `Edit(...)` deny rules on the rule files | Edit/Write tools, `sed`/`cat`/`tee`, `>` redirects | `git checkout -- <file>`, `chmod`, `cp`/`mv`, scripts |
| `Bash(...)` deny rules: `git -c *`, `git config core.*`, `chmod *`, `git checkout *` (plus the existing `--no-verify` / `-n` rules) | The usual spellings of the bypasses in the probe table | Other spellings: `git -C . -c …`, `/usr/bin/git`, `sh -c '…'`, env vars (permissions docs, "What a Bash rule doesn't match"). `chmod *` and `git checkout *` also block legitimate use |
| Auto mode classifier | Judgment against "a flag that disarms a safety guard", "disabling CI checks" | Not a rule; can be lost on compaction |
| Remove `block-hook-bypass.sh` | Its two false positives | Case-insensitive `core.hookspath` would then depend only on the `git -c *` / `git config core.*` deny rules |

Questions to settle:

1. Is "usual spelling blocked, deliberate evasion not" enough for the threat? The threat is an agent taking a shortcut to green, not an adversary. If yes, the no-script minimum may be enough.
2. Does the staged-file check count as a custom script? It would be a few lines in the existing `.githooks/pre-commit`, not a new file. It is the only piece that catches every edit path at the commit.
3. `ask` instead of `deny` for `git checkout *` and `chmod *`, to avoid blocking legitimate use? Ask rules prompt even in auto mode.

### Open: escalation when the safety net blocks

Status: for further analysis. Raised 2026-10-19.

Problem: the guards stop the usual bypasses, but an agent that doesn't know how to fix what the safety net reports may keep trying other routes (new spellings, scripts, workarounds in code) instead of asking. The guards make each route fail; nothing tells the agent when to stop looking for the next one.

Today: the `implement-spec` skill says to stop and report when a check fails because of a rule. Ordinary red checks (type errors, a boundary the design really needs to cross) have no limit.

Questions to settle:

1. What is the threshold: number of attempts on the same failing check, number of hook/deny blocks in a session, or the kind of failure (a rule vs. the agent's own code)?
2. What does stopping look like: `AskUserQuestion` in an interactive session, a report with the failing command and up to two proposed fixes in an unattended one?
3. Is a skill instruction enough, or does it need a hook that counts blocks and tells the agent to stop?

Check first: maister (`~/Projects/maister`). Seen so far: `plugins/maister/agents/task-group-implementer.md` — tests fail → "Attempt fix (max 3 attempts)" → report PARTIAL; missing dependency or unclear spec → report FAILED, and the main agent uses `AskUserQuestion`. Not checked: whether maister counts blocked tool calls, and whether 3 was measured or picked.

### Open: log of agent attempts

Status: for further analysis. Raised 2026-10-19.

Goal: know what agents tried against the safety net, to find failures and learn from them (event-sourcing style: events stored, findings are projections).

Claude Code already stores every session as append-only JSONL in `~/.claude/projects/-Users-verthon-Projects-gym/`: each tool call with its command, failures marked `is_error: true`. On 2026-10-19, of 49 sessions, 6 contained a hook `BLOCKED:` message and 2 a deny-rule refusal. Missing is the projection: attempt → what stopped it → what the agent did next.

Questions to settle:

1. Claude Code sessions only, or the agy runs too? agy leaves no Claude transcript, so covering it needs a log written by the git hooks and checks themselves.
2. Retention: transcripts are cleaned up after `cleanupPeriodDays` (default 30, not verified for this version). Raise it, or copy findings into `agy-findings.md`-style docs?

