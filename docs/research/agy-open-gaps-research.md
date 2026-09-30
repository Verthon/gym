# Research: open gaps left by `agy-findings-research.md`

Created: 2026-09-28
Input: the "No good source found" items in `agy-findings-research.md`, plus the open decision in `agy-run-4.md`.
Tags as in the earlier doc: **[E]** evidence, **[V]** vendor guidance, **[O]** opinion (ours says "ours").
Sources already cited in `agy-findings-research.md` are not repeated unless a new passage from them is used.

## Bottom line

- **The biggest new fact is that agy has hooks.** `.agents/hooks.json` at the workspace root supports `PreToolUse` (can `deny` with a `reason`), `PreInvocation`/`PostInvocation` (can inject messages) and `Stop`. That turns three of our prompt-side rules (stop-after-3, no `git` after green, conventions that only a failed check reveals) into things the harness enforces. Nobody documents whether hooks fire under `agy -p`, so one probe run has to settle that first.
- **Practitioners don't depend on prompt rules for the failure modes we hit.** Every harness in a 2026 source-code study of eleven coding agents enforces loop limits in code, not in the prompt. The one published comparison measures 88.3% compliance for enforced constraints against 67.0% for prompt-only.
- **Rule placement (gap 1), single-example generalisation (gap 3) and code vs rule (gap 4)** still have no direct study. The new indirect evidence all points the same way: prohibitions fade as the context grows, Gemini models follow constraints placed later in a prompt better, and prompts don't stop agents from carrying over patterns already in the code.
- **Run 4 repeats: 3 + 1.** With n ≤ 3, a smoke arm can only catch outright breakage, and the token question has already been answered offline.

---

## 1. Rule at the workflow step vs in a separate constraints section

**Still no direct agentic study.** Three indirect results line up with run 3:

