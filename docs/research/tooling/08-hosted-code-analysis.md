# Research: free hosted code analysis and AI review

Created: 2026-10-22
Input: "which free tiers (CodeScene, CodeRabbit, alternatives) fit this repo". Constraints: public GitHub repo (`Verthon/gym`), TypeScript 7, solo dev, trunk-based with no PRs (ADR 0003), nothing paid.
Tags as in `agy-findings-research.md`: **[E]** evidence, **[V]** vendor guidance, **[O]** opinion (ours says "ours").
All claims come from vendor pricing pages and docs read on 2026-10-22. Nothing below was installed or measured.

## Bottom line

- **There is no no-brainer. Adding a license is the closest thing to one.** The repo has no `LICENSE` file. Sonar's OSS plan is for "Public, OSI-licensed repos", and CodeScene and DeepSource word their free tiers as "for open-source projects". Without a license the repo is public but not open source. Add one (e.g. MIT) before signing up anywhere. **[V]**
- **CodeScene Community Edition is the one tool that adds information.** It analyzes git history (hotspots, code health trends, knowledge distribution), not PRs, so trunk-based work loses nothing. Signing up takes a GitHub OAuth app and no CI changes. One open question: the FAQ says it analyzes "public organizational repositories", and `Verthon/gym` is a personal repo. **[V]** (ours: try it first)
- **SonarQube Cloud Free and DeepSource OSS both analyze `main` without PRs.** Most of what they catch is already caught by oxlint, knip and dependency-cruiser. They don't confirm that their TS analysis works on TypeScript 7, and TS 7 has already filtered out Semgrep and typescript-eslint (`00-summary.md`). Treat them as unverified until a scan runs. **[V]** / **[O]**
- **CodeRabbit is only useful through its CLI.** Public repos get free PR reviews, but there are no PRs here. `cr review --committed` / `--uncommitted` reviews local changes, limited to 3 reviews per hour on the OSS and Free tiers. **[V]**
- **Skip Qodana.** Its JS/TS linter requires an Ultimate license. **[V]**

## CodeScene result (2026-10-22)

