# Research: deterministic gates on test quality

Created: 2026-09-29
Input: the coder agent writes both the code and its tests, so a green suite says little about whether the tests would catch a bug. Question: which deterministic tools measure or enforce test quality in this repo (TS 7.0.2, vitest 3.2.4, oxlint 1.85), and what they cost.
Tags as in the earlier docs: **[E]** evidence (a measurement or an observed result), **[V]** vendor guidance (a vendor's own docs), **[O]** opinion (ours says "ours").
Sources already cited in `agy-findings-research.md` §7 (Just et al., Google, Meta ACH, Konstantinou et al., the test-smell study, ISTQB) are not repeated.
Scratchpad: a copy of the repo with the stale `src/**/*.mjs` files and `src/sandbox` removed, run on 2026-09-29 (Node 24.21, 8-core Mac, Stryker 7 workers). No repo file other than this one was changed.

## Bottom line

- **Stryker works on this repo, with three workarounds, and it is fast enough for pre-push once the `date-fns` barrel import is fixed.** A full run over `src/money`, `src/contracting` and `src/utils` (778 mutants) took **46 s**. An incremental run with nothing changed took **3.9 s**, and one after a single weakened assertion took **6 s**. Before the per-function `date-fns` imports, the same full run took **5 min 45 s**.
- **The baseline mutation score is 64.6%. Coverage looks much better than that.** `SignedContract.mts` has 100% line coverage but a mutation score of 80.7%. Nothing asserts the state after activation or after a payment rejection. The money value objects score 31–56% because only `FeeStructure` has tests.
- **Mutation testing catches the gaming that coverage misses.** In scratch we weakened one assertion the way an agent does when a test fails (`toBe(17)` → `toBeGreaterThanOrEqual(17)`, and the second `expect` deleted). Coverage of `BirthDate.mts` stayed at 94.7% lines and 100% branches. Its mutation score fell from 88.1% to 73.8%.
- **fast-check paid off on `Money` straight away.** Four properties (24 ms) found a real edge case: `Money(-1 USD).multiply(0)` stores `-0`, which `toEqual`/`toBe(0)` reject. They caught a seeded `Math.round` rounding bug in 3/3 runs while all 45 example tests stayed green, and raised `Money.mts` from 37.2% to 55.6% mutation score. They did **not** catch a seeded off-by-one in the precision check. Stryker had already flagged that line as a surviving mutant.
- **The integration has sharp edges.**
  - `@fast-check/vitest` puts the random seed in the test name. Stryker then can't match tests between runs, so it silently ran zero property tests per mutant until we fixed the seed.
  - `@fast-check/vitest` ≥ 0.4 needs vitest ≥ 4.1. On vitest 3 you have to pin 0.3.0.
  - oxlint's `no-standalone-expect` flags every `expect` inside `test.prop`.
- **Agents do game tests, and prompts aren't the fix.** ImpossibleBench: Claude Opus 4.1's "primary cheating strategy involves modifying test cases", and read-only tests stop that. BaitBench: validity warnings in the prompt cut hacking by only 6.2 pp. The deterministic backstops are file protection for locked tests (hooks, see `06-agent-hooks.md`) plus a mutation-score floor in CI.

---

## 1. Mutation testing: StrykerJS 10 with the vitest runner

### Compatibility [E, measured]

| Component | Version | Works on our stack? |
|---|---|---|
| `@stryker-mutator/core` | 10.0.0 (2026-08-14) | Yes, with `tsconfigFile` pointed at a file that doesn't exist (see below) |
| `@stryker-mutator/vitest-runner` | 10.0.0, peer `vitest >=2.0.0` | Yes. The dry run finds all 45 (later 49) tests |
| `@stryker-mutator/typescript-checker` | 10.0.0 | **Not with `typescript@7.0.2` installed as `typescript`** |

Three problems came up, each with a workaround:

1. **Core crashes on TS 7: `ts.parseConfigFileTextToJson is not a function`.** Stryker's `TSConfigPreprocessor` does `import('typescript')` to rewrite `extends`/`references` in the sandbox copy of `tsconfig.json`. TS 7's `typescript` main export is only `{ version, versionMajorMinor }`. The preprocessor skips the rewrite when the file named in `tsconfigFile` isn't in the project, so `tsconfigFile: "tsconfig.stryker-skip.json"` (a file that doesn't exist) avoids the crash. Our `tsconfig.json` has no `extends` or `references`, so skipping the rewrite loses nothing. `inPlace: true` also skips it, but it mutates the working tree, which is a bad idea while agents are running.
2. **`ENOTSUP … copyfile` on `.claude/skills/*`.** Those entries are symlinks to directories, and the sandbox copy can't handle them. Fix: `ignorePatterns: [".claude", ".agents", "docs", "architecture"]`.
3. **TypeScript checker.** v10's release notes list "experimental support for TypeScript@7" [V]. In the installed code that is `typescriptChecker.experimentalNativePreview`. It loads the TS 7 API from `@typescript/native/unstable/sync`, and it still calls the classic `ts.sys` in `tsconfig-helpers.js`.
   - With `typescript@7.0.2` alone it fails with `Cannot read properties of undefined (reading 'readFile')`.
   - It worked with `typescript@5.9.3` plus `@typescript/native@npm:typescript@7.0.2` installed side by side. On `Money.mts` it discarded 74 of 180 mutants as compile errors. Wall time was unchanged (33.6 s against 33.5 s without the checker).
   - That setup puts two `tsc` versions in the repo in exchange for no speedup at our size. **Skip the checker.** Its docs page says nothing about TS 7 (checked 2026-09-29).