- [E] Gamage, *Omission constraints decay while commission constraints persist in long-context LLM agents* ([arXiv:2604.20911](https://arxiv.org/html/2604.20911), 2026-04-22):
  - "Don't do X" (omission) rules decay with conversation depth. Mistral Large 3 falls from 73% at turn 5 to 20% at turn 25, and Qwen 3.5 from 60% to 10%.
  - "Always produce X" (commission) rules stay at 100%.
  - Gemini 2.5 Flash showed the same dilution effect in the token-matched control arm.
  - Proposed mitigation: re-inject the omission rule every k turns. This comes from the decay curves and wasn't tested live.
- [E] Purpura et al. (Capital One), *Deconstructing Instruction-Following* ([arXiv:2601.18554](https://arxiv.org/pdf/2601.18554), 2026-01-26): most models show a primacy effect in constraint lists, but "Mixtral-8x-7b, Gemini and Claude models demonstrate a recency effect". This is single-turn, not agentic.
- [E] OctoBench ([arXiv:2601.10343](https://arxiv.org/html/2601.10343)), Finding 6: "Instruction following capability generally exhibits a negative correlation with interaction length." Proximity within a message wasn't tested.

**Applied to us (ours, [O]).**

- "Don't verify with `git`" is an omission rule, and it was needed at step ~45 of the run. That is the worst case in Gamage's data.
- Moving it into step 5 did two things at once:
  1. it recast the rule as a commission ("write the report immediately");
  2. it placed the rule nearer the end of what the model reads.

  Both of these are favoured by the evidence above.
- **Rule of thumb:** phrase step rules as the next thing to do, not as a prohibition.
- **Harness-side equivalent** (see gap 7):
  - a `PreToolUse` hook that denies `run_command` matching `git|find|ls` once the transcript shows a green `pnpm check`;
  - or a `PreInvocation` hook that injects an `ephemeralMessage` reminder at that point.

## 2. Conventions that only a failed check reveals

**Named practice found.**

- [O, named practitioner] Mitchell Hashimoto, [*My AI Adoption Journey*](https://mitchellh.com/writing/my-ai-adoption-journey) (2026-02-05), "Engineer the Harness":
  - "anytime you find an agent makes a mistake, you take the time to engineer a solution such that the agent never makes that mistake again."
  - There are two forms. The first is AGENTS.md lines ("Each line in that file is based on a bad agent behavior, and it almost completely resolved them all"). The second is programmed tools the agent is told about.
- [V] Claude Code [best practices](https://code.claude.com/docs/en/best-practices):
  - "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."
  - On a bloated CLAUDE.md: "If Claude already does something correctly without the instruction, delete it or convert it to a hook."
- [E] Sharma, *ContextCov* ([arXiv:2603.00822](https://arxiv.org/abs/2603.00822), 2026). ContextCov compiles AGENTS.md rules into AST checks, shell shims and architectural validators.
  - SWE-bench Lite, 300 tasks: **88.3%** constraint compliance, against **67.0%** prompt-only and **50.3%** reflection-based.
  - Feedback cost is 3.4× lower.
  - Cause of violations it names: "context window saturation or conflicting local context".
- [E, weak] *Self-Improving AI Coding Agents Through Accumulated Behavioral Rules* ([arXiv:2607.13091](https://arxiv.org/html/2607.13091), 2026):
  - Rules are derived from accepted review comments and kept in a version-controlled markdown file.
  - Result: zero recurrences across 9 error classes and 74 exposures in four weeks.
  - The rules' specificity ratio rose from 0.60 to 0.78 over time, which supports our finding 3.
  - It was a single deployment with no control group.

**Applied to us (ours, [O]).** The order of preference, from strongest:

1. **Make it disappear.** oxlint ships [`typescript/consistent-type-imports`](https://oxc.rs/docs/guide/usage/linter/rules/typescript/consistent-type-imports) with an autofix. `oxlint.config.mts` doesn't enable it today. Enabling it and running `oxlint --fix` through an agy `PostToolUse` hook after file writes fixes the `import type` error without the agent ever seeing it. agy's docs name "post-generation formatters" as a hook use case. Still to verify:
   - that this rule flags every case where `verbatimModuleSyntax` raises TS1484;
   - that fixing files under the agent doesn't confuse its later edits.
2. **Fail early with the fix in the message.** A lint error whose text says "use `import type`" costs one red check instead of eight steps.
3. **A doc line** in a "gotchas" list at the step where imports are written. This is the weakest option, per ContextCov's 67%.

## 3. Generalising a rule from a single example

**No good source found.** No study measures how an agent generalises from one example inside a skill. The only new signal is indirect: the rise in rule specificity in arXiv:2607.13091 (gap 2). The earlier doc's vendor guidance still stands: 3–5 varied examples from Anthropic, and Google's warning about overfitting to examples.

## 4. Existing code vs written rule

**Still no direct measurement.** Three new signals:

- [E] OctoBench-Conflict (Table 4). When a project doc (AGENTS.md) conflicts with the system prompt, models follow the doc only **5.6–38.9%** of the time. When it conflicts with the user query, they follow it **4.3–33.3%** of the time. Repository code isn't one of the sources tested. The project doc is the lowest-priority source that was tested.
- [E] Orlanski et al., *SlopCodeBench* ([arXiv:2603.24755](https://arxiv.org/html/2603.24755v1), 2026-03), 11 models, iterative tasks:
  - Anti-slop prompts reduced initial verbosity by 33–35%, "the degradation lines for Anti-Slop and Plan-First track the baseline slope almost exactly".
  - "A bad architectural choice at checkpoint i becomes the foundation for checkpoint i+1."
  - So prompts set the starting point, but existing code drives what comes next.
- [V] Claude Code best practices tells users to "Reference existing patterns … HotDogWidget.php is a good example. follow the pattern". Vendors treat code as the strongest pattern signal, which only helps if the reference code is correct.

**Applied to us (ours, [O]).** This strengthens `agy-findings-research.md` → Ranked changes items 6–7. Make `PersonId.mts` conform to `value-object.md`, or give the spec its API so the agent has no reason to open it. Adding more "don't copy" wording works against the evidence.

## 5. Checklist self-report fields vs free text

- [E] OpenAI, *Training LLMs for Honesty via Confessions* ([arXiv:2512.08093](https://arxiv.org/abs/2512.08093), 2025-12):
  - **Format.** The confession is a structured report: it enumerates every explicit and implicit instruction, gives a compliance verdict per item with evidence, and lists uncertainties. This is the "for each X, state Y" shape.
  - **Results.** After training, the model confesses at least half the time when it actually misbehaved, in 11 of 12 evaluations (mean 74.3%). GPT-5-Thinking was already fairly honest without training.
  - **Limitation that matters for us:** false negatives "predominantly occur when non-compliance stems from honest mistakes". A model can't report a conflict it didn't notice.
- [E] Barbaste et al., *Harness Engineering … Eleven Systems* ([arXiv:2609.00006](https://arxiv.org/pdf/2609.00006), 2026-07):
  - Claude Code's prompt forbids false claims that tests pass. Only Hermes mechanises that demand, with a verify-on-stop guard: it turns a final answer into a continuation when code changed without fresh verification evidence.
  - The paper's comment on a prompt claiming enforcement that doesn't exist: "prompt text is a behavioral wish, not a mechanism."

**Applied to us (ours, [O]).** Our "Doc/code conflicts found: none" is an honest-mistake case: the coder most likely never compared the file against the doc. A per-file enumerated field (path, quoted line, matches Y/N) helps only by forcing that comparison to happen. It is not a reliable detector. Keep conflict detection on the evaluator side (item 3 in the earlier doc). Treat the report field as a forcing function, not as a measurement.

## 6. Stop-after-N rules

**Practitioners enforce them in the harness.** From Barbaste et al. (arXiv:2609.00006), per system:

| Harness | Mechanism | Threshold |
|---|---|---|
| Gemini CLI | `LoopDetectionService`, hashes each call; LLM self-check after 30 turns; turn cap | aborts on 5 identical tool calls or 10 identical content chunks; turn cap 100 |
| OpenCode | `doom_loop` permission ([docs](https://opencode.ai/docs/permissions/)) | 3 consecutive byte-identical calls → ask the user |
| OpenHands | `StuckDetector`, 5 scenarios including "repeating actions with errors" | configurable, on by default |
| Hermes | hashes tool + args | warns after 2 identical failures, halts after 8 (halt off by default) |
| Aider | reflection loop on lint/test failure | max 3 reflections |
| mini-SWE-agent | cap on consecutive malformed responses | aborts after N |

- None of them rely on a prompt-level "stop after 3". Our rule has never triggered (finding 8), so whether gemini-3.8-flash obeys it is still unknown.
- **Caveat (ours, [O]).** Identical-call detectors wouldn't have caught run 1. Its ~20 `pnpm check` calls had edits in between, so the calls weren't consecutive-identical.
- **What would catch it:** a `PreToolUse` hook that counts `pnpm check` calls in `transcriptPath` and returns `{"decision":"deny","reason":"3 failed checks: write the report now"}` on the fourth. That is Aider's max-3 in agy form.
- The broken-fixture run (earlier item 12) then tests a mechanism instead of a wish.

## 7. agy: project permissions, temperature, seed

[V] Antigravity docs:

- **Project permission file.** Still undocumented. [Permissions](https://antigravity.google/docs/permissions/) and [Settings](https://antigravity.google/docs/settings/) give only `~/.gemini/antigravity-cli/settings.json` as a path, plus UI-only per-project overrides.
- **Hooks are workspace-scoped** ([Hooks](https://antigravity.google/docs/hooks/)). Where the file lives:
  - workspace: `.agents/hooks.json`;
  - global: `~/.gemini/config/hooks.json` or `settings.json`;
  - plugins can also ship hooks.

  What each event can do:

  | Event | Output |
  |---|---|
  | `PreToolUse` | `decision`: `allow`, `deny`, `ask`, `force_ask` or `deny_unless_prior_grant`; optional `reason` |
  | `PreInvocation` / `PostInvocation` | `injectSteps`, which can be a `toolCall`, `userMessage` or `ephemeralMessage` |
  | `PostInvocation` | `terminationBehavior` |
  | `Stop` | `decision: "continue"` re-enters the loop |

  Every hook gets `transcriptPath` on stdin, and the default timeout is 30 s.
  - (ours, [O]) A workspace `PreToolUse` hook that denies everything outside our allow-list is a de facto project-scoped permission file. The repo already has `.agents/skills/`.
- **Headless.** [Headless mode](https://antigravity.google/docs/cli/headless/): "A tool that requires approval it cannot obtain is soft-denied: the run continues, exits `0`, and prints a notice to `stderr`." Our "any `denied_actions` entry voids the run" rule is therefore right, and exit code 0 proves nothing. **Whether hooks fire under `-p` isn't documented.** Probe it with a hook that only appends to a log file.
- **Temperature, seed, max turns.** The [CLI reference](https://antigravity.google/docs/cli/reference/) settings list has no temperature, seed, sampling, max-turns or budget key. The earlier conclusion stands: variance has to be handled by repeats, not by pinning.

## 8. Repeats per arm when one arm is a smoke test

- [E] Bhardwaj, *AgentAssay* ([arXiv:2603.02601](https://arxiv.org/pdf/2603.02601), 2026-03):
  - It uses three-valued verdicts (Pass / Fail / **Inconclusive**) with Wilson intervals, plus SPRT to stop early.
  - Its own example: 45/50 passes against a 0.85 threshold is still Inconclusive at n = 50, and stays Inconclusive at n = 100.
- Arithmetic (ours, [O]): Wilson 95% lower bound when every run follows the rule:

  | Passes | Lower bound |
  |---|---|
  | 1/1 | 0.21 |
  | 2/2 | 0.34 |
  | 3/3 | 0.44 |

  Going from 1 to 2 CI=1 runs raises the pass^k floor by 0.13, and neither can separate a 90% rule-follower from a 50% one. At this n the only thing a smoke arm can detect is breakage: a crash, `allowOnly` failing, a denied action.
- **Recommendation: 3 + 1.**
  - The CI=1 token question is already answered offline (`agy-run-4.md` → Offline CI=1 measurement).
  - A second or third CI=1 run buys almost nothing.
  - Spend the saved runs on the gap-7 hook probe and the gap-6 broken-fixture run. Those test mechanisms that haven't been exercised yet.
  - Record every rule check as Pass / Fail / Inconclusive, not as a bare rate.

---

## Proposed order of changes

1. **Hook probe** (gap 7): one `agy -p` run with a logging-only `PreToolUse` hook in `.agents/hooks.json`. Everything below except step 2 needs it.
2. **Run 4 as 3 + 1** (gap 8). It doesn't depend on hooks.
3. **Stop-after-3 as a hook**, tested with a broken fixture (gap 6).
4. **Autofix for `import type`**: enable the oxlint rule and run `--fix` in a `PostToolUse` hook (gap 2). This changes check counts, so it needs a new baseline.
5. **No-`git`-after-green as a `PreToolUse` deny** (gap 1). The prompt rule stays in step 5 as well.
6. **Fix the reference files, and list the `PersonId` API in the spec** (gap 4).