- **CodeScene ignores `.mts`.** The first analysis (revision `6c6c40b`) reports 2 TypeScript files (`src/index.ts`, `knip.config.ts`, 24 lines) and 50 "Ignored" files; that revision has 48 `.mts` files. The 10/10 Code Health score therefore covers none of the domain code. **[E]**
- The [project configuration docs](https://codescene.io/docs/configuration/project-config/index.html) offer only exclusion by extension or glob, with no extension-to-language mapping. The [language support page](https://codescene.io/docs/usage/language-support.html) lists TypeScript without naming extensions. **[V]**
- With "Detect all files with text content" enabled, the 48 `.mts` files are analyzed as language `.mts`: hotspots and change frequency work (21 hotspots, top `ContractDraftService.mts`), but every `.mts` file gets Code Health `-`, and the project score falls to 0.0. CodeScene parses `.mts` as plain text, so it's a hotspot map with no health score. **[E]**
- The cloud REST API (`api.codescene.io/v2`) works with a Community Edition token, despite the FAQ saying the API is on-prem only. **[E]**

## CodeRabbit CLI result (2026-10-22)

- **Setup:** CLI 0.9.1 via Homebrew, `coderabbit auth login` with GitHub. `coderabbit usage` reports 10 reviews per rolling hour for `Verthon/gym` (not the 3 per hour from the docs) and "Usage billing: inactive", so nothing is charged. Never pass `--use-credits`. **[E]**
- **Run:** `coderabbit review --committed --base-commit 6c6c40b --agent` in a detached worktree at `9f35ecb`, covering the 3 suspension commits (`d1063a6`, `0a6c1c8`, `9f35ecb`): 10 files, +428/−19. It took about 4 minutes. `--agent` emits JSON lines (`finding`, `complete`). **[E]**
- **Findings:** 1, rated major: "a failed save leaves the contract suspended" in `ActiveContractService.mts:17`. Verified: the stated scenario can't happen (`Map.set` never rejects), but it points at a real defect, the in-memory repositories returning live references. The coder/critic agents had not caught it. Follow-up: `docs/tasks/in-memory-repo-aliasing.md`. **[E]**
- **Takeaway:** 1 useful finding from 1, on a single run. CodeRabbit finds real issues, but its suggested fixes take the finding literally, so verify each one against the code before acting. One run isn't enough to judge its precision. **[O]**
- **Next:** more runs on other tasks, comparing CodeRabbit's findings with the critic agent's on the same diff. **[O]**

## CodeRabbit trial batch (started 2026-10-25)

- **Plan:** `coderabbit auth status` shows "Advanced (trial)", 14 days. The CLI limit is unchanged at 10 reviews per rolling hour, and usage billing is still inactive. The trial adds the cloud Coding Agent, which isn't used here because `code push` would bypass the local guards (ADR 0003). **[E]**
- **No critic baseline:** the repo has no critic agent definition, so the batch measures CodeRabbit's precision alone. Each finding is verified against the code. **[E]**
- **Method:** one review per single commit, `coderabbit review --committed --base-commit <sha>^ --agent` in a detached worktree. Raw JSONL output is kept in the session scratchpad only. **[E]**

| Range | Files, +/− | Time | Findings | Real | Notes |
|---|---|---|---|---|---|
| uncommitted diff on `77b3948` (FR-C14 end date) | 13, +450/−687 | 3.5 min | 2 (1 major, 1 minor) | 0 as stated, 1 partial | The same finding twice: `SignedContract.create` accepts any `durationInMonths`. The draft already checks it against the offer (`ContractDraftService.mts:79`), so it only happens when the draft is bypassed. What it does show: the duration crosses stages as a raw `number`. |
| `a93be56` | 16, +885/−489 | 4.3 min | 0 | — | |
| `95768e2` | 2, +39/−14 | 1.3 min | 0 | — | The fix is clean. The double-emit bug it fixes comes from `87e292d`, which wasn't reviewed, so this run says nothing about recall. |
| `c227455` | 27, +570/−451 | 2.4 min | 1 (major) | 0, false positive | "Pass `LocalDate` through the signing path". Its suggested diff quotes `private sign(at: Temporal.Instant)`, which only exists from `95768e2`/`ad0fe84` onward. At `c227455`, `UnsignedContract` and `contractSigned` both use `LocalDate`, so the types already agree. CodeRabbit read context from a later tree than the commit under review: HEAD, or the previous run in the batch. |
| `35023fa` | 6, +157/−23 | 1.5 min | 0 | — | |
| `ad0fe84` | 17, +65/−77 | 1.7 min | 0 | — | |
| `87e292d` (alone) | 11, +406/−73 | 3.2 min | 1 (major) | 0 | "Implement the signed-contract payment workflow". Correct, but out of scope: the commit adds the unsigned stage, and the payment stage was a later task. It's a reminder that work is missing, not a defect. This commit isn't the origin of the double emit: each signing order emits exactly once here. |
| `290ff38` (alone) | 5, +515/−349 | 3.3 min | 3 (all major) | 1 correct | **Recall hit.** "Two code paths now emit ContractSigned": it gives the exact call order (customer accepts, then sales confirms, then `toSignedContract`), notes the tests cover only the other order, and adds that `toSignedContract` isn't idempotent. This is the bug fixed later in `95768e2`, where `toSignedContract` no longer emits. The other 2 findings are false positives from the context leak: one asks for an `occurredAt: Temporal.Instant` argument, but nothing in `src` uses `Temporal` at `290ff38`; the other says `toGenericEvent` is missing, but `draft/events.mts` exports it at that commit. |

- **Totals so far (9 runs, including 2026-10-22):** 8 findings. 2 are useful (in-memory aliasing, double ContractSigned), 1 is a partial (duration as a raw `number`, reported twice), 1 is correct but out of scope, and 3 are false positives, all caused by the context leak. **[E]**
- **Recall:** 1 of 1 known later-fixed bug caught, with a correct reproduction order. The sample is n=1. **[E]**
- **Caveat on historical ranges:** the `c227455` false positive shows CodeRabbit doesn't keep to the checked-out tree when it gathers context. Reviews of past commits are less reliable than reviews of the current diff. Its main use case, `--uncommitted` before a commit, isn't affected. **[E]**
- **The leak isn't caused by batching:** `290ff38` ran alone and still quoted `Temporal.Instant` from a later tree, so CodeRabbit is pulling context from the repo's current state. Every finding on a past commit that names a symbol has to be checked against `git show <sha>:<file>`. **[E]**

### Blind skill runs vs CodeRabbit (2026-10-25)

Each skill ran in a fresh agent, which was given the skill and the code scope but not the defects. Target A: `unsigned-contract` at `290ff38`, the double `ContractSigned`. Target B: the current draft → signed-contract flow, the FR-C03 duration rule (`docs/tasks/membership-duration.md`). **[E]**

| Reviewer | Findings (A / B) | Double emit (A) | Duration rule (B) | Verified extras |
|---|---|---|---|---|
| CodeRabbit | 3 / 2 | Caught, major, with the call order | Partial: `SignedContract.create` only | — |
| `aggregate-designer` | 9 / 15 | Caught, High (A1, A3, A8) | Partial: one bullet inside B13, Low, `SignedContract` only | — |
| `requirements-critic` | 12 / 34 | Caught, High (A1, A3) | **Full**, Low (B5): names `ContractDraftService.mts:79` checking only membership in the offer's list, and asks whether 1/3/6/12 is a Contracting or an Offering invariant | B4: FR-C03 allows 1 month, but FR-C15 forbids termination before 3 months, and D7 adopted both without reconciling them. Confirmed by reading FR-C03, FR-C15 and D7. |
| `test-strategy-reviewer` | 6 / 20 | Caught, High (A1, A2): only one signing order tested | Missed. B16 says only one duration is tested, but not that invalid ones get in | B4: `ContractDraft.spec.mts:51` `toMatchObject({ occurredAt: at })` passes for any `Temporal.Instant`. Confirmed in a scratch Vitest run: `toMatchObject` passed with 2020 vs 2099, and `toEqual` failed. It's the only such assertion in `src`. |

- **Recall:** all four caught the double emit. Only `requirements-critic` found the root of the duration gap (the offer's own durations aren't checked), and it rated it Low. **[E]**
- **Noise:** the skills return 6–34 findings per target, against 1–3 from CodeRabbit. Most of the extras are unverified design or requirement opinions, and several repeat gaps already listed in `functional-requirements.md`. The two verified extras are the most valuable output of the comparison. Neither CodeRabbit nor the coder had found them. The FR-C03 vs FR-C15 conflict and the single signing order had both been reported by the 2026-09-28 skill runs (`docs/skill-runs/README.md`) and never became tasks, so the bottleneck was acting on the reports, not finding the problems. **[E]**
- **Reports:** `docs/skill-runs/2026-10-25/`. Follow-ups: `docs/tasks/membership-duration.md`, `docs/tasks/tomatchobject-temporal.md`. **[E]**
- **No context leak:** the skills read target A through `git show 290ff38:` and quoted no later code. **[E]**
- **Takeaway (ours):** CodeRabbit is cheap and precise on code-level defects in the current diff. The requirements critic finds rule gaps that code-level review can't see, because the code is internally consistent. They overlap only on the obvious bug. **[O]**

## Comparison

| Tool | Free tier (public repos) | Without PRs | Notes |
|---|---|---|---|
| CodeScene | Community Edition, public repos only | Yes, analyzes history | Possibly limited to org repos. The IDE extension is free "for a limited time period" and will later be for customers only. Whether the free tier allows the `cs delta` CLI token is not stated |
| SonarQube Cloud | Free plan: unlimited public projects, "only main branch analysis"; the OSS plan has Pro features for OSI-licensed repos | Yes, analyzes `main` | Docs don't confirm TS support in automatic analysis, so a scanner run in Actions may be needed |
| DeepSource | Unlimited public repos, 1,000 PR reviews a month | Yes, full analysis on every default-branch commit | AI Review and Autofix are pay-as-you-go, so leave them off |
| CodeRabbit | Free PR reviews "forever" on public repos | CLI only | OSS limits: 1–10 PR reviews per hour depending on stars, 3 CLI reviews per hour, 1 IDE review per hour |
| Codacy | "Free forever for open-source", unlimited public repos | Analyzes commits | Overlaps with Sonar and DeepSource, with no advantage here |
| Qodana | Community linters don't cover JS/TS | — | Out |

## Next steps

1. ~~Add `LICENSE`.~~ Done 2026-10-22: MIT.
2. Connect CodeScene Community Edition and confirm a personal repo is accepted.
3. Optional: run a CodeRabbit CLI review once on a real task's commits and compare its findings with the coder/critic agents' output.
4. Run Sonar or DeepSource only if a first scan proves they parse TS 7 and they find something the existing gates miss.

## Sources

- CodeRabbit: [pricing](https://www.coderabbit.ai/pricing), [CLI](https://docs.coderabbit.ai/cli/overview), [plans and rate limits](https://docs.coderabbit.ai/management/plans)
- CodeScene: [pricing](https://codescene.com/pricing), [FAQ](https://codescene.com/faqs), [Community Edition](https://codescene.com/product/codescene-for-open-source), [CLI](https://codescene.io/docs/cli/index.html), [VS Code extension](https://marketplace.visualstudio.com/items?itemName=CodeScene.codescene-vscode)
- Sonar: [plans and pricing](https://www.sonarsource.com/plans-and-pricing/), [SonarQube Cloud subscription plans](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- DeepSource: [pricing](https://deepsource.com/pricing), [full codebase review](https://docs.deepsource.com/docs/product/full-codebase-review)
- Codacy: [pricing](https://www.codacy.com/pricing)
- Qodana: [editions](https://www.jetbrains.com/help/qodana/pricing.html), [Qodana for JS](https://www.jetbrains.com/help/qodana/qodana-js.html)
