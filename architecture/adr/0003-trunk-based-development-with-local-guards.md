# 0003. Use trunk-based development, with all agent guards before the commit

- Date: 2026-10-18
- Status: Proposed

## 1. Circumstances

### Problem
Coding agents write and commit most of the code in this repo.
The repo needs guards that stop an agent from getting wrong code onto `main`.
A guard can run in two places: on the developer's machine before the commit, or on the server in a pull request.
The workflow decides which of these places exists.

### Constraints
- Team knowledge: one developer. No second person reviews changes.
- Current architecture: git hooks run lint and type-check before each commit, and unit tests before each push.
- Current architecture: a Claude Code hook blocks the usual ways an agent skips or redirects the git hooks. A bypass hidden from the command text, such as a variable, `sh -c` or a script, is not blocked.
- Current architecture: the repo is public on a personal GitHub account. Branch rules that block force pushes and branch deletion are available without pull requests. Rules that block pushes by file path are not available for this repo.
- Current architecture: CI runs the same checks after each push to `main`.

## 2. Intention

### Quality attributes
- Agent guardrails: a weaker coder model cannot get wrong code past the guards.

### Measure
- Every guard against a known agent mistake blocks the change before the commit reaches `main`. No guard depends on pull request review.
- An agent edit to a safety-net file fails before it reaches `main`. An edit through the agent's edit tools or a recognized shell write (`sed`, `tee`, a redirect, `cp`, `mv`) fails at the edit. Any other shell write, such as `git checkout` or a script, fails at the commit, through the check on staged safety-net files.
- Human override: the human changes or commits safety-net files outside Claude Code, from their own editor or terminal.
- Safety-net files are the git hooks, the Claude Code settings and hooks, the CI workflow, the repo scripts, the lint, type-check, architecture-check, unused-code, test and mutation-test configs, the pnpm workspace config, and the `scripts` field of `package.json`.
- Residual risk, accepted: a hooks-path override hidden from the command text skips the git hooks. CI finds the result after the push.

## 3. Decision

### Chosen
Commits go directly to `main`. There are no pull requests and no long-lived branches.
All guards run on the developer's machine before the commit: git hooks, Claude Code settings and Claude Code hooks.
CI repeats the checks after the push. It reports problems but does not block them.

**Why:** With one developer, a pull request adds a review step with no second reviewer. Trunk-based development assumes a second check before code reaches trunk. In this repo the local guards are that second check.

### Rejected alternatives
#### Pull requests with branch protection
**Why rejected:** A single developer who reviews their own agent's pull requests adds overhead with no second reviewer.

## 4. Consequences

### Positive
- Agent guardrails: the agent meets every guard before the commit, at the earliest point it can act on the failure.

### Trade-offs
- Server-side guards give no protection for content: code owners, required reviews, and CI that reads its rules from `main`. A push changes `main` directly. Rules that block pushes by file path exist only for private repos on paid plans. Making the repo private on such a plan is a reason to revisit this.
- Server-side branch rules still apply to history: blocking force pushes and deletion of `main` needs no pull request and works with direct pushes.
- A change that passes the local guards is on `main` at once. CI finds problems only after the push.
- The local guards must also block shell commands, not only the agent's edit tools. An agent can change a file with `sed` or a heredoc.
- The guards must protect their own config files. Otherwise an agent can make a failing check pass by editing the rule.

## 5. Evidence
- DORA, *Trunk-based development* capability: teams with three or fewer active branches, merges to trunk at least daily, and no code freezes have higher delivery performance. Data from 2016 and 2017, from human teams.
- DORA, *Trunk-based development* capability: branches last no more than a few hours. Review comes from pair programming or a synchronous review before the commit.
- DORA, *Balancing AI tensions* (Baolin, Harvey, 2026-03-10): "Enforcing the discipline of working in small batches is a critical countermeasure to the risks of AI-assisted development."
- DORA, *2022 Accelerate State of DevOps Report*: people with less experience report less positive results from trunk-based development.
- No primary source found that compares trunk-based development and pull requests for coding agents.
