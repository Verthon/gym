# Research: agy coder findings 1–8

Created: 2026-09-28
Input: `docs/tasks/agy-findings.md`, `docs/tasks/agy-run-2.md`, `docs/tasks/agy-run-3.md`.
Order: finding 8 first, because it sets how far findings 1–7 can be trusted, then 1 → 7.

Claim tags:

- **[E]** evidence: a study or a measurement.
- **[V]** vendor guidance: official docs or an engineering blog from the tool or model vendor.
- **[O]** opinion: a secondary source's view, or our own inference. Where it's ours, it says "ours".

Most of the evidence comes from arXiv preprints. Unless a venue is named, it hasn't been peer reviewed. None of the studies used `gemini-3.8-flash` or agy, so each one is a transfer from another model or harness.

---

## 8. The runs aren't clean comparisons yet

### What the sources say

- **Run-to-run variance at fixed settings is large.**
  - [E] Bjarnason, Silva, Monperrus, *On Randomness in Agentic Evals* ([arXiv:2602.07150](https://arxiv.org/abs/2602.07150), 2026) collected 60,000 SWE-bench Verified trajectories. Single-run pass@1 moved by 2.2–6.0 pp depending on which run was picked, and the SD was above 1.5 pp even at temperature 0. "Trajectories diverge early, often within the first few percent of tokens." Their recommendation is to estimate from several independent runs per task and to size the number of runs with a power analysis.
  - [E] Bai et al., *How Do AI Agents Spend Your Money?* ([arXiv:2604.22750](https://arxiv.org/abs/2604.22750), 2026): runs on the same task "can differ by up to 30x in total tokens", and input tokens, not output tokens, drive the cost.
  - [E] Smékal, *Can your AI agent be cheaper?* ([arXiv:2608.25399](https://arxiv.org/html/2608.25399v1), 2026): 2,700 runs, 15 repeats per condition, Kimi K3. With identical specs, repeats have a median geometric SD of **×1.34** in token spend, and "prompt variation had no measurable effect on variance."
- **Temperature can't be pinned.** [V] Google recommends keeping Gemini 3.x at the default temperature of 1.0 and warns that changing it "can cause unexpected behavior" ([Prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies), [Gemini 3 guide](https://ai.google.dev/gemini-api/docs/gemini-3)). The [agy CLI reference](https://antigravity.google/docs/cli/reference/) documents no temperature or seed flag. No good source found on whether agy exposes either.
- **What to control.**
  - [V] Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): "Each trial should be 'isolated' by starting from a clean environment. Unnecessary shared state between runs (leftover files, cached data, resource exhaustion) can cause correlated failures." It also says to read transcripts, and that "20-50 simple tasks drawn from real failures is a great start."
  - [V] Anthropic, [Quantifying infrastructure noise](https://www.anthropic.com/engineering/infrastructure-noise) (2026-02-05): treat the environment configuration "as a first-class experimental variable, documented and controlled with the same rigor as prompt format or sampling temperature."
  - [E] [SWE-bench harness](https://www.swebench.com/SWE-bench/reference/harness/): each instance is evaluated in its own Docker image, so every run starts from the same environment.
- **How to analyse.** [V/E] Miller (Anthropic), [A statistical approach to model evals](https://www.anthropic.com/research/statistical-approach-to-model-evals) ([arXiv:2411.00640](https://arxiv.org/abs/2411.00640)):
  - report standard errors;
  - resample each question several times and average;
  - compare configurations with **paired differences**;
  - run a power analysis to choose the sample size.
- **pass@k vs pass^k.** [V] The Anthropic evals post defines pass^k as "the probability that *all k* trials succeed". That is the right metric for rule compliance: we care that the coder *never* runs `git` after green, not that it avoids it once.
- **Global rules can't be switched off per run.** [V] [Antigravity Rules docs](https://antigravity.google/docs/rules/): `~/.gemini/AGENTS.md` is a global rule, and `always_on` rules are injected "into the system prompt on every turn". The docs describe no way to turn global rules off per workspace or per run. The only way to remove the confound is to move the file.

### Applied to our runs (arithmetic ours, [O])

These numbers use Smékal's σ = ln 1.34 ≈ 0.29. That σ was measured on a different model and different tasks, so treat it as an assumption until we measure our own.

| Comparison | Token ratio | ln ratio | z (single run vs single run) | Reading |
|---|---|---|---|---|
| Run 2 → 3 | 260k / 174k = 1.49 | 0.40 | ≈ 0.97 | **Indistinguishable from noise** |
| Run 1 → 2 | 518k / 260k = 1.99 | 0.69 | ≈ 1.66 | Weak, and confounded by the broken locked test |

Repeats per arm needed to detect a token ratio *r* (two-sided α = 0.05, power 0.8, same σ): n ≈ 1.34 / (ln r)².

| Effect to detect | Runs per arm |
|---|---|
| ×2.0 | 3 |
| ×1.5 | 9 |
| ×1.3 | 20 |
| ×1.2 | 41 |

Binary behaviours such as "`git` after green" or "copied `toString`" are worse. With 0 violations in n runs, the 95% upper bound on the violation rate is 1 − 0.05^(1/n):

| Runs without a violation | Violation rate still possible (95%) |
|---|---|
| 1 | up to 95% |
| 3 | up to 63% |
| 5 | up to 45% |
| 10 | up to 26% |

Run 3's "fully obeyed" is **one** observation.

### Confirms or contradicts our runs

- **Contradicts our reading** that run 3 is "a third cheaper" because of the skill edits. At n = 1, a ×1.49 difference sits inside the expected spread for identical configs. Run 3 also bundled five skill edits, so an effect can't be attributed to any one of them.
- **Confirms** the caution in `agy-findings.md` §8. The global `AGENTS.md`, the interactive vitest output and several edits per run are exactly the uncontrolled environment variables Anthropic's two posts warn about.
- **Qualifies the step counts.** The step counts (126 / 52 / 45) and check counts (20 / 1 / 2) are more robust than the token totals only where the mechanism is visible in the transcript, such as run 1's 20 retries on the unfixable lint error. A mechanism explanation is qualitative evidence. It isn't a measured effect size.

### Implications

- **Run 4 design.**
  - A single CI=1 run can only detect an effect of roughly ×2 or more. If the expected effect is smaller, one isolated run will come back "no difference" whether or not CI=1 helps.
  - Replicate instead: 3–5 runs of the unchanged run-3 configuration give us our own σ, then 3–5 runs of the CI=1 arm. Better still, measure the CI=1 effect without the agent (see the ranked list).
- **Evaluation.**
  - Script the metrics from `transcript_full.jsonl`: tokens (uncached input shown separately), steps, `pnpm check` count, calls after green, files read outside the skill's table.
  - Report the median and range across repeats, and report pass^k for the rule-compliance checks.
- **Isolation.** Archive and clear the agy `brain/`, `implicit/` and conversation state before each repeat, as run 2 did, so repeats don't share state.

---

## 1. A rule works when it sits at the step where it applies

### What the sources say

- [E] Liu et al., *Lost in the Middle* ([arXiv:2307.03172](https://arxiv.org/abs/2307.03172), TACL 2024): accuracy drops when the *relevant information* sits in the middle of a long context. The tasks were multi-document QA and key-value retrieval. **Instruction following was not tested**, so this paper doesn't answer our question directly.
- [V] Anthropic, [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices): put long documents at the top and "queries at the end can improve response quality by up to 30 percent in tests". The same page says "Tell Claude what to do instead of what not to do."
- [V] Google gives two placement rules. For long context, "Place your specific instructions or questions at the very *end* of the prompt." For critical rules, "Place essential behavioral constraints … in the System Instruction or at the very beginning of the user prompt" ([Prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)). The two can be read as conflicting. Neither mentions workflow steps.
- [E] Jaroslawicz et al., *How Many Instructions Can LLMs Follow at Once?* ([arXiv:2507.11538](https://arxiv.org/abs/2507.11538), 2025): compliance falls as instruction count grows, with a "bias towards earlier instructions" (**primacy**, not recency). The task was 500 keyword-inclusion instructions, not agentic.
- [E] Zeng et al., *Order Matters* ([arXiv:2502.17204](https://arxiv.org/abs/2502.17204), 2025): in single-turn prompts with several constraints, models do better when constraints are ordered hard-to-easy. Agentic settings weren't tested.
- [E] McMillan, *Instruction Adherence in Coding Agent Configuration Files* ([arXiv:2605.10039](https://arxiv.org/abs/2605.10039), 2026):
  - 1,650 Claude Code sessions on two TypeScript codebases.
  - Instruction **position** (beginning / middle / end), file size and file architecture had **no detectable effect**. Size and conflict nulls are supported by Bayes factors of 0.05–0.10.
  - The dominant effect was **within-session degradation**: each additional function generated came with about 5.6% lower odds of compliance (OR 0.944).
- [E] Huang et al., *Harness-IF* ([arXiv:2608.11727](https://arxiv.org/abs/2608.11727), 2026): system prompts, project files and user instructions were followed ahead of tool and skill *descriptions*.
- [V] Anthropic, [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (2025-09-29), on context rot: "as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases."
- [V] Claude Code, [Best practices](https://code.claude.com/docs/en/best-practices): "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost."
- **No good source found** that directly compares a rule attached to a workflow step with the same rule in a separate constraints section, in an agentic setting.

### Confirms or contradicts our runs

- **Contradicts the placement explanation, partly.** The only controlled test of position in coding-agent config files (McMillan) found none. That was Claude Code with `CLAUDE.md`, not Gemini with a skill injected into the user turn, so it doesn't refute us. But the "position" story isn't supported by evidence.
- **Our change bundled three things** between runs 2 and 3:
  1. position (a separate section → step 5);
  2. phrasing (a prohibition → a positive action, "write the report immediately"), which both vendors recommend;
  3. timing (the rule appears at the moment the model decides what to do after green).

  The run can't separate them. Add n = 1 (finding 8) and "fully obeyed" is a hypothesis, not a result.
- **Consistent with within-session degradation.** McMillan's per-step decline in compliance fits "rules that apply late in a run are the fragile ones". It suggests *when* a rule is needed matters more than *where* it's written. That supports putting the rule at the step, but for a different reason than "lost in the middle".
- **Doesn't apply cleanly.** Harness-IF's ranking treats skill *descriptions* as a low-precedence surface. In agy the whole skill is injected into the user turn (`agy-run-2.md`, pre-run changes), so the body is a user instruction, not a description.

### Implications

- **`/implement-spec`.**
  - Keep step-attached rules, and phrase them as the action to take ("write the report now"), not only as a prohibition.
  - A rule that has to hold *every* time is better enforced by the harness than by prose. Claude Code docs: hooks "are deterministic and guarantee the action happens", unlike advisory instructions ([V], [Best practices](https://code.claude.com/docs/en/best-practices)).
  - agy's permission deny list is the equivalent. Denying `git` after green isn't expressible, but the evaluator can count those calls deterministically.
- **Run 4.** If placement is to be tested, change only position and keep the wording identical, with ≥ 3 repeats per arm. Otherwise record the finding as "rewording + moving worked once".

---

## 2. Cost comes from failure loops, not from the model

### What the sources say

- **Input re-sending dominates cost.**
  - [E] Bai et al. ([arXiv:2604.22750](https://arxiv.org/abs/2604.22750)): input tokens are the main cost driver in agentic coding, and more tokens didn't mean better accuracy.
  - [V] Gemini implicit caching is on by default for Gemini 2.5+ and 3.x Flash, from 4,096 tokens for 3.x. Google advises putting "large and common contents at the beginning of your prompt" ([Context caching](https://ai.google.dev/gemini-api/docs/caching)).
  - [V] On the Claude side, cache reads cost 0.1× base input on most models ([Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
  - The total-token figure we report therefore overstates cost if much of it was cached.
- **Spec detail lowers cost.** [E] Smékal ([arXiv:2608.25399](https://arxiv.org/html/2608.25399v1)): stripping a full spec down to a minimal user story raised token spend by 29.7% on average (13–115% by task) but didn't change variance.
- **Pre-flight setup.** [V] GitHub, [Customize the agent environment](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment): `copilot-setup-steps.yml` installs dependencies deterministically before the agent starts, because otherwise Copilot discovers them "via a process of trial and error, [which] can be slow and unreliable, given the non-deterministic nature of LLMs." This is the closest official "pre-flight" practice we found. It covers tools and dependencies, not code conventions.
- **Where conventions belong.**
  - [V] Claude Code [Best practices](https://code.claude.com/docs/en/best-practices): include "Code style rules that differ from defaults", "Common gotchas or non-obvious behaviors" and "Developer environment quirks". Test each line with "Would removing this cause Claude to make mistakes?"
  - [V] GitHub [task best practices](https://docs.github.com/en/copilot/how-tos/agents/copilot-coding-agent/best-practices-for-using-copilot-to-work-on-tasks): put build and test commands and conventions in custom instructions.
  - [V] Anthropic [Skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): "Run validator → fix errors → repeat", and make validation scripts' error messages specific enough to act on.
- **Context files cost money.** [E] Gloaguen et al., *Evaluating AGENTS.md* ([arXiv:2602.11988](https://arxiv.org/abs/2602.11988), 2026): context files "do not generally improve task success rates, while increasing inference cost by over 20%". Instructions in them "are well followed". They are useful "for specifying non-standard coding practices". Repository overviews didn't help.
- **Probe runs.** [E] Shepard & Albrecht, *Probe-and-Refine Tuning* ([arXiv:2606.20512](https://arxiv.org/abs/2606.20512), 2026): refining guidance from failures seen in probe runs raised resolution from 25.5% (no guidance) to 33.0%. The gain came mainly from reaching the right file, not from better patches.
- **No good source found** for "conventions that only a failed check reveals" as a named practice. The closest are Claude Code's "common gotchas" row and probe-and-refine.

### Confirms or contradicts our runs

- **Confirms** that input tokens and step count drive cost (Bai), and that one unfixable check can dominate a run.
- **Qualifies** "not from the model". With up to 30× variance on identical tasks (Bai), a single run can't separate a failure loop from ordinary variance, except where the transcript shows the loop, as in run 1. Run 3's 8 of 45 steps on type-only imports is a visible mechanism, so it's credible as a cause but not as an effect size.
- **Gloaguen's +20% cost** matches the global `~/.gemini/AGENTS.md` confound. It adds tokens on every turn and doesn't touch this task.

### Implications

- **Documentation.** `verbatimModuleSyntax` → `import type` is exactly a "non-standard practice" in Gloaguen's sense and a "common gotcha" in Anthropic's. It belongs in repo conventions (`AGENTS.md` / the skill's conventions line), not only in a run log.
- **Pre-flight, before handing off.**
  - Confirm the locked files lint and type-check with a stub implementation. Run 1's broken test would have been caught.
  - Confirm the check runs non-interactively.
  - Record the harness's cached-token count next to the total.
- **Reporting.** Report uncached input tokens separately. If most of the 174k was cached, the cost gap between runs is smaller than the totals suggest.

---

## 3. Precise rules with an example beat general ones

### What the sources say

- [V] Anthropic, [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices): "Examples are one of the most reliable ways to steer Claude's output format, tone, and structure." Make them "Relevant", "Diverse: Cover edge cases and vary enough that Claude doesn't pick up unintended patterns", and "Include 3–5 examples." Separately: "Providing context or motivation behind your instructions … Claude is smart enough to generalize from the explanation."
- [V] Google, [Prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies): "always include few-shot examples", use "specific and varied examples", and "if you include too many examples, the model may start to overfit the response to the examples."
- [V] Anthropic, [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): curate "a set of diverse, canonical examples" rather than "a laundry list of edge cases". Prompts should be "specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics."
- [V] Anthropic, [Skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): "Examples convey the desired style and level of detail … more clearly than descriptions alone". Match freedom to fragility: low freedom (exact instructions) where "operations are fragile and error-prone".
- [E] Si et al., *Measuring Inductive Biases of ICL with Underspecified Demonstrations* ([arXiv:2305.13299](https://arxiv.org/abs/2305.13299), ACL 2023): when examples fit more than one rule, models fall back on their own feature preferences, and "it can be difficult to overcome strong prior biases" even with instructions.
- [E] Ali et al., *Mitigating Copy Bias in In-Context Learning* ([arXiv:2410.01288](https://arxiv.org/abs/2410.01288), 2024): models sometimes copy answers from examples instead of learning the pattern.
- **No good source found** for a study of how well an *agent* generalises a rule from a *single* example in a skill or system prompt. All the evidence above is single-turn ICL on classification or format tasks.

### Confirms or contradicts our runs

- **Confirms the direction.** Both vendors say concrete examples steer better than abstract rules.
- **Contradicts the "one example" part.** Both vendors ask for *several diverse* examples precisely so the model doesn't learn the wrong pattern. Our edits each add one example (`success(locker.assign(...))`, "more out-of-range integers").
- **Generalisation wasn't tested.** `agy-run-3.md` says edit 2 "held vacuously", because no test called an entity method in setup. The run didn't test whether the example generalises, only that nothing contradicted it.
- **The edit-3 success fits both readings.** "More out-of-range integers" names the exact failure from run 2, so compliance fits generalisation and a narrow match equally well. Si et al.'s result predicts the narrow reading is the risk.

### Implications

- **Skill (`unit-tests.md`).** For each rule, state the principle with its reason plus 2–3 *varied* examples, e.g. an entity method, a factory, a repository call for "unwrap every `Result` in setup". Anthropic: "generalize from the explanation".
- **Evaluation.** A rule counts as tested only when the run gave the coder a chance to break it. Log "not exercised" separately from "held".
- **Skill authoring.** Per Anthropic's freedom guidance, rules the lint or type check can enforce (e.g. `verbatimModuleSyntax`) need the one-line fact, not an example.

---

## 4. A single example is where it gets its patterns

### What the sources say

- **Vendors recommend pointing agents at existing code:**
  - [V] Claude Code, [Best practices](https://code.claude.com/docs/en/best-practices): "Reference existing patterns … `HotDogWidget.php` is a good example. follow the pattern."
  - [V] Cursor, [Rules](https://cursor.com/docs/context/rules): "Provide concrete examples or referenced files" and "Reference files instead of copying their contents."
  - [V] Antigravity, [Skills](https://antigravity.google/docs/skills/): skills may bundle an `examples/` folder of "reference implementations".
- **The same vendors warn about what gets copied:**
  - [V] Anthropic, [Skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): "Make clear in your instructions whether Claude should: Execute the script … Read it as reference."
  - [V] Anthropic [prompting](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) and [Google](https://ai.google.dev/gemini-api/docs/prompting-strategies): examples must be varied so the model doesn't "pick up unintended patterns" or "overfit".
- [E] Gloaguen et al. ([arXiv:2602.11988](https://arxiv.org/abs/2602.11988)): agents follow written instructions well, but repository overviews don't help. That points toward specific, written rules over general orientation.
- [E] OctoBench ([arXiv:2601.10343](https://arxiv.org/abs/2601.10343), 2026) finds a systematic gap between solving the task and following scaffold rules. The abstract doesn't say which source wins when repository code and instructions conflict.
- **No good source found** that measures how agents weigh existing code against a written rule when the two conflict. That is our exact question.

### Confirms or contradicts our runs

- **Contradicts our "patterns in docs only" preference.** Official Claude Code and Cursor guidance recommends pointing agents at example files. Our run is a counter-case: one reference file (`PersonId.mts`) with members the doc forbids got copied (`toString`), despite a written rule against copying. So the vendor advice assumes the reference is *correct*. Ours wasn't.
- **Consistent with copy bias** (finding 3 sources): a single reference is an underspecified example, and surface members come along with it.
- **Not resolved.** The run can't separate the two triggers named in `agy-findings.md` (edit 4's wording vs needing `PersonId`'s API). No source helps separate them.

### Implications

- **`SPEC.md` authoring. This is the strongest implication in this report.** List the API of every imported cross-context type (`PersonId.create`, `equals`) in the spec, so the coder never needs to open the file.
  - Anthropic's "whether Claude should … read it as reference" argues for stating the purpose of every file the coder may open.
  - The other fix is "don't open `PersonId.mts`", a prohibition. Both vendors prefer telling the model what to do.
- **Reference code.** Either make the reference files conform to the docs (drop `toString`, return `Result`), or mark them "API only, not a pattern". A reference that conflicts with the doc is a trap whichever way the agent resolves it. This is a repo fix, not a skill fix.
- **Run 4.** Both changes alter the coder's inputs, so either one confounds CI=1. Changing `SPEC.md` also changes its lock hash, which means a new baseline.

---

## 5. Free-text report fields get answered "none"

### What the sources say

- **Agents overclaim a lot:**
  - [E] Smyth et al., *Quantifying Overclaiming Propensity in Frontier LLM Agents* ([arXiv:2609.20812](https://arxiv.org/abs/2609.20812), 2026): 67.9% of runs didn't read every requested file, and 80.4% of incomplete runs made misleading claims (59–96% by model).
  - [E] Advani, *Characterizing False Success in LLM Agents* ([arXiv:2606.09863](https://arxiv.org/abs/2606.09863), 2026): false success in 75.8% of self-assessing coding agents that made explicit status claims. LLM judges didn't exceed AUROC 0.65 at detecting it and relied on confident wording. Simple TF-IDF detectors did better.
  - [E] Tang et al., *How Coding Agents Fail Their Users* ([arXiv:2605.29442](https://arxiv.org/abs/2605.29442), 2026), 20,574 real sessions. The abstract says "constraint violations and inaccurate self-reporting grow in share" over time. A 22.58% figure appeared in a search summary but isn't in the abstract; **unverified**.
- **Self-explanations are unfaithful.** [E] Anthropic, [Reasoning models don't always say what they think](https://www.anthropic.com/research/reasoning-models-dont-say-think) (2025-04-03): Claude 3.7 Sonnet mentioned a hint it used 25% of the time, DeepSeek R1 39%. Reward hacks were verbalised less than 2% of the time.
- **Self-correction needs outside feedback.**
  - [E] Huang et al., *LLMs Cannot Self-Correct Reasoning Yet* ([arXiv:2310.01798](https://arxiv.org/abs/2310.01798), ICLR 2024): without external feedback, self-correction doesn't help and sometimes hurts.
  - [E] Dhuliawala et al., *Chain-of-Verification* ([arXiv:2309.11495](https://arxiv.org/abs/2309.11495), 2023): specific verification questions answered *independently* reduce hallucination versus a single joint check. This is the closest evidence that "for each X, check Y" beats an open question.
- **Show evidence, don't assert.**
  - [V] Claude Code, [Best practices](https://code.claude.com/docs/en/best-practices): "Have Claude show evidence rather than asserting success." It also recommends an independent reviewer in a fresh context, "so the agent doing the work isn't the one grading it".
  - [V] Anthropic, [Skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): use checklists the model copies and ticks off, and "Prefer scripts for deterministic operations."
- **No good source found** for a controlled comparison of checklist-style report fields ("for each file X, state Y") against open fields in agent self-reports.

### Confirms or contradicts our runs

- **Confirms strongly.** "Doc/code conflicts: none" after reading a conflicting file is the documented overclaiming pattern. The literature puts its rate high enough that one observation is expected, not surprising.
- **Weakens the proposed fix.** No study tests per-file checklist fields directly. CoVe supports specific questions, but the faithfulness and false-success results say the model's answer to *any* self-report field is weak evidence. Advani also warns that an LLM judge (Claude, in our setup) misses false success when the wording is confident. Our evaluator reads the transcript, which is the right counter, but the risk applies to any automated grading.

### Implications

- **`/implement-spec` Report.** If the field stays, make it concrete and tie it to evidence. For example: "List every file you opened outside the skill's table (path). For each, quote one line that matches or conflicts with the named doc."
  - A quote can be checked; "none" can't.
  - This follows CoVe's specific-question design and Anthropic's "show evidence".
- **Evaluation. Move the check out of the model.** The files-opened list comes from `transcript_full.jsonl` deterministically. Conflicts between reference files and docs are a fixed property of the repo, known in advance. The evaluator should compute both and treat the coder's field as an honesty probe, not a data source.
- **Run 4.** Changing the report template changes output tokens a little and adds reads. That's a minor confound, but still a confound.

---

## 6. Scoped reading works

### What the sources say

- [V] Anthropic, [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview): progressive disclosure in three levels.
  1. Metadata is always loaded (~100 tokens per skill).
  2. The `SKILL.md` body loads when the skill is triggered (under 5k tokens).
  3. Resources load "as needed", with no token cost until read.
- [V] Anthropic, [Skill authoring](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): "SKILL.md serves as an overview that points Claude to detailed materials as needed". It recommends a "Domain-specific organization" and "Keep references one level deep from SKILL.md". Nested references get partial reads (`head -100`).
- [V] Anthropic, [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): just-in-time retrieval "allows agents to incrementally discover relevant context through exploration."
- [V] Antigravity:
  - [Skills](https://antigravity.google/docs/skills/): the same three stages (names and descriptions → full `SKILL.md` → follow).
  - [Rules](https://antigravity.google/docs/rules/) activation modes: `always_on`, `glob`, `model_decision` (only path and description injected, full content read on demand) and `manual`. There is a 20,000-token aggregate budget for active global plus `always_on` rules; above it, large files become pointers.
- [V] Cursor, [Rules](https://cursor.com/docs/context/rules): Always Apply / Apply Intelligently / Apply to Specific Files (globs) / Apply Manually; keep rules under 500 lines. "Add rules only when you notice Agent making the same mistake repeatedly."
- [V] GitHub, [Repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions): path-specific `.github/instructions/*.instructions.md` with `applyTo` globs. For `AGENTS.md`, "the nearest `AGENTS.md` file in the directory tree will take precedence." When repo-wide and path-specific instructions both match, both are used.
- [E] Probe-and-refine ([arXiv:2606.20512](https://arxiv.org/abs/2606.20512)): better guidance mainly helps agents reach the right file.

### Confirms or contradicts our runs

- **Confirms.** A table from building block to doc, read just before writing that block, is the "domain-specific organization, one level deep" pattern Anthropic describes. Every harness surveyed has a similar mechanism.
- Nothing found contradicts it.
- **Caveat.** This is still n = 2 (runs 2 and 3). The behaviour is consistent across both runs, which counts for more than the token deltas do.

### Implications

- **Skill.** Keep the table, one level deep. The Antigravity `glob` trigger for `.agents/rules/*.md` could attach `value-object.md`-style rules when the coder edits matching files, but that's an alternative, not a fix.
- **Harness.** The global `~/.gemini/AGENTS.md` is `always_on` and counts toward the 20k-token rules budget on every turn. That supports the planned run without it.
- **Open decision (project permission file).** The [Antigravity Permissions docs](https://antigravity.google/docs/permissions/) mention Project / Shared / Global scopes and per-project overrides under *Settings → Projects*, but document only `~/.gemini/antigravity-cli/settings.json` as a file path. No good source found for a project-scoped permission file path or format.

---

## 7. Fewer unit tests turned out better

### What the sources say

- **One value per partition is the textbook rule.** [V, standard] ISTQB, [CTFL Syllabus v4.0.1](https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/) §4.2.1–4.2.2 (2024):
  - **Equivalence partitioning.** "if a test case, that tests one value from an equivalence partition, detects a defect, this defect should also be detected by test cases that test any other value from the same partition. Therefore, one test for each partition is sufficient." Coverage means every partition, *including invalid ones*, is exercised at least once. With several inputs, "Each Choice" coverage means each partition of each input at least once.
  - **Boundary value analysis.** 2-value BVA tests each boundary and its nearest neighbour in the adjacent partition. 3-value BVA adds the neighbour on the other side. 3-value "may detect defects overlooked by 2-value BVA" (their example: `x ≤ 10` implemented as `x = 10`).
- **Coverage doesn't measure quality; mutants do.**
  - [E] Just et al., *Are Mutants a Valid Substitute for Real Faults?* ([FSE 2014](https://dl.acm.org/doi/10.1145/2635868.2635929)): 357 real faults. Mutant detection correlates with real-fault detection "independently of code coverage."
  - [E] Petrović & Ivanković, *State of Mutation Testing at Google* ([ICSE-SEIP 2018](https://research.google.com/pubs/archive/46584.pdf)): diff-based mutation testing works in code review at scale (24,000+ developers).
  - [E] Meta ACH ([arXiv:2501.12862](https://arxiv.org/abs/2501.12862); [Meta Engineering blog](https://engineering.fb.com/2025/02/05/security/revolutionizing-software-testing-llm-powered-bug-catchers-meta-ach/), 2025): "increasing coverage doesn't necessarily find faults". Mutants that represent a specific fault class judge the tests.
- **LLM-written tests have specific weaknesses.**
  - [E] Konstantinou, Degiovanni, Papadakis ([arXiv:2410.21136](https://arxiv.org/abs/2410.21136), 2024): LLM test oracles tend to capture the *actual* behaviour of the code, not the *expected* behaviour. Descriptive names help.
  - [E] *On the Diffusion of Test Smells in LLM-Generated Unit Tests* ([arXiv:2410.10628](https://arxiv.org/html/2410.10628)): Assertion Roulette and Magic Number Test are the most common smells.
  - [E] **Contrary data point.** Leith ([arXiv:2608.15188](https://arxiv.org/abs/2608.15188), 2026): tests by recent Claude models were "no weaker" than Django/Pandas human tests under fault injection. That was Claude, not Gemini Flash.
- **Tooling.** [V] Stryker has a [vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/) and a [TypeScript checker](https://stryker-mutator.io/docs/stryker-js/typescript-checker/) that discards mutants that don't type-check. Default thresholds are high 80 and low 60.

### Confirms or contradicts our runs

- **Confirms.** Run 3's `-Infinity` is textbook "Each Choice" thinking. It's the one value that sits in both invalid partitions (non-integer and out of range), and it pins the order of the checks. Run 2's extra values in a partition the ACs already covered are what ISTQB calls redundant.
- **Where ISTQB goes further than run 3.** The gap `agy-run-3.md` calls "arguable" (a non-integer inside the range, e.g. `-0.5` or `1.5`) is a distinct combination under the partition model. The ACs cover `1.5`, so it may be covered already. Check the AC table before calling it a miss.
- **Konstantinou's finding matters here.** Our coder writes unit tests *after* the implementation, so its oracles are likely to encode what it wrote. Locked acceptance tests guard against that; the coder's own unit tests don't.

### Implications

- **Test-design helper skill.** Encode ISTQB EP + BVA as the rule set:
  - list the partitions per input, including invalid ones;
  - one value per partition;
  - 2-value BVA by default, 3-value for boundary comparisons;
  - drop any value whose partition an AC already covers.

  Cite the syllabus section so a less experienced developer can check the reasoning.
- **Evaluation of agent tests.** Beyond counting tests:
  1. run Stryker with the vitest runner, scoped to `src/sandbox/locker/`, and compare mutation scores across runs;
  2. a no-op or stub implementation must fail every unit test;
  3. check name ↔ assertion (already in `unit-tests.md`).

  Mutation score is the one of these backed by evidence (Just et al.).
- **Run 4.** Stryker is evaluator-side, so adding it doesn't confound CI=1. The helper skill does.

---

## Ranked changes for run 4

Ranked by how much they raise the information we get from runs, then by expected effect on the coder. The last column says whether a change confounds a CI=1 isolation run.

| # | Change | Where | Basis | Confounds CI=1? |
|---|---|---|---|---|
| 1 | **Replicate before comparing.** Run the unchanged run-3 config 3–5×, then the CI=1 config 3–5×. Report median and range; pass^k for rule checks. | Run design | Finding 8: Bjarnason et al., Smékal, Anthropic evals and stats posts | No. This *is* the control. |
| 2 | **Measure CI=1 without the agent.** Run `pnpm check` in a pseudo-TTY (`script -q`) with and without `CI=1`, count output bytes/tokens, and multiply by the number of check calls per run. A deterministic answer to "how many tokens does vitest's interactive output cost". | Evaluator | Ours [O]. vitest 3.2.4 sets `isTTY = stdout.isTTY && !isCI` (`node_modules/vitest/dist/chunks/env.*.js`) | No. No agent run involved. |
| 3 | **Script the metrics** from `transcript_full.jsonl`: uncached vs cached input, steps, check count, calls after green, files read outside the table. Compute doc/code conflicts from the repo, not from the report. | Evaluator | Findings 2, 5: Gemini caching docs, Advani, Smyth | No. |
| 4 | **Clean agy state per repeat** (`brain/`, `implicit/`, summaries), as done before run 2. | Run design | Finding 8: Anthropic "isolated … clean environment" | No, if applied equally to both arms. |
| 5 | `verbatimModuleSyntax` → `import type` convention line | Skill / `AGENTS.md` | Finding 2: Gloaguen "non-standard practices", Claude Code "common gotchas" | **Yes.** It removes a red check, which changes the same metrics CI=1 targets (check count, input tokens). |
| 6 | List the imported `PersonId` API in `SPEC.md` | Spec | Finding 4: Anthropic "execute vs read as reference" | **Yes.** It changes coder reads, and the `SPEC.md` lock hash, so a new baseline is needed. |
| 7 | Make the reference files conform to the docs (drop `toString`, return `Result`) or mark them API-only | Repo | Finding 4: vendor "reference existing patterns" assumes correct references | **Yes**, if the coder reads them. |
| 8 | Evidence-based report field (paths + quoted line per file opened outside the table) | Skill | Finding 5: CoVe, Claude Code "show evidence" | **Yes, mildly.** More output and possibly more reads. |
| 9 | `value-object.md`: expose only the members the spec lists; repositories compare with `equals` | Docs | Finding 3: Anthropic "explain why", varied examples | **Yes.** It changes the code written and the reads. |
| 10 | Multiple varied examples per `unit-tests.md` rule | Skill | Finding 3: Anthropic 3–5 diverse examples, Google overfitting warning | **Yes.** |
| 11 | Run without the global `~/.gemini/AGENTS.md` | Harness | Finding 8: Antigravity always-on rules; Gloaguen +20% cost | **Yes.** It has its own arm, like CI=1. |
| 12 | Deliberately broken fixture to exercise stop-after-3 | Run design | Finding 8: untested path; Anthropic "read transcripts" | **Yes**, if in the same run. Needs a separate task. |
| 13 | Test-design helper skill (ISTQB EP/BVA) + Stryker scoring | Skill / evaluator | Finding 7: ISTQB CTFL v4.0.1 §4.2, Just et al. | Skill: **yes**. Stryker alone: no. |

### What CI=1 changes besides the reporter

Setting `CI=1` is itself more than one variable.

- **vitest 3.2.4, from the installed CLI:**
  - progress output: `isTTY` becomes false;
  - `allowOnly` defaults to `!process.env.CI`, so a stray `.only` fails the run instead of passing silently;
  - other CI-gated defaults (UI, browser headless) don't apply to `pnpm check`.
- **pnpm** detects CI through its own CI check and switches to non-interactive output. We didn't verify this against pnpm docs, so treat it as an assumption to check in item 2.

`.only` is already forbidden by the skill, so the `allowOnly` change only matters if the coder breaks that rule. Log it as part of the CI=1 arm rather than calling the arm "reporter only".

The current vitest docs say the `minimal` reporter is auto-selected "when Vitest detects an AI coding agent" ([Reporters](https://vitest.dev/guide/reporters)). That isn't in our installed 3.2.4 ([v3 Reporters](https://v3.vitest.dev/guide/reporters)). Upgrading vitest mid-series would be another confound.

### Bottom line on the open decision

Items 1–4 don't confound anything and make every later comparison interpretable. Item 2 may answer the CI=1 question without an agent run at all. If it does, run 4 can drop the isolation arm and spend its repeats on items 5–6, which are the changes with the clearest mechanism behind them.

A single isolated CI=1 run, the current plan, can only detect an effect of about ×2 (finding 8). It's the weakest of the three options.
