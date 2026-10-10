# Mutation testing

Created: 2026-10-09
Status: open, step 1 done, next is step 2

## Goal

Use surviving mutants to find tests that are missing for rules the domain actually has. Do not chase the score. An agent sorts out equivalent mutants and maps each survivor to a written rule. A human decides relevance when no rule exists, and that answer becomes a written rule. Covers item 13 in `docs/research/tooling/00-summary.md` and the test-quality question in `agy-findings.md`. Input: `docs/research/tooling/04-test-quality-gates.md` §1.

## Drivers

- Baseline on 2026-10-09: 778 mutants, **60.41% total / 86.88% covered**, 470 killed, 71 survived, 237 no coverage, 2 min 26 s full run (barrel `date-fns` import).
  - The 237 uncovered mutants are missing tests; coverage would show them too.
  - The 71 survivors are what only mutation testing shows.
- A survivor falls into one of three buckets:
  1. **Real gap:** a written rule is broken and no test fails.
  2. **Equivalent:** no test can kill it.
  3. **Doesn't matter:** killable, but a test for it would test the implementation rather than the spec.
- Only bucket 1 deserves a test. Tests for bucket 3 are "change-detector" tests that "violate testing best practices and cause brittle tests and false alarms" (Petrović et al., *Practical Mutation Testing at Scale: A view from Google*, TSE 2021).
- An agent can judge equivalence. Meta's ACH LLM judge reached precision/recall 0.95/0.96 on comment-stripped code (Foster et al., *Mutation-Guided LLM-based Test Generation at Meta*, arXiv:2501.12862).
- Relevance is not automated anywhere we found:
  - Google: "Not useful" clicks in code review, turned into more than 100 suppression rules by people. Unproductive mutants fell from 85% to 11%.
  - Meta ACH: generates mutants from a written concern, and code review judges relevance.
  - Facebook: reasons for skipping a mutant are often not in the code, for example "about to be deprecated" (Beller et al., arXiv:2010.13464).
- Contracting has no written rules for its state transitions. Example: activating a `SignedContract` twice is a silent no-op (`SignedContract.mts:46`), but neither `CONTEXT.md` nor `LANGUAGE.md` says so. The sandbox `SPEC.md` format (commands with preconditions) does have such rules.

## Decisions

1. **Lockfile.** Resolved 2026-10-10: accept. `devEngines` pins the runtime, so the `node` package and `allowBuilds.node: true` stay. Running `pnpm add` with pnpm 12.6 rewrote `node@runtime:24.21.0` as the npm package `node@24.21.0` (`node-bin-setup` with a postinstall script). The install also needs `allowBuilds.node: true`. Accept that, or regenerate the lockfile with the pnpm version that wrote the original?
2. **Where triage decisions live.** Google-style rules belong in an ignorer plugin (`PluginKind.Ignore`), which needs no comments. For one-off decisions, choose between `// Stryker disable next-line <mutator>: <reason>`, which breaks the no-comments rule, and a triage file plus a script that filters `reports/mutation/mutation.json`. StrykerJS docs list no file-based exclusion.
3. **CI gate shape.**
   - A global `break` lets a weak new file hide behind strong old ones.
   - A per-file floor needs a script over `mutation.json`.
   - A third option is changed files only: report survivors and don't fail.
   - Decide after the triage in step 2, once the bucket shares are known.
4. **Who triages in the coder loop.** The coder kills survivors it can cite a rule for and lists the rest in its report, or a separate reviewer step runs after the coder.

## Tasks

### 1. Land the setup

- [x] Resolve decision 1
- [x] Commit `@stryker-mutator/core@10.0.0`, `@stryker-mutator/vitest-runner@10.0.0`, `stryker.config.mjs`, and the `.gitignore` entries
  - The config needs an explicit `plugins: ["@stryker-mutator/vitest-runner"]`. Under pnpm, core can't find the runner on its own: "no TestRunner plugins were loaded"
- [x] `LocalDate.mts`: per-function `date-fns` imports. The research measured 5 min 45 s → 46 s. Here: 2 min 26 s → 33 s (full run, `--force`)
- [x] Script `mutation` in `package.json`: `stryker run` (incremental)
- [x] knip: confirm the Stryker deps and `stryker.config.mjs` are not reported

