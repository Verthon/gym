# Research: harness-engineering writeups, mechanisms only

Created: 2026-09-29
Input: 2025–2026 "harness engineering" / agent-legible-repo writeups from OpenAI, Anthropic, Factory, Cursor, Stripe, Martin Fowler's site (Birgitta Böckeler) and named practitioners. Question: which mechanisms do they enforce in code, which of those fit a solo, small TypeScript DDD repo, and which only pay off at scale.
Tags as in the earlier docs: **[E]** evidence (a measurement or an observed result), **[V]** vendor guidance (a vendor's own engineering blog or docs), **[O]** opinion (ours says "ours").
Sources already cited in `agy-findings-research.md` and `agy-open-gaps-research.md` are not repeated. `docs/tasks/lint-strictness.md` lists Böckeler, Sng (Factory) and Horthy as "pasted, not re-verified". §5 verifies them against the primary pages.

## Bottom line

- **All of these writeups use the same core mechanism: a check the repo owns, whose failure message tells the agent how to fix the problem.** OpenAI: "we write the error messages to inject remediation instructions into agent context". Lopopolo applies the same idea in a solo repo: "every local lint should name the violated invariant and the preferred repair". Böckeler saw agents self-correct from `dependency-cruiser` messages. None of these sources measures the effect. It is practitioner evidence, not a controlled study.
- **The mechanisms that work for one person are cheap:**
  - custom messages on the boundary rules we already plan;
  - one or two custom lint rules for DDD roles;
  - a short `AGENTS.md` that works as a map;
  - a script that checks doc references resolve;
  - finishing each migration in one change so old patterns don't stay around as precedent.
- **Some mechanisms need scale:**
  - doc-gardening and garbage-collection agents on a schedule;
  - quality grades per domain;
  - agent-to-agent review loops;
  - per-worktree observability stacks;
  - Factory's readiness levels.

  The more agent throughput a team has, the more these pay off. OpenAI and Cursor also relax merge gates at high throughput. OpenAI says this "would be irresponsible in a low-throughput environment", so it confirms our strict gates rather than arguing against them.
- **Four gaps in this repo turned up while reading the code against these sources.** None of them needs research, and each is a small fix:
  1. `AGENTS.md` contains only `@AGENTS.md`, a self-import. The repo has no root map.
  2. CI (`.github/workflows/check.yml`) doesn't run `pnpm lint`.
  3. `pnpm build` (`tsc` with no `outDir`) writes 36 compiled `.mjs`/`.js` copies next to the sources in `src/`.
  4. `oxlint.config.mts` sets `maxWarnings: 20`, so warnings the agent introduces pass the gate.
- **Verified in a scratch copy:**
  - An oxlint 1.85 JS-plugin rule with a remediation message works with TS 7 in the tree. It runs in 2.4 s for the whole repo and catches an injected public constructor.
  - A 30-line doc-reference check catches a renamed reference file.
  - JS plugins are alpha and can't use type information.

---

## 1. OpenAI: *Harness engineering: leveraging Codex in an agent-first world*

Ryan Lopopolo, OpenAI, 2026-02-11, [openai.com/index/harness-engineering](https://openai.com/index/harness-engineering/). The page returns 403 to plain fetchers. The text was read through a reader proxy, and Lopopolo's own repo ships a [fetch helper](https://github.com/lopopolo/harness-engineering) for the same reason.

Context [E, single team, self-reported]: about 1M lines of code, about 1,500 PRs, 3–7 engineers, five months, "0 lines of manually-written code". OpenAI also sells Codex, a point Böckeler makes too (§4).

Mechanisms enforced in code [V]:

| Mechanism | Quote |
|---|---|
| Layer rule, per domain | "code can only depend 'forward' through a fixed set of layers (Types → Config → Repo → Service → Runtime → UI). Cross-cutting concerns … enter through a single explicit interface: Providers. Anything else is disallowed and enforced mechanically." |
| Custom lints with remediation text | "we statically enforce structured logging, naming conventions for schemas and types, file size limits, and platform-specific reliability requirements with custom lints. Because the lints are custom, we write the error messages to inject remediation instructions into agent context." |
| Invariants, not implementations | "we require Codex to parse data shapes at the boundary, but are not prescriptive on how that happens" |
| AGENTS.md as a map | "we treat it as **the table of contents**" … "A short `AGENTS.md` (roughly 100 lines) … serves primarily as a map, with pointers to deeper sources of truth elsewhere." |
| Knowledge-base linting | "Dedicated linters and CI jobs validate that the knowledge base is up to date, cross-linked, and structured correctly." |
| Doc gardening | "A recurring 'doc-gardening' agent scans for stale or obsolete documentation that does not reflect the real code behavior and opens fix-up pull requests." |
| Golden principles + garbage collection | "'golden principles' … opinionated, mechanical rules" … "a set of background Codex tasks that scan for deviations, update quality grades, and open targeted refactoring pull requests. Most of these can be reviewed in under a minute and automerged." |
| Promote rules into code | "When documentation falls short, we promote the rule into code" |

The key premise for us: "Codex replicates patterns that already exist in the repository—even uneven or suboptimal ones. Over time, this inevitably leads to drift." Before automating the cleanup, the team spent "every Friday (20% of the week) cleaning up 'AI slop.'"

What doesn't transfer [V]: "minimal blocking merge gates … Test flakes are often addressed with follow-up runs … This would be irresponsible in a low-throughput environment."

**Applied to us (ours, [O]).**

- **Transfers:**
  - the map-style `AGENTS.md`;
  - remediation text in every custom rule;
  - the layer rule, which is our `architecture-check.md` allowlist;
  - "invariants, not implementations".
- **Doesn't transfer at our size:**
  - the doc-gardening agent;
  - the quality-grades document;
  - background garbage-collection tasks.

  With one developer and a few PRs a week, a check that fails in `pnpm check` does the same job for less.

## 2. Anthropic engineering

- [V] Justin Young, [*Effective harnesses for long-running agents*](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), 2025-11-26.
  - Uses an `init.sh`, a `claude-progress.txt` file, a feature list of more than 200 items all starting as `"passes": false`, and a git commit per feature.
  - A mechanism relevant to our task checklists: "we landed on using JSON for this, as the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files."
  - Each session starts by running a smoke test before new work, because "If the agent had instead started implementing a new feature, it would likely make the problem worse."
  - These are prompts plus files. None of it is a lint rule.
- [V] Prithvi Rajasekaran, [*Harness design for long-running application development*](https://www.anthropic.com/engineering/harness-design-long-running-apps), 2026-03-24.
  - Setup: a generator/evaluator split, with a "sprint contract" negotiated before code is written.
  - The general principle: "every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing". Method: "removing one component at a time and reviewing what impact it had".
  - The evaluator "is worth the cost when the task sits beyond what the current model does reliably solo."
  - Out of the box, "Claude is a poor QA agent … talk itself into deciding they weren't a big deal and approve the work anyway."
- [V] Anthropic, [*Writing effective tools for agents*](https://www.anthropic.com/engineering/writing-tools-for-agents), 2025-09-11: "prompt-engineer your error responses to clearly communicate specific and actionable improvements, rather than opaque error codes or tracebacks." This is the same principle as OpenAI's lint messages, stated for tool errors.
- [V] Claude Code [hooks reference](https://code.claude.com/docs/en/hooks): with exit code 2, a `PostToolUse` hook "Shows stderr to Claude; the tool already ran". This is the channel for returning a lint message right after an edit.

**Applied to us (ours, [O]).**

- Rajasekaran's "one component at a time" is the right way to evaluate the harness we already have. It matters most for us because we run two different models (Claude and Gemini through agy), and each harness piece encodes an assumption about one model's weakness.
- The JSON-over-Markdown finding is relevant to `docs/tasks/*.md`: agents tick those checkboxes. It is cheap to try if a coder run ever rewrites a checklist it shouldn't touch. We haven't seen that happen, so it isn't worth doing now.

## 3. Factory

- [V] Alvin Sng, [*Using Linters to Direct Agents*](https://factory.ai/news/using-linters-to-direct-agents), 2025-09-05. Rule categories:
  - "Grep-ability": named exports, consistent error types.
  - "Glob-ability": predictable file placement.
  - "Architectural Boundaries".
  - "Testability": tests colocated, no network in unit tests.
  - "Observability".
  - "Documentation Signals".

  Process quotes:
  - "Define rules that forbid legacy patterns … start as warnings to tune, then promote to errors."
  - "Time‑box waivers and track compliance."
  - "`AGENTS.md` … maps each guideline to a RuleID and links to rule docs/ADRs."
  - "If you adopt only one category, adopt this one" (grep-ability).
- [V] Factory, [`Factory-AI/eslint-plugin`](https://github.com/Factory-AI/eslint-plugin): the published rule set. Examples:
  - `require-test-files`: "TypeScript files must have corresponding test files";
  - `filename-match-export`;
  - `errors-file-organization`: "Error classes must live in `errors.ts`";
  - `structured-logging`;
  - `require-v0-strict-schemas`.

  Their own advice: "Our recommendation is NOT to simply import this package. Instead, take the ideas". Each rule ships a README "that makes it easy for any AI agent to parse and adapt".
- [V] Factory, [*Introducing Agent Readiness*](https://factory.ai/news/agent-readiness), 2026-01-20, and [docs](https://docs.factory.ai/agent-readiness/overview).
  - More than 60 binary criteria across nine pillars and five levels. You unlock a level at 80% of its criteria.
  - "Most signals are file existence checks or configuration parsing."
  - Level 1: README, linter, type checker, unit tests. Level 2: AGENTS.md, devcontainer, pre-commit hooks, branch protection.
  - The criteria are scored by an LLM. Grounding each score on the previous report cut run-to-run variance "from 7% average to 0.6%" [E, vendor-measured].

**Applied to us (ours, [O]).**

- Readiness is an org dashboard. Most of its higher-level criteria (tracing, CODEOWNERS, experiment infrastructure, flaky-test detection) are either security, which is out of scope, or scale. By its own Level 1–2 list, we lack a working `AGENTS.md` and a devcontainer, and branch protection is unverified.
- Rules from the plugin that are worth copying as ideas:
  - `require-test-files`, scoped to domain files. Today 14 of 24 domain `.mts` files have no colocated spec, including `Money.mts` and `Result.mts`. That is a policy decision (are `events.mts` files exempt?), not a free win.
  - A same-name check. `FeeStructure.mts` exists in both `src/money/` and `src/contracting/draft/`, which is the grep-ambiguity Sng warns about.

## 4. Martin Fowler's site: Birgitta Böckeler (Thoughtworks)

- [O, named practitioner] [*Harness Engineering – first thoughts*](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html), 2026-02-17. She splits OpenAI's harness into "Context engineering", "Architectural constraints" and "'Garbage collection'". She adds: "What I am missing in the write-up is verification of functionality and behaviour", and notes that "OpenAI do have a vested interest". She also names the retrofit cost: "running a static code analysis tool on a codebase that's never had one, and then drowning in alerts."
- [O] [*Harness engineering for coding agent users*](https://martinfowler.com/articles/harness-engineering.html), 2026-04-02.
  - Vocabulary: guides are feedforward controls, sensors are feedback controls, and each can be computational or inferential.
  - "custom linter messages that include instructions for the self-correction - a positive kind of prompt injection."
  - Example row: "Structural tests | feedback | Computational | A pre-commit (or coding agent) hook running ArchUnit tests".
  - Timing: run cheap sensors before commit, and put "Continuous drift and health sensors" (dead code, coverage quality) outside the change lifecycle.
  - Open question she raises: "If sensors never fire, is that a sign of high quality or inadequate detection mechanisms?"
- [E, single-developer experiment] [*Maintainability sensors for coding agents*](https://martinfowler.com/articles/sensors-for-coding-agents.html), 2026-05-27. See §5 for the verified details. Additions not in `lint-strictness.md`:
  - "I had to figure out how to catch things when AI starts creating new folders outside of this structure, with a rule that requires every new file to be somewhere in the predefined folder structure." Our allowlist already plans this.
  - "Looking at the exceptions AI created (suppressed warnings, increased thresholds) was a good point to start my code review." Suppressions work as a review index, not only as an escape route.
  - Getting agents to run sensors through a guide (AGENTS.md or a skill) "is also quite unreliable. I had to ask the agents many, _many_ times why it had not run the sensors check". Her suggested alternatives: hooks after file edits, or `pre-commit`.
  - The coupling-metrics CLI was "not useful to AI" on its own. An LLM modularity review found semantic duplication that no computational sensor caught.

## 5. Verification of the claims pasted into `lint-strictness.md`

| Claim in `lint-strictness.md` | Primary source says | Status |
|---|---|---|
| Böckeler: agent may suppress `no-explicit-any` if it writes a reason | Message text: "Make a judgment call about this. If you choose to not introduce a type, suppress it with: `// eslint-disable-next-line … -- (give reason why)`" | Confirmed |
| Böckeler: raising thresholds is an escape route | Partly. Her message *allowed* a slight threshold increase: "This doesn't suppress the threshold forever, just increases it, so that the rule fires again if it gets even worse". Where the complexity message lacked that guidance, the agent "frequently decided to increase the cyclomatic complexity threshold". | Nuance: an allowed, reviewable escape hatch, not a leak |
| Böckeler: dependency-cruiser at error | `severity: "error"`, with a `comment` recapping the layers ("[Layers: routes -> services -> clients + domain; …]") | Confirmed |
| Böckeler: size limits push complexity elsewhere | "components with lots and lots of properties as a result of passing values through a growing chain of smaller and smaller components" (React frontend) | Confirmed, frontend only |
| Sng: warn then error, time-boxed waivers | Both quoted in §3 | Confirmed. Warn applies only while the rule is being tuned |
| Horthy: "Success = ✓. Failure = full output." Fail-fast | [HumanLayer blog](https://www.humanlayer.dev/blog/context-efficient-backpressure), 2025-12-09 (author metadata "Dex"). Same text, plus "Enable failFast … One failure at a time" | Confirmed |

## 6. Cursor and Stripe: where scale changes the answer

- [V] Wilson Lin, Cursor, [*Scaling long-running autonomous coding*](https://cursor.com/blog/scaling-agents) (2026-01-14) and [*Towards self-driving codebases*](https://cursor.com/blog/self-driving-codebases) (2026-02-05). Hundreds of agents, about 1,000 commits/hour.
  - "When we required 100% correctness before every single commit, it caused major serialization … Workers would go outside their scope and start fixing irrelevant things." They accepted a small error rate plus a "final 'green' branch".
  - Guidance that transfers: "Constraints are more effective than instructions. 'No TODOs, no partial implementations' works better than 'remember to finish implementations.'"
  - "A later run explicitly laid out the dependency philosophy and which libraries must not be used, which corrected this."
- [V] Stripe, [*Minions … Part 2*](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2) (2026).
  - "Blueprints": state machines that mix agent nodes with deterministic nodes such as "Run configured linters". Rationale: "writing code to deterministically accomplish small decisions we can anticipate—such as 'always lint changes at the end of a run'—saves tokens … and gives the agent a little less opportunity to get things wrong."
  - CI loop is capped: "one more chance … After the second push and CI run, we send the branch back to its human operator."
  - Rules: "we almost exclusively give minions context from files that are scoped to specific subdirectories or file patterns".

**Applied to us (ours, [O]).**

- Cursor's relaxed correctness is a throughput tradeoff for hundreds of parallel writers. With one coder at a time, a red commit blocks nobody, so keep the gate strict.
- Stripe's "deterministic node" is what our git hooks and a Stop/`PostToolUse` hook already approximate.
- Stripe's two-round CI cap matches the stop-after-3 hook in `agy-open-gaps-research.md` §6.
- Scoped rules match `src/contracting/CONTEXT.md` / `LANGUAGE.md` living next to the code. They need a root map that points to them, which we don't have (see Applied to us, #1).

## 7. Named practitioner running a solo repo: Ryan Lopopolo

Lopopolo wrote the OpenAI post. His [`lopopolo/harness-engineering`](https://github.com/lopopolo/harness-engineering) repo (last commit 2026-07-18) documents his private homelab repo, which is one operator plus agents. That is the closest published analogue to our setup. [O, named practitioner, self-described]

- Its custom-lint catalogue includes "a ban on local lint-suppression comments" and "discoverable purpose documentation for every custom lint".
- "Each lint has a local explanation of the invariant and why it exists. Its diagnostic includes the remediation path. Tests exercise both the live repository and small positive and negative in-memory fixtures."
- Cost, stated by him: "repository parsers and custom lints are production code and require tests".
- "Finish migrations and install the ratchet":
  - from [*The Production Function Changed*](https://hyperbo.la/w/production-function-changed/) (2026-03-13): "I turned on `no-await-in-loop` from ESLint in a large TypeScript codebase, finding 600 violations … with agents, it is a single PR to both do the lint fix" and add coverage;
  - "Leaving old and new patterns side by side makes both available as prompt material."
- "If it matters, it belongs in a verifier owned by the repo." … "The agent does not need to remember the rule up front; the verifier gives it the missing context exactly when it needs it."
- Parse at the boundary, turned into lints: "branded identifiers, unit-bearing duration types, boundary-only decoding, and AST-aware lints for escape hatches the type system cannot prevent."

**Applied to us (ours, [O]).** "Finish the migration in one change" is the general form of the earlier finding that `PersonId.mts` must match `value-object.md` before the coder copies it. When a rule is adopted, all violations get fixed in the same PR, or the rule doesn't go in.

## 8. Mechanism catalogue: solo fit vs scale

| Mechanism | Who | Solo small repo | Why |
|---|---|---|---|
| Remediation text in lint / boundary messages | OpenAI, Böckeler, Lopopolo, Factory, Anthropic (tools) | **Yes** | Written once, zero runtime cost |
| Layer / boundary rules as a check | OpenAI, Böckeler, Factory | **Yes** (planned) | Already in `architecture-check.md` |
| Custom role lint (DDD building blocks) | OpenAI "taste invariants", Factory plugin, Lopopolo | **Yes, 1–2 rules** | Each rule is code to test (Lopopolo) |
| Short `AGENTS.md` as a map | OpenAI, Stripe (scoped rules) | **Yes** | We have none today |
| Doc cross-link / reference check | OpenAI | **Yes, as a script** | 30 lines; the scheduled agent isn't needed |
| Finish-the-migration + ratchet | Lopopolo, Factory | **Yes** | Process, no tooling |
| Suppression policy (ban, or reason + review) | Lopopolo (ban), Böckeler (reason), Factory (time-box) | **Yes** | Pick one; `reportUnusedDisableDirectives` is already on |
| `require-test-files` style structural test | Factory | Maybe | Needs an exemption policy (events, repos) |
| Quiet-on-success output wrapper | HumanLayer | Low now | Measured: `vitest run` prints 2.3 KB for the whole suite today |
| Doc-gardening / garbage-collection agents on a schedule | OpenAI, Böckeler ("janitor army") | Scale | At our PR volume, a failing check does the same job |
| Quality grades per domain | OpenAI | Scale | Needs several domains and owners |
| Agent-to-agent review loop, evaluator agent | OpenAI, Anthropic | Scale / per task | Anthropic: worth it only past what the model does reliably alone |
| Readiness scoring | Factory | Scale | An org dashboard |
| Relaxed merge gates, accepted error rate | OpenAI, Cursor | **No** | Both say it depends on throughput |

## 9. Empirical checks (scratch copy of the repo, TS 7.0.2, oxlint 1.85.0)

1. **Custom oxlint rule with a remediation message.**
   - Setup: `jsPlugins: ["./tools/lint/gym-plugin.mjs"]`, rule `gym/private-constructor`, applied through an override to `src/contracting/**` and `src/money/**` with specs excluded. The message names the fix (`private constructor` + `static create(...)` returning `Result<X, XError>`) and the pattern doc.
   - Result: the full `oxlint` run took 2.4 s wall. An injected `export class Discount { constructor(readonly percent: number) {} }` failed with the custom text, exit 1. All existing VOs and entities passed.
   - One false positive: `InMemoryContractDraftRepository`. The rule needs a role selector (filename suffix or folder), not just a path glob. That is the same "role" problem Tune's rules solve (`lint-strictness.md`).
   - [V] Oxc [JS plugins docs](https://oxc.rs/docs/guide/usage/linter/js-plugins): "JS plugins are currently in alpha". Not supported: "Lint rules that rely on TypeScript type-awareness." A private-constructor rule is syntactic, so this is fine. A "must return `Result`" rule would need types and isn't possible today.
2. **Doc-reference check.** A 30-line Node script checks two things in `docs/architecture/`, `src/**/*.md`, the `implement-spec` skill and `AGENTS.md`:
   - backticked repo paths resolve;
   - relative Markdown links resolve.

   Today: 13 docs, 19 refs, 0 dead. After renaming `PersonId.mts` it reported `docs/architecture/value-object.md: dead reference src/contracting/draft/PersonId.mts` and exited 1. It needs no TypeScript API.
3. **Build output in `src/`.** With all `.mjs`/`.js` removed from `src/`, running `tsc` (the `build` script) wrote 36 files back next to the sources. `tsconfig.json` has no `outDir`, and `.gitignore` covers `dist` only. The same run also exited 2 on the untracked `src/sandbox/locker` spec, which imports modules that don't exist yet.
4. **Checked in the repo directly, not in the copy:**
   - `AGENTS.md` is the 10-byte line `@AGENTS.md`, and `CLAUDE.md` symlinks to it.
   - `.github/workflows/check.yml` runs type-check, unit tests, knip and build, but not lint.

---

## Applied to us: ranked by leverage vs cost

1. **Write `AGENTS.md` as a map of about 40–100 lines.**
   - Leverage: high. Cost: about 30 min.
   - Content:
     - commands (`pnpm check`, what each gate runs);
     - one line per `docs/architecture/*.md`, with when to read it;
     - pointers to `src/<context>/CONTEXT.md` / `LANGUAGE.md`;
     - locked files.
   - Today the root file is a self-import, so every agent starts with no map. Sources: OpenAI, Stripe. Verify with one agy run that the global `~/.gemini/AGENTS.md` and the repo file don't conflict.
2. **Add `pnpm lint` to CI, and set `maxWarnings: 0` or promote the remaining warn rules to error.**
   - Leverage: high. Cost: 10 min.
   - Lint currently runs only in `pre-commit`, which agy or any shell without the Claude hook can skip.
   - Factory: warn exists only while a rule is being tuned.
3. **Stop `tsc` emitting into `src/`.**
   - Leverage: medium-high. Cost: 10 min.
   - Set `outDir: "dist"` (or `noEmit` plus a separate build config), then delete the 36 stale `.mjs`/`.js` files.
   - Stale compiled copies are exactly the precedent OpenAI's "replicates patterns that already exist" and Lopopolo's "old and new patterns side by side" warn about. The agent's grep hits them too.
4. **Remediation text in every boundary rule when `architecture-check.md` is implemented.**
   - Leverage: high. Cost: near zero (it is the `comment` field).
   - Each `comment` should restate the allowlist row and name the fix, for example "move shared code to `src/money` or `src/utils`; cross-stage imports are a `CONTEXT.md` decision".
   - Source: Böckeler's verified example.
5. **One custom oxlint JS-plugin rule for DDD roles:** private constructor + static factory for VOs and entities, scoped by role rather than by folder.
   - Leverage: medium-high. It is the pattern the coder writes most often, and today only prose and a reference file enforce it.
   - Cost: about 1–2 h including fixture tests (Lopopolo: lints are production code).
   - Risk: alpha API, no type info. Keep the rule syntactic.
6. **Doc-reference check in `pnpm check`.**
   - Leverage: medium (0 dead refs today). It guards the reference-implementation pointers the coder relies on.
   - Cost: 30 min, already prototyped.
7. **Adopt "rule + all fixes in one PR" as the rollout policy** in `lint-strictness.md` §6.
   - Leverage: medium. Cost: none.
   - It settles the warn-vs-error question: tune as warn locally, merge only at zero violations as error.
8. **Suppression policy.**
   - Leverage: medium. Cost: 15 min.
   - Require `-- reason` on every disable comment, and treat `git grep oxlint-disable` as the first stop in review (Böckeler).
   - Not a full ban (Lopopolo): with one reviewer, visible suppressions are cheaper than blocked work.
9. **`require-test-files` structural test for domain files.**
   - Leverage: medium. Cost: 1 h plus an exemption policy decision.
   - 14 of 24 domain files have no spec today, so it can't go in without the migration from item 7.
10. **Skip for now:**
    - scheduled doc-gardening / garbage-collection agents;
    - quality grades;
    - readiness scoring;
    - evaluator agents;
    - the output-silencing wrapper (the suite output is 2.3 KB).

    Revisit when PR volume or test output grows. Rajasekaran's "remove one component at a time" is the test for whether any of these earns its place.