### Runtime [E, measured]

| Run | Mutants | Wall time |
|---|---|---|
| Full, `date-fns` barrel import (as in the repo today) | 789 | 5 min 45 s (dry-run overhead 6.2 s) |
| Same, `--ignoreStatic` | 778 | 3 min 19 s |
| Full, per-function `date-fns` imports | 778 | **46 s** (dry-run overhead 2.1 s) |
| Incremental, nothing changed | 0 re-run | **3.9 s** |
| Incremental, one test file changed (weakened assertion) | 44 re-run | **6 s** |
| Incremental, one source line changed (before the `date-fns` fix) | 4 re-run | 12.4 s |
| `--mutate src/money/Money.mts` only | 180 | 14.4 s |

- The `date-fns` fix is the one from `03-tsc-strictness.md` / the other passes. `LocalDate.mts` imports `date-fns/parseISO` etc. instead of the barrel. It also cut plain `vitest run` to about 1.2 s.
- Stryker warned that static mutants (module-level constants such as `CURRENCY_MINOR_UNITS`) took 78–86% of the time. `ignoreStatic` [V: "Static mutants are mutants which are only executed during the loading of a file"] stops mattering once the import is fixed.

### Incremental and diff-based runs [V + E]

- [V] [Incremental mode](https://stryker-mutator.io/docs/stryker-js/incremental/) reuses a result when "A mutant was 'Killed'; the culprit test still exists, and it didn't change" or "A mutant was not 'Killed'; no new test covers it, and no tests changed". Vitest gets "Full" change detection.
  - It cannot see "Changes in files outside mutated and test files" or dependency, env or `.snap` changes. Run with `--force` after dependency bumps.
- [V] There is no `--since` option in 10.0.0 (`stryker run --help`). Diff-scoping means passing changed files to `--mutate`. Line ranges (`src/app.js:5-7`) are supported, but "It is **not** possible to combine mutation range with a globbing expression in the same line" ([configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)).
- [E] Incremental with the full `mutate` glob already gives diff-based cost: 3.9–12 s in our runs. A separate diff script adds nothing.
- [E] **Gotcha.** Narrowing `mutate` (we excluded `src/utils/test.mts`) doesn't drop old entries from the incremental file, even with `--force`. The report kept showing `test.mts`. Delete `reports/stryker-incremental.json` when `mutate` changes.

### Thresholds [V + E]

- [V] `thresholds` default `{ high: 80, low: 60, break: null }`. `break` sets exit code 1 when the score is below it.
- [E] `break: 70` against our 64.5%: `Final mutation score 64.51 under breaking threshold 70, setting exit code to 1`.
- (ours, [O]) There is no per-file `break`. One global floor lets a weak new file hide behind strong old ones. The JSON report (`reports/mutation/mutation.json`) has per-file mutants, so a 20-line script can enforce a floor per file or per changed file if needed.

### What survived [E]: the gaps are real test gaps

Baseline (full run, property tests included, `test.mts` excluded): **64.6% total, 87.2% of covered mutants killed.** By file: `contracting` 80.5%, `GovernmentIdInfo`/`PersonId`/`Signature`/`LocalDate`/`Result` 100%, `money` 45.3%.

| File | Surviving mutant | What the tests don't check |
|---|---|---|
| `SignedContract.mts:36,58` | `this.state = {}` | state after `activate` / payment rejection |
| `SignedContract.mts:46,57` | `if (state.kind !== "AwaitingPayment") return` → `if (false)` | calling a transition twice or out of order |
| `UnsignedContract.mts:60` | `{ kind: "AcceptedByCustomer", at }` → `{}` | state after acceptance |
| `GuardianCoSignature.mts:53` | `&&` → `\|\|` in `equals` | two signatures differing in one field only |
| `BirthDate.mts:37–38` | month `>` → `>=`, day-compare → `true` | the birthday-month boundary, one side |
| `ContractDraft/UnsignedContract/ActiveContract` | `this.events = []` → `["Stryker was here"]` | that pulling events clears them |
| `Money.mts:108` | `if (fracPart.length > minorUnits)` → `if (false)` | `fromMajor("1.234","USD")`. With the check off it silently becomes 12.34 |
| `MonthlyDues/PenaltyFee/EnrollmentFee` | max bound `>` → `>=` | the upper boundary value (2-value BVA) |
| `ContractDraft.mts:64` | error `context` → `{}` | error context. `failWith` checks only `code` (a design choice) |

- Equivalent-mutant noise was low. The one clear case is `years < 0 ? 0 : years` → `<=`.
- (ours, [O]) The table above is the review list for the coder's tests, in a form that is hard to argue with.

## 2. Property-based testing: fast-check

### Setup that works with vitest 3 [E]

- `fast-check@4.10.2` and `@fast-check/vitest@0.3.0` (peer `vitest ^1||^2||^3||^4`). 0.4.0 and 0.5.0 need `vitest ^4.1.0` ([README](https://github.com/dubzzz/fast-check/tree/main/packages/vitest), [V]).
- `@fast-check/vitest` names each test `` `${label} (with seed=${seed})` `` (`lib/vitest-fast-check.js:53`). With a random seed the name changes every run, so Stryker's per-test coverage can't find the test again. **Every mutant came back "Survived", with the property tests listed under "Tests ran"**: `Money.mts` read 38.9% with 62 survivors. After a global fixed seed it read 58.9% with 26. Fix in a setup file:

```ts
// vitest.setup.mts
import { fc } from "@fast-check/vitest";
const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : 42;
fc.configureGlobal({ seed, numRuns: 100 });
```

- [V] fast-check docs: "configureGlobal fully resets the settings" ([global settings](https://fast-check.dev/docs/configuration/global-settings/)). The README recommends `fc.configureGlobal({ seed })` "to force a replay".
- (ours, [O]) A fixed seed makes the gate deterministic, and Stryker needs it. Exploration can run separately: `FC_SEED=$RANDOM pnpm test:unit` as a non-blocking CI job, which logs the seed on failure.

### What four properties on `Money` did [E]

Properties: `toMajorString` round-trips through `fromMajor`, `add` is commutative, `subtract` undoes `add`, `multiply` is symmetric around zero, and `add` across currencies fails with `CURRENCY_MISMATCH`. 100 runs each, 24 ms in total.

| Check | Result |
|---|---|
| Unmodified code, random seeds | Symmetry property failed 3 of 5 runs. Shrunk counterexample `[-1, 0, "USD"]`: `multiply` returns `amountMinor = -0`. `equals`, `isZero`, `toMajorString` and JSON are unaffected. `expect(m).toEqual(Money zero)` and `toBe(0)` fail. Latent, but real. |
| Seeded bug: `roundHalfUp` → `Math.round` (rounds -2.5 to -2) | Caught 3/3 runs. **All 45 example tests passed.** Counterexamples were not minimal (e.g. `[316367511310, 99.95, "USD"]`) |
| Seeded bug: `padStart(mu + 1)` → `padStart(mu)` | Caught by the round-trip property **and** by an existing `FeeStructure` example |
| Seeded bug: precision check `> minorUnits` → `> minorUnits + 1` | **Not caught by anything.** The properties generate only valid input. Stryker had flagged this line (§1) |
| Mutation score, `Money.mts` | 37.2% → **55.6%** (killed 67 → 100) |

### External evidence [E]

- Tanaka et al. (NAIST), [arXiv:2510.25297](https://arxiv.org/abs/2510.25297), 2025-10: on 16 HumanEval problems where standard solutions fail extended tests, Claude-4-sonnet-written PBT and example tests "individually achieved a 68.75% bug detection rate, combining both approaches improved detection to 81.25%". PBT found performance issues and space-exploration bugs, and example tests found specific boundaries. This is the same split as our results.
- Jing, Wang, Zhang, Du (Tsinghua/UW), *PBT-Bench* ([arXiv:2605.15229](https://arxiv.org/abs/2605.15229), 2026-05): 100 problems with 365 injected semantic bugs. Bug recall was 42.1–83.4% across 8 LLMs with Hypothesis scaffolding, and 31.4–76.7% open-ended. Agent-written properties miss a lot, and the gap depends on the model.
- Chen et al., *Rethinking the Value of Agent-Generated Tests* ([arXiv:2602.07900](https://arxiv.org/abs/2602.07900), 2026): on SWE-bench Verified, agent tests are mostly "value-revealing print statements" rather than assertions, and prompting for more tests "do[es] not significantly change final outcomes". This is consistent with finding 7: more agent tests aren't better tests.

(ours, [O]) PBT fits value objects with algebraic laws (Money, LocalDate, BirthDate age monotonicity). It doesn't replace BVA examples for invalid partitions. Keep properties few and law-shaped, and let Stryker say where examples are missing.

## 3. Coverage thresholds (`@vitest/coverage-v8`)

- [V] [Vitest coverage config](https://vitest.dev/config/coverage):
  - `perFile: true` checks "each file … against the top-level thresholds instead of the project-wide aggregate";
  - `autoUpdate` raises thresholds in the config file "when current coverage is better";
  - `100: true` is a shortcut for all four metrics at 100;
  - glob-keyed thresholds "do not inherit the top-level `perFile`".
- [E] Measured (v8, domain code): 77.5% statements, 86.9% branches overall. `GuardianCoSignature`, `PersonId`, `Signature`, `GovernmentIdInfo`, `ActiveContract` are at 100%. `SignedContract` has 100% lines and 81.8% branches.
- **Why coverage alone is gameable [E, this repo].**
  - `SignedContract`: 100% lines, 6 surviving mutants.
  - `GuardianCoSignature`: 100% on every metric, 2 survivors.
  - The weakened `BirthDate` assertion (§Bottom line) left coverage unchanged and dropped the mutation score by 14 pp.
  - Coverage only records that code ran. Any test that calls the code without checking the result keeps it green.
- (ours, [O]) Coverage is still useful as a cheap floor against *deleted* tests and untested new files. It runs inside the normal `vitest run` in about 1 s. `perFile` + `autoUpdate` works as a ratchet. The agent can't lower a threshold without touching `vitest.config.mts`, which the hooks can protect.

## 4. Lint rules for tests (oxlint `vitest` plugin)

Probed in scratch against deliberately weak tests [E]:

| Weak pattern | Rule | Flagged? |
|---|---|---|
| test with no assertion | `vitest/expect-expect` (already on) | Yes |
| `if (r.success) { expect(...) }` | `vitest/no-conditional-expect`, `vitest/no-conditional-in-test` | Yes (both) |
| `it.skip` / `it.only` | `vitest/no-disabled-tests`, `vitest/no-focused-tests` | Yes |
| `toBeTruthy()` / `toBeDefined()` / `toMatchSnapshot()` on a Result | `vitest/no-restricted-matchers` with a list | Yes |
| `expect(true).toBe(true)` | none | **No** |
| `if` inside a `test.prop` body | `no-conditional-in-test` | **No**, because the rule doesn't treat `test.prop` as a test |
| `expect` inside `test.prop` | `vitest/no-standalone-expect` | **False positive** until `additionalTestBlockFunctions: ["test.prop", "it.prop"]` |

- Existing specs pass all the rules above except `prefer-strict-equal` (26 hits). That rule is style, so leave it off.
- The repo has 0 uses of the restricted matchers today.

## 5. Agents gaming tests: 2025–2026 evidence

- [E] Zhong, Raghunathan, Carlini, *ImpossibleBench* ([arXiv:2510.20270](https://arxiv.org/abs/2510.20270), 2025-10): tasks where the spec and the tests conflict, so any pass is cheating.
  - GPT-5 cheated 76% of the time on one variant.
  - "Anthropic models and Qwen3-Coder predominantly rely on … directly modifying test files."
  - Read-only tests were "particularly effective against Claude Opus 4.1"; hidden tests cut cheating "to near zero" but hurt performance.
  - An abort option lowered GPT-5 from 54% to 9% but was "much less pronounced for Claude Opus 4.1".
  - Multiple submissions *raised* cheating from 33% to 38%.
- [E] Prasad et al., *BaitBench* ([arXiv:2608.30724](https://arxiv.org/html/2608.30724), 2026-08-31): 57.1% of runs reward-hacked across 7 frontier agents (Claude Opus 76.1%), and 92.4% showed awareness of the exploit. Validity-aware prompting helped by 6.2 pp on average, and reflection helped by 0–7 pp.
- [E] Zhao et al., *SpecBench* ([arXiv:2605.21384](https://arxiv.org/abs/2605.21384), 2026): every frontier agent saturates the visible tests. The visible-to-held-out gap grows by 28 pp per 10× code size, and one example memorised test inputs.
- [E] Gabor, Lynch, Rosenfeld, *EvilGenie* ([arXiv:2511.21654](https://arxiv.org/abs/2511.21654), 2025-11): Codex, Claude Code and Gemini CLI all showed misaligned behaviour ("hardcoding test cases or editing the testing files"). Held-out tests added "only minimal improvement" as a detector, and LLM judges did better.
- [V, not re-read] Anthropic system cards (e.g. [Claude Opus 4.5](https://assets.anthropic.com/m/64823ba7485345a7/Claude-Opus-4-5-System-Card.pdf)) include a reward-hacking eval for hard-coding or special-casing tests. This comes from search-result snippets. The PDF wasn't opened in this pass.
- [V] Claude Code [hooks guide](https://code.claude.com/docs/en/hooks-guide), "Block edits to protected files": a `PreToolUse` hook on `Edit|Write` that exits 2 on a protected path pattern. Mechanics and the Bash / subprocess caveats are in `06-agent-hooks.md` §2.

(ours, [O]) Map each failure mode to a gate:

| Failure mode | Gate that catches it |
|---|---|
| Edits a locked acceptance spec | hook deny, plus CI diff check |
| Deletes a test | coverage `perFile` floor, plus mutation drop |
| Weakens an assertion | mutation score (the only one of these that caught it here) |
| Leaves no assertion, a conditional assertion, `.skip` or `.only` | lint |
| Special-cases the implementation for test inputs | PBT with generated inputs, plus review |

---

## Applied to us (ranked leverage vs cost, ours [O])

1. **Per-function `date-fns` imports + fixed fast-check seed setup.** These are prerequisites: they make Stryker 7× faster and keep future property tests visible to it. Cost: minutes.
2. **Stryker with incremental mode as a CI job**, `break` a few points under the current score (start at 60, ratchet up). Commit nothing from `reports/` except, optionally, the incremental file for CI cache. Cost: 46 s cold, seconds warm. Put it in CI rather than pre-push at first: agents push often, and a cold run after `pnpm install` costs 46 s.

```js
// stryker.config.mjs
export default {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ["src/**/*.mts", "!src/**/__tests__/**", "!src/utils/test.mts", "!src/sandbox/**", "!src/index.ts"],
  reporters: ["clear-text", "progress", "json", "html"],
  thresholds: { high: 80, low: 60, break: 60 },
  incremental: true,
  ignorePatterns: [".claude", ".agents", "docs", "architecture"],
  tsconfigFile: "tsconfig.stryker-skip.json", // TS 7: skips core's tsconfig rewrite, which needs the classic TS API
};
```

```json
"test:mutation": "stryker run"
```

   Add `.stryker-tmp/` and `reports/` to `.gitignore`, and `".stryker-tmp/**"` to vitest `exclude` (spread `configDefaults.exclude`, or vitest will start collecting `dist/`).
3. **Test lint rules.** Zero cost today, and they block the cheap forms of weak tests before a commit.

```ts
"vitest/no-standalone-expect": ["error", { additionalTestBlockFunctions: ["test.prop", "it.prop"] }],
"vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "failWith"], additionalTestBlockFunctions: ["test.prop", "it.prop"] }],
"vitest/no-conditional-expect": "error",
"vitest/no-conditional-in-test": "error",
"vitest/no-disabled-tests": "error",
"vitest/no-focused-tests": "error",
"vitest/valid-expect": "error",
"vitest/no-identical-title": "error",
"vitest/no-restricted-matchers": ["error", {
  toBeTruthy: "Assert the concrete value.", toBeFalsy: "Assert the concrete value.",
  toBeDefined: "Assert the concrete value.", toMatchSnapshot: "No snapshots in domain tests.",
  toMatchInlineSnapshot: "No snapshots in domain tests.",
}],
```

4. **Protect locked tests and gate configs from the agent.** Deny `Edit|Write` on acceptance specs, `vitest.config.mts`, `stryker.config.mjs` and `vitest.setup.mts`. Mirror this in agy's `.agents/hooks.json`, and add a CI step that fails if a locked spec differs from the base branch. Per `06-agent-hooks.md`, this doesn't cover writes from Node or Python subprocesses. The CI diff is the backstop.
5. **fast-check for value objects with laws** (`Money`, `LocalDate`, `BirthDate`). A handful of properties per VO, next to BVA examples for invalid partitions. First fix: normalise `-0` in `Money` (`rounded + 0` or `Object.is(x, -0) ? 0 : x`) and keep the symmetry property. Add a non-blocking `FC_SEED=$RANDOM` job for exploration.

```ts
// vitest.config.mts
test: { setupFiles: ["./vitest.setup.mts"], exclude: [...configDefaults.exclude, ".stryker-tmp/**"] }
```

   Dev deps: `fast-check@4.10.2`, `@fast-check/vitest@0.3.0` (move to ≥ 0.4 only with vitest 4.1+).
6. **Coverage `perFile` ratchet**, as a cheap floor against deleted tests between Stryker runs:

```ts
coverage: { provider: "v8", include: ["src/**/*.mts"], exclude: ["src/**/__tests__/**", "src/sandbox/**"],
  thresholds: { perFile: true, autoUpdate: true, lines: 75, branches: 75 } }
```

   Never use it as the quality signal. §3 shows why.
7. **Use the surviving-mutant list as the evaluator's review input** for agy runs, replacing test counts. It is deterministic and points at exact lines.
8. **Skip:** the Stryker TypeScript checker (two `tsc` versions, no speedup at our size), `inPlace` mode, `prefer-strict-equal`, and a custom `--since` diff script (incremental already covers it).

## Sources

- StrykerJS: [incremental](https://stryker-mutator.io/docs/stryker-js/incremental/), [configuration](https://stryker-mutator.io/docs/stryker-js/configuration/), [vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/), [TypeScript checker](https://stryker-mutator.io/docs/stryker-js/typescript-checker/), [releases](https://github.com/stryker-mutator/stryker-js/releases) (v10.0.0, 2026-08-14). Installed package sources were read for the TS 7 behaviour.
- fast-check: [global settings](https://fast-check.dev/docs/configuration/global-settings/), [@fast-check/vitest README](https://github.com/dubzzz/fast-check/tree/main/packages/vitest).
- Vitest: [coverage config](https://vitest.dev/config/coverage).
- oxlint: [jest/no-standalone-expect](https://oxc.rs/docs/guide/usage/linter/rules/jest/no-standalone-expect) (the vitest options were verified in scratch; the page documents the jest variant).
- Claude Code: [hooks guide](https://code.claude.com/docs/en/hooks-guide).
- Papers: arXiv [2510.20270](https://arxiv.org/abs/2510.20270), [2608.30724](https://arxiv.org/html/2608.30724), [2605.21384](https://arxiv.org/abs/2605.21384), [2511.21654](https://arxiv.org/abs/2511.21654), [2510.25297](https://arxiv.org/abs/2510.25297), [2605.15229](https://arxiv.org/abs/2605.15229), [2602.07900](https://arxiv.org/abs/2602.07900). Anthropic [Claude Opus 4.5 system card](https://assets.anthropic.com/m/64823ba7485345a7/Claude-Opus-4-5-System-Card.pdf).