- After the import change: 778 mutants, 60.54% total / 87.06% covered, 471 killed, 70 survived, 237 no coverage. One mutant went from survived to killed with no test changes. Suspect: `LocalDate.today()` keeps the time of day (`new Date()`), so tests that compare against "today" depend on timing. During the run, a stale `.stryker-tmp` sandbox failed `GovernmentIdInfo` "accepts expiry equal to today" with `EXPIRED`. Check this before triage, because flaky kills make the survivor list unstable
- A stale `.stryker-tmp/` left by an aborted run gets picked up by vitest and knip (doubled test count, false failures). Vitest doesn't skip gitignored dirs

- Resolved 2026-10-10: the flaky "today" tests. Moved to Node 26 and a `Temporal.PlainDate`-backed `LocalDate`, with an injected `Clock` (instant + zone). Domain code takes `asOf` / `at`, and the specs use a fixed date. After that: 790 mutants, 61.14% total / 87.34% covered, 483 killed, 70 survived, 237 no coverage, 21 s full run. Five repeated test runs gave the same result each time
- Incremental gotcha: after adding `Clock.spec.mts`, the incremental run still reported a `Clock.system` mutant as survived. `--force` killed all 7. Static mutants (`coveredBy: 0`) kept their old result

### 2. Triage the 71 survivors by hand (contracting first)

- [ ] Export the survivors from `mutation.json` into a table with columns: file:line, mutator, original → replacement, bucket, rule reference or open question
- [ ] Sort each survivor into a bucket. An agent proposes and a human confirms. Record where they disagree, because those cases show where the agent's judgement fails
- [ ] Bucket 1 with a rule: write the test and cite the rule. `implement-spec/unit-tests.md:8` already requires an empty second `pullEvents()`, which covers the `this.events = []` survivors
- [ ] No rule: write the question for the human, then add the answer to `CONTEXT.md` / a spec before writing any test
- [ ] Measure: bucket shares, number of new written rules, score before and after, time spent

### 3. Record decisions

- [ ] Resolve decision 2
- [ ] Ignorer plugin for recurring bucket 2/3 patterns found in step 2
- [ ] Incremental run after triage: ignored mutants show as `ignored` and don't count toward the score

### 4. Agent workflow

- [ ] Equivalence check prompt: original and mutant with comments stripped, asks whether any input tells them apart. Compare against the step-2 labels
- [ ] Resolve decision 4
- [ ] `implement-spec`: after tests pass, run Stryker on the changed files. Kill survivors that map to an acceptance criterion and list the rest in the report as "unmapped". Never write a test without a cited rule
- [ ] Protect `stryker.config.mjs` and the ignorer plugin with the deny/ask hooks (summary item 7), so an agent can't make the run green by excluding files

### 5. CI

- [ ] Resolve decision 3
- [ ] Incremental run in `check.yml`, with the incremental file cached between runs
- [ ] Delete `reports/stryker-incremental.json` whenever `mutate` changes (research §1 gotcha)

### 6. Experiment: does mutation feedback change agent tests?

- [ ] Same spec and fixture as an agy run, with and without the step-4 workflow
- [ ] Compare survivors left in bucket 1, tests per rule, change-detector tests written, and wall time

## Blog notes

Collect these as the task goes:

- The coverage vs mutation gap, with our numbers: `SignedContract.mts` has 100% line coverage and an 80.65% mutation score
- Three buckets, and why the third is a trap for agents told to "kill all mutants"
- Missing written rules as the real finding. The mutants point to rules that were never written, more than to missing tests
- What industry automates (equivalence, suppression of known patterns) and what it leaves to people (relevance), with the sources above
- Setup issues on TS 7 + pnpm: TS checker unusable, `tsconfigFile` workaround, symlinked skills, explicit `plugins`, the `date-fns` barrel cost
- Step 2 and step 6 measurements
- Ambient time as hidden flakiness: `LocalDate.today()` inside VOs and event factories made one mutant flip between killed and survived with no code change. `ContractPrepared.occurredAt` used the wall clock instead of the use case's `asOf`
