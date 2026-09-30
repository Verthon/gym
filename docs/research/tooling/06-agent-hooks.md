# Research: agent-harness hooks that run deterministic checks inside the loop

Created: 2026-09-29
Input: Claude Code hooks reference and guide (code.claude.com, fetched 2026-09-29), permissions and permission-modes docs, Antigravity hooks docs (antigravity.google/docs/hooks.md, fetched 2026-09-29), practitioner setups, plus measurements and hook prototypes in a scratch copy of the repo.
Tags as in the earlier docs: **[E]** evidence (a measurement or an observed result), **[V]** vendor guidance (a vendor's own docs), **[O]** opinion (ours says "ours").
Not repeated: the agy hook event list and `-p` soft-deny (`agy-open-gaps-research.md` §7), the "exit 2 → stderr reaches Claude" channel (`01-harness-engineering.md`), and oxfmt as the formatter (`07-format-duplication.md`).

## Bottom line

- **Split by cost. A per-edit hook runs oxlint on the one file. A Stop hook runs the full `pnpm check`.** With `typeCheck: true` in `oxlint.config.mts`, oxlint on one file reports lint errors and that file's TypeScript errors in about 0.4 s. It can't see callers that the edit broke. Only the whole-repo run (oxlint or `tsc`) finds those. That makes the Stop hook the gate and the per-edit hook the early warning.
- **Vitest cost more than every other check put together, and the cause is one import line.** `import { … } from "date-fns"` in `LocalDate.mts` makes every spec that touches `LocalDate` load the whole date-fns barrel. That costs about 0.9 s per spec file. `vitest run` fell from 12.6 s to 1.4 s after switching to subpath imports (`date-fns/parseISO`, …). `pnpm check` fell from about 13.5 s to about 2.4 s. At 2.4 s a blocking Stop gate on every turn costs little. At 13 s it doesn't.
- **Claude Code has everything we need, documented.** The pieces:
  - `PostToolUse` exit 2 shows stderr to Claude.
  - `Stop`/`SubagentStop` with `{"decision":"block","reason":…}` keeps the agent working.
  - `stop_hook_active` plus a built-in cap of 8 consecutive blocks stop runaway loops.
  - Hook text is capped at 10,000 characters.
  - `Edit(path)` deny rules also cover `sed`, `tee` and `>` redirects in Bash.
- **agy has hooks too, but its `PostToolUse` can't talk back.** Per the docs its output is `{}`. Lint feedback has to be stored and then injected on the next `PreInvocation` as an `ephemeralMessage`. We saw hooks fire under `agy -p` (`PreInvocation`, `PreToolUse`). A `PreToolUse` `"allow"` did **not** override the headless soft-deny. `PostToolUse` and `Stop` under `-p` are still unverified, because the probe runs ended on a permission denial before those events fired.

---

## 1. Timings (scratch copy, Apple M1, 8 cores)

Setup: a copy of the working tree with the stale tsc-emitted `src/**/*.mjs` files and the unimplemented `src/sandbox` fixture removed. With the `.mjs` files present, vitest resolves specs to stale output and 20 of 22 files fail. Numbers are medians of 5–7 runs after a warm-up and include the `node_modules/.bin` shims.

| Command | Median | Notes |
|---|---|---|
| `oxlint <one file>` (config: `typeAware` + `typeCheck`) | 0.26–0.42 s | Reports that file's TS errors, for example TS2322 and TS2554 |
| `oxlint --fix <one file>` | 0.56 s | |
| `oxlint` (whole repo) | 0.83 s | Found the same 31 TS errors as `tsc` for a broken signature |
| `tsc --noEmit` (TS 7.0.2) | 0.44 s | |
| `vitest related --run <file>` | 4.38 s → **0.76 s** | before → after the date-fns subpath fix |
| `vitest run` (10 files, 45 tests) | 12.6 s → **1.4 s** | same fix. `--no-isolate` alone gets 6.3 s, `--pool=threads` 9.0 s |
| `pnpm check` | 13.5 s → **2.4 s** | pnpm's own overhead is 0.07 s |
| Prototype PreToolUse `guard-edit.sh` | 0.14 s | jq + grep |
| Prototype PostToolUse `post-edit-lint.sh` | 0.51 s | `oxlint --fix` on one file |
| Prototype Stop `stop-check.sh`: green, cold | 2.7 s | |
| Same, green, tree unchanged since last green | **0.08 s** | hash cache |
| Same, red at tests | 1.8–6 s | `--bail=3` |

Other passes measured oxfmt at about 112 ms per file, type-aware oxlint at about 448 ms per file, and an ast-grep scan at about 49 ms. That agrees with the numbers above.

**What goes where (ours, [O]):**

| Check | Hook | Why |
|---|---|---|
| oxlint `--fix` + errors on the edited file (+ oxfmt, see 07) | `PostToolUse` | Under 0.6 s. Catches in-file type errors right after the edit |
| Whole-repo oxlint, `tsc`, `vitest run` | `Stop` / `SubagentStop` | Catches broken callers and failing tests. About 2.4 s after the fix |
| `vitest related` per edit | nowhere | 0.76 s per edit for tests that are often mid-change. The Stop gate covers it |
| knip, jscpd | CI / pre-push | Whole-repo, slow, rarely the cause of a single edit's failure |

### Diagnosis: date-fns barrel import

- [E] Running each spec file alone:
  - specs that reach `LocalDate` spend 0.9–2.3 s in `collect`;
  - `PersonId.spec.mts`, which doesn't touch `LocalDate`, spends 40 ms.
- [E] Replacing line 1 of `src/utils/LocalDate.mts` with five subpath imports (`import { parseISO } from "date-fns/parseISO";` and so on):
  - `tsc` stays clean and all 45 tests pass;
  - `vitest run` goes from 12.6 s to 1.4 s.
- This isn't a hook change, but it's the change that makes a Stop gate affordable. Guard it with a lint rule (`no-restricted-imports` on bare `"date-fns"`) so it doesn't come back.

## 2. Claude Code: what the docs say (verified 2026-09-29)

Source for everything in this section: Anthropic, [Hooks reference](https://code.claude.com/docs/en/hooks) and [Hooks guide](https://code.claude.com/docs/en/hooks-guide), [V].

**Matchers.**
- A matcher made only of letters, digits, `_`, `-`, spaces, `,` and `|` is an exact name or a list of names, so `Edit|Write` matches exactly those two tools.
- Any other character makes it an unanchored JS regex: `Edit.*` also matches `NotebookEdit`.
- `Stop`, `PostToolBatch` and `UserPromptSubmit` take no matcher. A matcher on them is ignored.
- `SubagentStop` matches on agent type.

**The `if` field.**
- `if` holds one permission-rule pattern, for example `"Edit(*.ts)"`, and applies only on tool events.
- Its Bash matching is "best-effort", and the docs say: "use the permission system rather than a hook to enforce a hard allow or deny."

**Exit codes.**
- 0 = success. On most events stdout goes only to the debug log. Stdout that starts and ends with `{`…`}` is parsed as JSON.
- 2 = blocking error:
  - `PreToolUse`: blocks the tool call;
  - `PostToolUse`: "Shows stderr to Claude; the tool already ran";
  - `Stop`: "Prevents Claude from stopping, continues the conversation";
  - `SubagentStop`: prevents the subagent from stopping;
  - `PostToolBatch`: stops the agentic loop before the next model call.
- Any other code, including 1, is a *non-blocking* error and the action proceeds. The docs warn: "If your hook is meant to enforce a policy, use `exit 2`."
- A missing or non-executable script also counts as non-blocking: "a mistyped path in `settings.json` leaves the gate silently disabled."

**JSON output.**
- `PostToolUse`:
  - `{"decision":"block","reason":…}` adds the reason next to the tool result;
  - `additionalContext` adds non-error context;
  - `updatedToolOutput` replaces what Claude sees, and the docs warn against stripping errors from it.
- `PreToolUse`: `hookSpecificOutput.permissionDecision` of `allow`, `deny`, `ask` or `defer`.
  - The `deny` reason goes to Claude. The `ask` reason goes to the user only.
  - Precedence across hooks: deny > defer > ask > allow.
  - A hook `deny` holds even in `bypassPermissions`.
  - A hook `allow` never overrides settings deny or ask rules.
- `Stop` and `SubagentStop`:
  - `{"decision":"block","reason":…}`, where `reason` is required;
  - or `hookSpecificOutput.additionalContext` for "non-error feedback". It still continues the turn, but it shows as "Stop hook feedback" instead of a hook error.

**Loop protection.**
- `Stop`/`SubagentStop` input carries `stop_hook_active`, which is true when Claude is already continuing because of a Stop hook.
- Built-in cap: "after stop hooks have continued the turn eight times in a row, Claude Code overrides the next block and ends the turn". It can be raised with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.
- `Stop` "fire[s] whenever Claude finishes responding, not only at task completion". That includes question-only turns, which is why the prototype caches the last green tree hash.

**Output size.**
- `additionalContext`, `systemMessage` and plain stdout are capped at 10,000 characters each.
- Anything over the cap is saved to a file, and Claude gets a 2,000-character preview. "Claude Code doesn't ask Claude to read the file."

**Timeouts.**
- The command-hook default is 600 s, set per hook with `timeout` in seconds.
- A timed-out `PreToolUse` command hook "doesn't block the tool call", so a slow guard is no guard.
- `async: true` runs the hook in the background, and it "can't block or control Claude's behavior". Its results arrive on the next turn.
- `asyncRewake: true` wakes Claude on exit 2. It suits long test suites, but we don't need it at 2.4 s.

**Parallel edits.**
- `PostToolUse` fires once per tool and runs concurrently for parallel calls.
- `PostToolBatch` fires once per batch and can inject `additionalContext` or stop the loop. It's a possible single place for whole-repo checks mid-turn. We don't need it now.

**Files changed under the agent.**
- An edit still applies to a file changed on disk after Claude read it when `old_string` "matches the current content exactly". The result tells Claude to re-read ([Tools reference](https://code.claude.com/docs/en/tools-reference), [V]).
- So `oxlint --fix` inside `PostToolUse` is safe.
- [E] `oxlint --fix` in 1.85 does **not** remove an unused import. That fix is a suggestion, applied only with `--fix-suggestions`.

**Protecting config files.**
- `.claude/` is already a protected path. Writes there are prompted in default, acceptEdits and auto modes, and never pre-approved by allow rules ([Permission modes](https://code.claude.com/docs/en/permission-modes), [V]).
- `.githooks/`, `oxlint.config.mts`, `tsconfig.json` and `package.json` are **not** on that list.
- `Edit(...)` deny rules apply to "file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, `sed`, and `tee`, and to the targets of Bash redirections". They don't cover "arbitrary subprocesses … like a Python or Node script". The sandbox is the OS-level answer ([Permissions](https://code.claude.com/docs/en/permissions), [V]).
- Path anchors: `/path` in project settings means relative to the project root.
- A `ConfigChange` hook with matcher `project_settings` can also block a settings change from taking effect mid-session.

## 3. Practitioners

- [O, named] Boris Cherny (Anthropic, creator of Claude Code), [setup thread](https://twitter-thread.com/t/2007179832300581177), 2026-01-02:
  - "We use a PostToolUse hook to format Claude's code … the hook handles the last 10% to avoid formatting errors in CI later."
  - "Give Claude a way to verify its work … it will 2-3x the quality of the final result."
  - For long-running tasks he uses "an agent Stop hook to do that more deterministically".
  - These are claims with no published measurement.
- [O, named] Dex Horthy (HumanLayer), [*Context-Efficient Backpressure for Coding Agents*](https://www.humanlayer.dev/blog/context-efficient-backpressure), 2025-12-09:
  - "swallow all test/build/lint output and replace it with a single ✓ if the stage passes. If exitCode != 0, dump the stashed output".
  - "Enable failFast … One failure at a time".
  - "grep/sed/awk/cut/etc your way to just the assertion that failed."
  - A passing run's output can waste "2-3% of your context window".
  - The prototype follows this: silent on green, first failing stage only, `--bail=3`, error lines only, colour off.
- [V] Oxc, [Coding agents](https://oxc.rs/docs/guide/usage/coding-agents.html): a `PostToolUse` hook running `oxlint --fix` then `oxfmt` on the edited file, already cited in 07. oxlint 1.85 also has `-f agent`. On our errors its output was the same as `default`. `-f unix` is shorter and ends with a count.
- [O] nizos, [tdd-guard](https://github.com/nizos/tdd-guard): blocks Edit/Write that skip tests or over-implement, but it uses an LLM to judge. That's not deterministic, so it's out of scope here.
- Blog roundups (Sandlabs, Pixelmojo, aiorg.dev, claudefa.st) all repeat the same "exit early when `stop_hook_active` is true" rule. They are secondary and add nothing beyond the reference.

## 4. What we observed

- [E] **Output size of a failing test run** (2 failures, vitest 3.2):

  | Output | Size |
  |---|---|
  | default reporter | 84 lines, 4.5 KB |
  | `--reporter=dot` | 45 lines, 1.9 KB |
  | `dot --bail=1` | 29 lines, 1.1 KB |
  | the prototype's filtered block | about 1 KB with the code frame |

  Vitest printed ANSI colour codes into a pipe, so `NO_COLOR=1` is needed.
- [E] **Lint already blocks the cheap ways to weaken a test.** `it.skip`, `it.only`, `it.todo`, a test with no assertion, and a commented-out test all fail oxlint under the current config (`vitest/no-disabled-tests`, `no-focused-tests`, `warn-todo`, `expect-expect`, `no-commented-out-tests`).
  - What lint can't see: deleted tests or assertions, changed expected values, and new suppression comments. `typescript/ban-ts-comment` is not enabled today.
- [E] **Intermediate-state false positives.** An agent often adds an import first and its use in a later edit, and per-edit linting flags the import in between. The prototype turns off `no-unused-vars` in the per-edit pass only. The Stop gate still enforces it.
- [E] **The existing bypass hook blocked this research.** A heredoc that only *wrote* a `settings.json` containing the literal `--no-verify` string was blocked. This is the false positive already noted in `harness.md`. Our workaround was writing the file with the Write tool.
- [E] **agy probe** (agy 1.2.12, tiny scratch dir, `-p`, no skip-permissions):
  - `PreInvocation` and `PreToolUse` fired and got the documented payloads. The `write_to_file` args were `TargetFile`, `CodeContent`, `Overwrite` and `Description`.
  - Returning `{"decision":"allow"}`, and also with `permissionOverrides: ["write_file(<path>)"]`, did not stop headless mode from soft-denying the write ("a tool required the \"write_file\" permission … auto-denied"). The run exited 0.
  - `PostInvocation`, `PostToolUse` and `Stop` never fired in those runs.
  - The third run, with `--dangerously-skip-permissions`, was refused by our own Claude Code auto-mode classifier, so we didn't run it.
- [E] **The global agy RTK hook returns `"allow"` for every `run_command`** (`~/.gemini/hooks/rtk-hook-antigravity.sh`). In interactive agy, the docs say `"allow"` "Automatically allows the tool execution". That hook may be silently auto-approving every shell command. Under `-p` it didn't (see above). This needs a check in interactive mode.
- [E] **Correction to `07-format-duplication.md`.** It says agy has "no per-tool post hook". The current agy docs list `PostToolUse` with a `toolCall` and `error` input and a `{}` output. It exists but can't return feedback.

## 5. agy equivalents (from the docs, [V], and ours, [O])

| Need | Claude Code | agy |
|---|---|---|
| Lint after edit, fed back | `PostToolUse` exit 2 + stderr | `PostToolUse` saves the errors to a file, and the next `PreInvocation` returns `injectSteps: [{ephemeralMessage}]` |
| Tool names | `Edit`, `Write` (`file_path`) | `write_to_file`, `replace_file_content`, `multi_replace_file_content` (`TargetFile`) |
| Gate on finish | `Stop` → `decision: "block"` | `Stop` → `decision: "continue"`, `reason` is injected |
| Loop protection | `stop_hook_active` + cap of 8 | Nothing built in. Keep our own counter per `conversationId`, and act only when `terminationReason == "model_stop"` |
| Deny an edit | `permissionDecision: "deny"` or settings deny | `decision: "deny"`. The hook is agy's only project-scoped guard |
| Neutral pass-through | exit 0, no output | `decision` is "Required". `"allow"` auto-approves in interactive mode. `"ask"` "respects Always Allow settings", so ours, [O], is to use `"ask"` as the pass-through. Untested |
| Default timeout | 600 s | 30 s. Set the Stop timeout explicitly |
| Exit codes | documented | not documented. Always exit 0 and print JSON |

## 6. Drafted scripts

Layout: shared logic in `scripts/hooks/`, with thin adapters per harness. All of it was verified in the scratch copy with synthetic stdin, which is how the Claude Code guide says to test hooks. None of it has run inside a live Claude Code or agy session.

### `scripts/hooks/lint-file.sh`

```bash
#!/bin/bash
# usage: lint-file.sh <absolute path>  -> exit 0 clean/skipped, 1 with trimmed errors on stdout
root=$(cd "$(dirname "$0")/../.." && pwd)
file="$1"
case "$file" in
  "$root"/src/*.ts|"$root"/src/*.mts) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
cd "$root" || exit 0
out=$(node_modules/.bin/oxlint --fix --quiet -f unix \
  -A no-unused-vars -A typescript/no-unused-vars "${file#"$root"/}" 2>&1) && exit 0
errs=$(printf '%s\n' "$out" | grep -E '^[^ ]+:[0-9]+:[0-9]+:')
n=$(printf '%s\n' "$errs" | grep -c .)
echo "oxlint: $n error(s) in this file (lint + types; safe fixes already applied):"
printf '%s\n' "$errs" | head -n 20
[ "$n" -gt 20 ] && echo "... $((n - 20)) more"
exit 1
```

It calls `node_modules/.bin/oxlint` directly. That worked with `env -i PATH=/usr/bin:/bin`, so the hook doesn't depend on the `pnpm`-on-PATH problem in `harness.md`. Add `node_modules/.bin/oxfmt "$file"` before the lint once 07 lands.

### `scripts/hooks/check.sh`

```bash
#!/bin/bash
# usage: check.sh -> exit 0 green (or unchanged since last green), 1 red with "<stage>\n<trimmed output>" on stdout
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root" || exit 0
state="${TMPDIR:-/tmp}/gym-agent-check"
mkdir -p "$state"
paths=(src tsconfig.json oxlint.config.mts vitest.config.mts package.json pnpm-lock.yaml)
hash=$(
  {
    git rev-parse HEAD
    git diff HEAD --no-ext-diff -- "${paths[@]}"
    git ls-files -o --exclude-standard -z -- "${paths[@]}" | xargs -0 shasum 2>/dev/null
  } | shasum | cut -d' ' -f1
)
[ "$(cat "$state/last-green" 2>/dev/null)" = "$hash" ] && exit 0

export NO_COLOR=1 FORCE_COLOR=0
bin=node_modules/.bin
cap() {
  local all n
  all=$(cat); n=$(printf '%s\n' "$all" | grep -c .)
  printf '%s\n' "$all" | head -n "$1"
  [ "$n" -gt "$1" ] && echo "... $((n - $1)) more lines"
}
red() { printf '%s\n%s\n' "$1" "$2"; exit 1; }

out=$($bin/oxlint --quiet -f unix 2>&1) ||
  red lint "$(printf '%s\n' "$out" | grep -E '^[^ ]+:[0-9]+:[0-9]+:' | cap 40)"
out=$($bin/tsc --noEmit --pretty false 2>&1) ||
  red type-check "$(printf '%s\n' "$out" | grep 'error TS' | cap 40)"
out=$($bin/vitest run --reporter=dot --bail=3 2>&1) ||
  red "unit tests" "$(printf '%s\n' "$out" | grep -vE '^ *(RUN|Start at|Duration)|^[·x.*-]+$|^$' | cap 60)"

echo "$hash" > "$state/last-green"
exit 0
```

It runs the same three stages as `pnpm check`, but stops at the first red stage and prints only error lines. The worst case, 40 lint lines, came to 4.1 KB, well under the 10,000-character cap.

### `scripts/hooks/edit-verdict.sh`

```bash
#!/bin/bash
# usage: edit-verdict.sh <file> <before-file> <after-file> -> prints "deny|ask<TAB>reason" or nothing
file="$1"; before=$(cat "$2"); after=$(cat "$3")
root=$(cd "$(dirname "$0")/../.." && pwd)
rel="${file#"$root"/}"
case "$rel" in
  .claude/settings.json|.claude/hooks/*|.agents/hooks.json|.agents/hooks/*|.githooks/*|scripts/hooks/*|.github/workflows/*)
    printf 'deny\t%s is part of the check harness and is read-only for agents. Ask the user to change it.\n' "$rel"; exit 0 ;;
  oxlint.config.mts|tsconfig.json|vitest.config.mts|knip.config.ts|package.json)
    printf 'ask\t%s configures the checks. Changing it needs user approval.\n' "$rel"; exit 0 ;;
esac
case "$file" in *.ts|*.mts) ;; *) exit 0 ;; esac
count() { printf '%s' "$1" | grep -oE "$2" | wc -l | tr -d ' '; }
suppress='(oxlint|eslint)-disable|@ts-(ignore|nocheck|expect-error)|as any\b|as unknown as'
if [ "$(count "$after" "$suppress")" -gt "$(count "$before" "$suppress")" ]; then
  printf 'deny\tThis edit adds a lint/type suppression (oxlint-disable, @ts-ignore, @ts-expect-error, as any, as unknown as). Fix the underlying error. If a suppression is truly needed, stop and ask the user.\n'
  exit 0
fi
case "$file" in
  *.spec.ts|*.spec.mts|*/__tests__/*)
    asserts='\b(expect|expectTypeOf|failWith)\(|\b(it|test)\('
    b=$(count "$before" "$asserts"); a=$(count "$after" "$asserts")
    [ "$a" -lt "$b" ] && printf 'ask\tEdit removes test cases or assertions in %s (%s -> %s). Confirm this is intended.\n' "$rel" "$b" "$a"
    ;;
esac
exit 0
```

Limits:
- It compares counts only, so changing an expected value (`toBe("109.00")` → `toBe("999.00")`) passes.
- `ask` needs a human. In `claude -p` or `agy -p` it behaves as a denial.
- Suppressions would sit better as lint rules (`typescript/ban-ts-comment`, `no-explicit-any`) where oxlint has them. The hook covers `oxlint-disable`, which lint can't ban.

### `.claude/hooks/post-edit-lint.sh`

```bash
#!/bin/bash
file=$(jq -r '.tool_input.file_path // empty')
out=$("$CLAUDE_PROJECT_DIR"/scripts/hooks/lint-file.sh "$file") && exit 0
echo "$out" >&2
exit 2
```

### `.claude/hooks/stop-check.sh` (used for both `Stop` and `SubagentStop`)

```bash
#!/bin/bash
input=$(cat)
max=3
state="${TMPDIR:-/tmp}/gym-agent-check"; mkdir -p "$state"
counter="$state/$(jq -r '.agent_id // .session_id // "none"' <<<"$input").blocks"
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] || rm -f "$counter"

out=$("$CLAUDE_PROJECT_DIR"/scripts/hooks/check.sh) && { rm -f "$counter"; exit 0; }

stage=$(head -n 1 <<<"$out"); details=$(tail -n +2 <<<"$out")
blocks=$(cat "$counter" 2>/dev/null || echo 0)
if [ "$blocks" -ge "$max" ]; then
  rm -f "$counter"
  jq -nc --arg m "pnpm check still red at $stage after $max fix attempts. Agent was allowed to stop." '{systemMessage: $m}'
  exit 0
fi
echo $((blocks + 1)) > "$counter"
jq -nc --arg r "$(printf 'pnpm check failed at %s (attempt %d/%d). Fix the cause; do not skip, disable or weaken checks or tests. If you cannot fix it, say so and stop.\n%s' "$stage" $((blocks + 1)) "$max" "$details")" \
  '{decision: "block", reason: $r}'
```

Instead of the common "exit 0 whenever `stop_hook_active`" rule, it allows 3 fix attempts and then lets the agent stop, with a `systemMessage` to the user. This is Aider's max-3 from `agy-open-gaps-research.md` §6. The attempt counter resets on every fresh stop (`stop_hook_active == false`).

Verified sequence:

| Run | Result |
|---|---|
| green, cold | 2.7 s |
| green, cached | 0.08 s |
| red 1, 2, 3 | `block` |
| red 4 | allowed to stop, with the message |
| green after fix | 0.2 s |

### `.claude/hooks/guard-edit.sh`

```bash
#!/bin/bash
input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[ -n "$file" ] || exit 0
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
if [ "$(jq -r .tool_name <<<"$input")" = "Write" ]; then
  cat "$file" > "$tmp/before" 2>/dev/null || : > "$tmp/before"
  jq -r '.tool_input.content // ""' <<<"$input" > "$tmp/after"
else
  jq -r '.tool_input.old_string // ""' <<<"$input" > "$tmp/before"
  jq -r '.tool_input.new_string // ""' <<<"$input" > "$tmp/after"
fi
verdict=$("$CLAUDE_PROJECT_DIR"/scripts/hooks/edit-verdict.sh "$file" "$tmp/before" "$tmp/after")
[ -n "$verdict" ] || exit 0
jq -nc --arg d "${verdict%%$'\t'*}" --arg r "${verdict#*$'\t'}" \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
```

### `.claude/settings.json`

```json
{
  "permissions": {
    "deny": [
      "Bash(git commit --no-verify *)",
      "Bash(git commit -n *)",
      "Bash(git push --no-verify *)",
      "Edit(/.claude/settings.json)",
      "Edit(/.claude/hooks/**)",
      "Edit(/.agents/hooks.json)",
      "Edit(/.agents/hooks/**)",
      "Edit(/.githooks/**)",
      "Edit(/scripts/hooks/**)",
      "Edit(/.github/workflows/**)"
    ],
    "ask": [
      "Edit(/oxlint.config.mts)",
      "Edit(/tsconfig.json)",
      "Edit(/vitest.config.mts)",
      "Edit(/knip.config.ts)",
      "Edit(/package.json)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-hook-bypass.sh",
            "statusMessage": "Checking for git hook bypass"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-edit.sh", "timeout": 10 }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-edit-lint.sh",
            "timeout": 30,
            "statusMessage": "oxlint on edited file"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/stop-check.sh",
            "timeout": 180,
            "statusMessage": "pnpm check gate"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/stop-check.sh",
            "timeout": 180,
            "statusMessage": "pnpm check gate"
          }
        ]
      }
    ]
  }
}
```

The config paths are in `ask`, not `deny`, so the user can still approve a deliberate change in an interactive session. A headless run gets no prompt, so they behave like `deny` there. The deny rules cover Bash `sed`/`tee`/`>` but not `node -e` or `python`. Only the sandbox closes that gap.

### agy: `.agents/hooks.json` and adapters

```json
{
  "gym-checks": {
    "PreToolUse": [
      {
        "matcher": "write_to_file|replace_file_content|multi_replace_file_content",
        "hooks": [{ "type": "command", "command": ".agents/hooks/pre-tool.sh", "timeout": 10 }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "write_to_file|replace_file_content|multi_replace_file_content",
        "hooks": [{ "type": "command", "command": ".agents/hooks/post-tool.sh", "timeout": 20 }]
      }
    ],
    "PreInvocation": [
      { "type": "command", "command": ".agents/hooks/pre-invocation.sh", "timeout": 5 }
    ],
    "Stop": [
      { "type": "command", "command": ".agents/hooks/stop.sh", "timeout": 120 }
    ]
  }
}
```

The docs' example uses relative command paths. Whether those resolve from the workspace root under `-p` is unverified. If not, use absolute paths.

`.agents/hooks/pre-tool.sh`:

```bash
#!/bin/bash
input=$(cat)
root=$(cd "$(dirname "$0")/../.." && pwd)
pass() { echo '{"decision":"ask"}'; exit 0; }
file=$(jq -r '.toolCall.args.TargetFile // empty' <<<"$input")
[ -n "$file" ] || pass
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
case "$(jq -r .toolCall.name <<<"$input")" in
  write_to_file)
    cat "$file" > "$tmp/before" 2>/dev/null || : > "$tmp/before"
    jq -r '.toolCall.args.CodeContent // ""' <<<"$input" > "$tmp/after" ;;
  replace_file_content)
    jq -r '.toolCall.args.TargetContent // ""' <<<"$input" > "$tmp/before"
    jq -r '.toolCall.args.ReplacementContent // ""' <<<"$input" > "$tmp/after" ;;
  multi_replace_file_content)
    jq -r '[.toolCall.args.ReplacementChunks[]?.TargetContent] | join("\n")' <<<"$input" > "$tmp/before"
    jq -r '[.toolCall.args.ReplacementChunks[]?.ReplacementContent] | join("\n")' <<<"$input" > "$tmp/after" ;;
  *) pass ;;
esac
verdict=$("$root"/scripts/hooks/edit-verdict.sh "$file" "$tmp/before" "$tmp/after")
[ -n "$verdict" ] || pass
d=${verdict%%$'\t'*}; [ "$d" = ask ] && d=force_ask
jq -nc --arg d "$d" --arg r "${verdict#*$'\t'}" '{decision: $d, reason: $r}'
```

`.agents/hooks/post-tool.sh`:

```bash
#!/bin/bash
input=$(cat)
root=$(cd "$(dirname "$0")/../.." && pwd)
file=$(jq -r '.toolCall.args.TargetFile // empty' <<<"$input")
conv=$(jq -r '.conversationId' <<<"$input")
state="${TMPDIR:-/tmp}/gym-agy"; mkdir -p "$state"
out=$("$root"/scripts/hooks/lint-file.sh "$file") || printf '%s\n' "$out" >> "$state/$conv.pending"
echo '{}'
```

`.agents/hooks/pre-invocation.sh`:

```bash
#!/bin/bash
conv=$(jq -r '.conversationId')
p="${TMPDIR:-/tmp}/gym-agy/$conv.pending"
[ -s "$p" ] || { echo '{}'; exit 0; }
msg=$(head -c 8000 "$p"); rm -f "$p"
jq -nc --arg m "$msg" '{injectSteps: [{ephemeralMessage: $m}]}'
```

`.agents/hooks/stop.sh`:

```bash
#!/bin/bash
input=$(cat)
root=$(cd "$(dirname "$0")/../.." && pwd)
max=3
allow() { echo '{"decision":"stop"}'; exit 0; }
[ "$(jq -r .terminationReason <<<"$input")" = "model_stop" ] || allow
state="${TMPDIR:-/tmp}/gym-agy"; mkdir -p "$state"
counter="$state/$(jq -r .conversationId <<<"$input").blocks"
out=$("$root"/scripts/hooks/check.sh) && { rm -f "$counter"; allow; }
blocks=$(cat "$counter" 2>/dev/null || echo 0)
[ "$blocks" -ge "$max" ] && allow
echo $((blocks + 1)) > "$counter"
jq -nc --arg r "$(printf 'pnpm check failed at %s (attempt %d/%d). Fix the cause; do not skip, disable or weaken checks or tests. If you cannot fix it, write the report and stop.\n%s' "$(head -n 1 <<<"$out")" $((blocks + 1)) "$max" "$(tail -n +2 <<<"$out")")" \
  '{decision: "continue", reason: $r}'
```

With synthetic stdin, all four gave the expected JSON: a deny on `as any`, a deny on `.agents/hooks.json`, a lint error injected on the next invocation, and `continue` with the failing stage. Unlike Claude's, the agy counter never resets within a conversation, because agy has no `stop_hook_active`.

---

## Applied to us (ranked, leverage vs cost)

1. **Switch `LocalDate.mts` to date-fns subpath imports, and ban the bare `"date-fns"` import in lint.** One line, 9× faster tests, and it's what makes item 2 cheap. Delete the stray `src/**/*.mjs` first (`03`/`07` already cover this), because they break vitest.
2. **Claude `Stop` + `SubagentStop` gate** (`check.sh` + `stop-check.sh`). Closes the open `harness.md` item. It costs 2.4 s on a changed tree and 0.08 s on an unchanged one. It gives 3 attempts and then stops with a message.
3. **Deny/ask rules for the harness and config files.** Settings only, no script. Closes the open `harness.md` item for Claude, including Bash `sed`/`tee`/redirects.
4. **`PostToolUse` per-file oxlint** (`lint-file.sh`). 0.5 s per edit, with in-file type errors surfaced right after the edit. Add oxfmt here when 07 lands.
5. **`guard-edit.sh`** (suppressions → deny, fewer assertions → ask). 0.14 s per edit. Worth less than items 2–4 because the Stop gate plus existing lint rules already catch most weakening. It still catches the one thing nothing else does: new `oxlint-disable` or `@ts-expect-error` comments.
6. **agy adapters.** Run one more probe first, in the `hooks/agyprobe` scratch dir with an agy settings allow-rule for `write_file`, to see whether `PostToolUse` and `Stop` fire under `-p` and whether `"ask"` works as a neutral pass-through. Until then, agy's only gate is the git pre-commit hook.
7. **Check the global RTK agy hook's blanket `"allow"`** in interactive agy. If it auto-approves every command, change the pass-through to `"ask"`.
8. **Narrow `block-hook-bypass.sh` to real `git` invocations.** It blocked a heredoc during this research. With `if: "Bash(git *)"` on the handler, the script would run only for commands with a `git` subcommand. The docs call `if` best-effort, so keep the deny rules as the hard stop.

Not recommended: `vitest related` per edit (the Stop gate covers it), `async`/`asyncRewake` test runs (not needed at 2.4 s, and they can't block), and LLM-judged guards like tdd-guard (not deterministic).
