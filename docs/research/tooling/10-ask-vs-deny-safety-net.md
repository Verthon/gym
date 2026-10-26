# Research: `ask` instead of `deny` for the safety-net files

Created: 2026-10-23, Claude Code 2.1.309.
Input: `09-safety-net-gaps.md` (audit table, "Who" column), `.claude/settings.json`, `.claude/hooks/block-hook-bypass.sh`, `.githooks/pre-commit`, ADR 0003, `architecture-check.md` §3.
Tags as in the earlier docs: **[V]** vendor doc, **[E]** evidence or own test, **[O]** opinion.
Vendor docs were fetched as `.md` from code.claude.com on 2026-10-23: [permissions](https://code.claude.com/docs/en/permissions), [permission modes](https://code.claude.com/docs/en/permission-modes), [hooks](https://code.claude.com/docs/en/hooks), [headless](https://code.claude.com/docs/en/headless), [subagents](https://code.claude.com/docs/en/sub-agents), [Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions), [monitoring](https://code.claude.com/docs/en/monitoring-usage).
Threat model unchanged: an agent taking a shortcut to green, not an adversary (decided 2026-10-19).

## Bottom line

- **For the Edit tool, `ask` does what you want.** In an interactive session it prompts in every mode, including auto and bypassPermissions, and the prompt has no time limit. In `-p` it is denied in every mode, including bypassPermissions and dontAsk. That holds in subagents too [E]. Every approval covers one edit: "Yes, and switch to accept edits" doesn't stop the next prompt on a locked file [E].
- **For shell writes, `ask` does nothing.** `sed -i`, `>`, `tee`, `cp` and `mv` into an ask-ruled path ran without a prompt under acceptEdits and bypassPermissions. The same five commands were refused under a deny rule [E]. The docs list only Edit **allow and deny** rules for the redirect and `tee` checks [V]. So switching to `ask` alone silently drops the shell guard, in unattended runs too.
- **A PreToolUse hook that returns `ask` for shell writes closes the gap.** In the lab it prompted in interactive auto and bypassPermissions sessions, and it denied the call in `-p` [E]. It matches the command text, so it has the same blind spots as today's bypass hook.
- **The edit can be approved by more than the human.** A PermissionRequest hook, a `--permission-prompt-tool`, or a mod can approve an ask-rule edit. A PreToolUse hook's `allow` cannot [V/E]. None of these is configured here.
- **Keep the pre-commit staged-file check as it is.** A hook can see that an edit was prompted and then ran, but not who approved it [V/E]. The check is also the only layer that catches `git checkout`, `perl -i` and node writes [E]. You commit from your own terminal.
- **agy: no change.** agy reads neither the rules nor the hook, and doesn't set the variable the staged check keys on. Its guard stays the hash lock plus `git diff` after the run.
- **`continue: false` (follow-up c):** under `-p` it ends the run with exit 0 and subtype `success`, and the `stopReason` appears nowhere in the output. In a subagent it stops only that subagent. The parent gets an empty report and carries on [E].

## Mode-by-mode: an `Edit(...)` ask rule, Edit tool call

Lab: `"ask": ["Edit(/locked/**)"]`, prompt "Use the Edit tool to change `locked/a.txt`, one attempt". `-p` runs used `--setting-sources project,local` so the user-level RTK hook stayed out. Interactive runs drove the real TUI through a pty.

| Mode | Interactive | `-p`, no prompt tool | `-p` + `--permission-prompt-tool` | Subagent |
|---|---|---|---|---|
| default (Manual) | Prompt: "Yes / Yes, and switch to accept edits / No". Approved → edit ran [E] | Denied: "requested permissions … haven't granted it yet". PermissionRequest hook fired [E] | Tool asked, `allow` → edit ran [E] | `-p` foreground: denied [E]. Interactive: prompt shown in the main session, naming the agent. Approved → ran [E] |
| default + `--allowedTools Edit` | – | Denied: ask beats allow [E] [V: "a matching ask rule prompts even when a more specific allow rule also matches"] | – | – |
| acceptEdits | Prompt [E] | Denied [E] | not tested | – |
| auto | Prompt, not sent to the classifier [E] [V: "Explicit ask rules still force a prompt"] | Denied [E] | not tested | `-p` background: denied, "permission prompts are not available in this session". No PermissionRequest fired [E] |
| bypassPermissions | Prompt [E] [V: ask rules are in "Actions no mode auto-approves"] | Denied [E] | not tested | `-p` foreground: denied [E] |
| dontAsk | not tested | Denied without a PermissionRequest. The denial text says "You *may* attempt to accomplish this action using other tools" [E] | – | – |

**Does an unanswered ask become a deny?**
- Interactive: no. The prompt was still open after 200 s, the file was unchanged, and nothing was auto-denied [E]. The docs say an ask rule prompts "without a time limit", in the section on critical-path removals [V].
- `-p`: yes. With nobody to answer, the call is denied at once [E] [V: "a call that needs approval is denied unless something approves it"].
- Background subagent: in `-p` it is denied [E]. In an interactive session the prompt moves to the main session, and Esc denies only that call [V].

**Session-wide grants.** A file-edit approval normally "lasts until the session ends" [V]. The ask-rule prompt offered no such option. Option 2 switched the session to acceptEdits, and the next edit to `locked/b.txt` prompted again [E].

## Q2. Precedence of deny, ask, allow and hooks

| Source | Effect on an ask-rule call | Tag |
|---|---|---|
| Deny rule | Wins over everything: "deny, then ask, then allow. The first match … determines the outcome" | [V] |
| PreToolUse exit 2 / `deny` | Blocks before rules are evaluated | [V] |
| PreToolUse `allow` | Doesn't skip the ask: "a matching ask rule still prompts even when the hook returned `allow`". Lab: denied in `-p` under bypassPermissions and acceptEdits | [V/E] |
| PreToolUse `ask` | Forces a prompt, even in auto mode | [V] |
| PermissionRequest hook `allow` | **Answers the prompt.** "In modes that ask, a PermissionRequest hook can answer the prompt." Lab: in `-p` default the edit ran, in the main agent and in a background subagent. In dontAsk the hook didn't fire | [V/E] |
| `--permission-prompt-tool` / `canUseTool` | Answers the prompt. Lab: an MCP approver returned `allow` and the edit ran | [V/E] |
| Mod `tool.check` | Without managed settings or a Team/Enterprise login, "you aren't prompted when the mod approves a call that an ask rule … would prompt for". It can even approve a call a deny rule refuses | [V] |

Answer: a settings hook can approve an ask call only through **PermissionRequest**, not PreToolUse. A mod can approve one, and on this machine it can override a deny rule too. Hooks live in `.claude/settings.json`, which is itself guarded, and no mod is involved [O].

## Q3. Shell writes against `Edit(...)` ask vs deny

Each row is one `-p` run: "Run exactly this Bash command once, don't retry". The file state was checked after the run. "Ran" means the file changed.

| Command | ask, acceptEdits + `Bash` allowed | ask, bypassPermissions | deny, bypassPermissions |
|---|---|---|---|
| `sed -i '' … locked/a.txt` | ran | ran | **refused** |
| `echo changed > locked/a.txt` | ran | ran | **refused** |
| `echo changed \| tee locked/a.txt` | ran | ran | **refused** |
| `cp free/x.txt locked/a.txt` | ran | ran | **refused** |
| `mv free/x.txt locked/a.txt` | ran | ran | **refused** |
| `git checkout alt -- locked/a.txt` | ran | ran | ran |
| `perl -pi -e … locked/a.txt` | ran | ran | ran |
| `node -e "fs.writeFileSync(…)"` | ran | ran | ran |
| `echo changed > locked/c.txt` (new file) | ran | ran | **refused** |

[E] all rows. The deny refusals read "Permission to use Bash with command … has been denied."

- [V] The docs match. The redirect check "covers your `Edit` allow and deny rules, protected paths, and the working directories". The `tee` check says the same. The warning box names "Read and Edit **deny** rules" for `cat`, `sed`, `tee` and redirects. Ask rules are named nowhere.
- [E] `cp` and `mv` are refused by deny rules, which the docs don't list. The deny-rules row of the comparison table in `harness.md` lists them as misses, so that row is out of date.
- [E] In Manual mode a shell write prompts anyway, so ask and deny look alike there. That prompt comes from the mode and not from the rule: with `Bash(echo *)` allowed, `echo > locked/a.txt` was denied with "Claude Code asks before a shell command creates, changes or removes files there". With `Bash(sed *)` allowed, `sed -i` on the ask-ruled file ran.
- [E] Restoring coverage with a hook: a PreToolUse hook returning `permissionDecision: "ask"` for Bash commands that name the path stopped `sed -i` in all four lab cases. In `-p` under bypassPermissions and acceptEdits, Claude read the reason "shell write to safety-net path". Interactive auto and bypassPermissions showed a "Bash command" prompt.

## Q4. The pre-commit staged-file check after a switch to ask

What a hook can see [V/E]:
- An approved edit leaves `PreToolUse` → `PermissionRequest` → `PostToolUse` for the same session, agent and path. A refused or unanswered one has no `PostToolUse` [E, lab trace].
- No hook input says **who** answered. PermissionRequest input has no `tool_use_id`, so pairing is by session, agent and path [V]. A PermissionRequest hook, a prompt tool or a mod produces the same trace as a human [V].
- OTel `claude_code.tool_decision` has `source` = `user_temporary` / `user_permanent` vs `config` / `hook` [V]. Per the doc, a `-p` run's approvals are also tagged `user_*`, and it needs a collector (09 B3) [V].

Options [O]:

| Option | What it costs | What it leaves open |
|---|---|---|
| **Keep the check (recommended)** | You run `git commit` in your own terminal for safety-net changes. You're already at the keyboard when you approve the edit | Nothing new |
| Allow a commit when an approval marker exists | A PermissionRequest + PostToolUse logger writes `{path, blob hash}` to `.git/`. Pre-commit accepts a staged file only if its blob hash matches a marker. That's two new custom scripts | Can't tell a human from a hook, prompt tool or mod. The agent can write the marker with a node one-liner. That counts as deliberate evasion under the threat model, but it's one line |
| Drop the check | None | Shell writes the ask rule doesn't see (`git checkout`, `perl -i`, node, and `sed`/`>`/`tee`/`cp`/`mv` unless the hook from Q3 is added) reach `main` with nothing stopping them |

The check is the only layer that catches writes not visible in the command text. Switching to ask removes no reason to keep it, and adds one: without the Q3 hook it's the only shell guard left.

## Q5. agy

- [E] `docs/tasks/agy-run-5.md`: "agy reads neither `.claude/settings.json` nor `CLAUDE_CODE_CHILD_SESSION`, so neither guard applies to this run anyway." Locks are sha256 hashes plus `git diff`, checked after the run.
- [O] Ask vs deny changes nothing for agy. The staged check is keyed on a Claude Code variable, so it doesn't fire for an agy shell either. The marker option from Q4 would be Claude-only as well. agy's own guard is its permission settings (user-run, approved by hand in run 5) and the post-run hash check.

## Follow-up (c): `continue: false` from a PreToolUse hook

Lab hook: for a Bash command containing `STOPME`, it returns `{"continue": false, "stopReason": "lab stop …", "hookSpecificOutput": {"permissionDecision": "deny", …}}`. Mode bypassPermissions, `-p`.

| Where | Prompt | Result |
|---|---|---|
| Main agent, `-p` | `echo STOPME`, then `echo AFTER`, then "DONE" | The run ended after the hook. `echo AFTER` never ran. Exit code 0, `result` subtype `success`, `stop_reason: tool_use`, empty `result`. The tool result read "PreToolUse:Bash hook error: lab deny reason". The `stopReason` text appeared nowhere in the stream-json output [E] |
| Foreground subagent, `-p` | Subagent: `echo STOPME`, `echo SUBAFTER`. Parent then runs `echo MAINAFTER` | The subagent stopped after its first call. The parent got an empty report ("finished without returning any output"), ran `echo MAINAFTER` and finished with DONE [E] |
| Background subagent, `-p` | Same, `run_in_background: true` | Same. The completion notification had "no report text, only metadata". The parent carried on [E] |

Not tested: interactive main session. The docs say "Claude stops processing entirely" and `stopReason` is "shown to the user" [V].

Effect on the 09 counter design (item 6) [O]:
- In a subagent, `continue: false` is a subagent stop and not a session stop. The parent sees no reason and can start another subagent, or do the work itself. The deny text that goes with the stop has to carry the message. The counter has to be keyed on `session_id` alone as well as on `session_id + agent_id`, so a parent that relaunches the work still hits the limit.
- In `-p` the stop looks like a normal success. A wrapper or morning report can't tell it apart from the output. It needs the hook's own log (09 B2), or a check for an empty `result` with `stop_reason: tool_use`.

## Recommendation [O]

1. **Don't switch to `ask` on its own.** You'd get approval prompts for the Edit tool and lose the shell guard for `sed`, `>`, `tee`, `cp` and `mv`, in unattended runs too.
2. **Switch to `ask` together with a hook `ask` for shell writes.** Move the `Edit(...)` entries for the safety-net files from `deny` to `ask`. In `block-hook-bypass.sh`, return `permissionDecision: "ask"` for a Bash command that names a safety-net path and contains a write form (`>`, `tee`, `sed -i`, `perl -i`, `cp`, `mv`, `rm`, `ln`, `truncate`, `git checkout|restore|apply`). Keep the exit-2 blocks for hooks-path and `--no-verify` bypasses as they are. Writes only, so `cat tsconfig.json` or `git diff` doesn't prompt; in `-p` a prompt is a deny. Draft only, not tested against this repo. The mechanism was tested in the lab.
3. **Keep the pre-commit staged-file check unchanged.** Commit safety-net changes from your own terminal.
4. **Don't run coder sessions in `dontAsk`.** Its denial text invites "other tools", which is the wrong nudge for this threat.
5. **Don't add a PermissionRequest hook that returns `allow`,** and treat any mod as able to approve. Either one silently turns the ask back into an allow.
6. **The switch itself is yours to make:** `.claude/settings.json` and `.claude/hooks/` are under deny today.

### Items in 09's audit that move from "User" to "Agent"

The switch moves an item only if the "User" was there because the item edits a safety-net file. After the switch the agent drafts and applies the edit with your approval, and you commit.

| 09 # | Action | After the switch | Why |
|---|---|---|---|
| 1 | GitHub ruleset | **User** | Account setting in the GitHub UI, not a file |
| 2 | Pre-push ref check in `.githooks/pre-push` | **Agent, with approval** | Safety-net file. `.githooks` shell writes stay blocked by the hook, so it goes through the Edit tool |
| 3 | Stop + SubagentStop gate | **Agent, with approval** | `.claude/settings.json` + `.claude/hooks/` |
| 4 | Bypass hook deny text | **Agent, with approval** | `.claude/hooks/` |
| 6 | Per-session block counter | **Agent, with approval** | `.claude/hooks/` + settings. Adjust for the subagent finding above |
| 7 | pnpm fallback in the hooks | **Agent, with approval** (hook part). `~/.zshenv` stays **User** | `.githooks/*` is a safety-net file. `~/.zshenv` is your dotfile outside the repo |
| 8 | `pnpm runtime set node … -g` | **User** | Global machine state, not a guarded file. Ask vs deny doesn't change it |
| 5, 9 | Skill stop step, docs | Agent (already) | Done in this session |
| 10 | Retention / OTel | Skip | Unchanged |

## Lab setup

- Scratch git repo outside this repo: `locked/a.txt`, `locked/b.txt`, `free/x.txt`, and a branch `alt` with a changed `locked/a.txt`. Variants: `ask` on `Edit(/locked/**)`, and `deny` on the same path.
- One PreToolUse/PermissionRequest/PostToolUse hook logged every event (`hook_event_name`, `permission_mode`, `agent_id`, path or command). Env switches turned on the `allow`, `ask` and `continue: false` answers.
- `-p`: `claude -p … --setting-sources project,local --model sonnet --output-format json|stream-json`.
- `--permission-prompt-tool`: a 20-line stdio MCP server returning `{"behavior":"allow","updatedInput":…}`.
- Interactive: Python `pty` driving `claude` with a 160×50 terminal. It accepted the trust dialog, detected "Do you want to", and answered with Enter, `2`, Esc or a timed wait.
- Two runner bugs were fixed before the reported runs: `git checkout alt -- …` staged the file, so the reset restored the wrong content; and the `cp`/`mv` source had the same text as the target.
- No file in this repo was used as a lab target. No guard in this repo was changed or bypassed.

## Practitioner practice (added 2026-10-23)

Quick pass, practitioners only, not vendor harness defaults. Fetched 2026-10-23.

- [E, third party] Addy Osmani, [Agentic Code Review](https://addyosmani.com/blog/agentic-code-review/): agents "will also weaken CI … not maliciously, just gradient descent finding the cheapest path to green". He names "removed tests, skipped lint, lowered coverage thresholds" as the patterns to watch. Remedy: CI as a wall that doesn't move, read test diffs more closely than code, a human owns the merge. No file locks, CODEOWNERS or deny rules.
- [E, third party] Addy Osmani, [Agent Harness Engineering](https://addyosmani.com/blog/agent-harness-engineering/): "Hooks are what separate 'I told the agent to do X' from 'the system enforces X.'" The examples block destructive commands and require approval before pushing to `main`. Nothing on protecting the harness files.
- [E, third party] Birgitta Böckeler, [Maintainability sensors for coding agents](https://martinfowler.com/articles/sensors-for-coding-agents.html): the agent may suppress warnings and raise thresholds, which keeps them "manageable, visible and reviewable". The human reviews "the exceptions AI created". Without an explicit "absolute exception" instruction, the agent raised thresholds often. Hooks make the sensors run; they don't guard them.
- [E, third party] Simon Willison, [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/): sandbox the agent's files, secrets and network. He doesn't yet trust the agents' own sandboxing.
- Not found: Kent Beck, Armin Ronacher, Mitchell Hashimoto on this topic. The Geoffrey Huntley "Sonnet used to delete tests" quote came only from a search summary and is not on the fetched page. Unverified.
- [O] The pattern is "the agent may change it, a human reads the diff, the gates stay strict", and it assumes a PR. Under trunk, the review moments are the `ask` prompt and the pre-commit staged check. Nobody published locks lint, tsconfig or test config against the agent. Vendors (Codex, Cursor) hard-protect only the agent's own config and git internals.

## Open: fire-and-forget runs (unsolved, resume 2026-10-24)

The user's concern: start a spec-driven run, walk away, and the agent stalls on an approval nobody answers.

- [E, Q1] Interactive: an `ask` prompt waits with no time limit. The run stalls; no file is changed. Under `deny` the call is refused at once and the agent keeps going or stops per the `implement-spec` STOP step.
- [E, Q1] `-p`: `ask` is an immediate deny, the same as `deny`, subagents included.
- [O] Candidate split: unattended runs always via `-p` (the `unattended-run` skill), `ask` for interactive sessions.
- To settle: how fire-and-forget runs are started today (an open interactive tab vs `-p`); whether the guard's own files (`.claude/settings.json`, `.claude/hooks/`, `.githooks/`) stay on `deny` while the config files move to `ask`.
- Not checked: approving an interactive prompt remotely (Remote Control or phone).
