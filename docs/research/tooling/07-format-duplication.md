# Research: formatter, duplication and complexity tooling

Created: 2026-09-29
Input: the "deterministic tooling so the agent only does business logic" question, scoped to (a) formatting and (b) duplication and complexity.
Tags as in `agy-findings-research.md`: **[E]** evidence, **[V]** vendor guidance, **[O]** opinion (ours says "ours").
Measurements come from a scratch copy of the repo (36 `.mts`/`.ts` files, 2,680 lines, emitted `.mjs` removed). Machine: macOS arm64, Node 24.21. Tool versions: oxfmt 0.71.0, Biome 2.5.14, Prettier 3.9.9, dprint 0.57.4 (typescript plugin 0.95.13), jscpd 5.3.3, knip 6.38.0, oxlint 1.85.0.

## Bottom line

- **Use oxfmt.** It is beta, not 1.0. It formats `.mts`, runs in about 100 ms per file when called from a hook, comes from the same vendor as oxlint, and the oxc docs publish a ready-made Claude Code hook that runs `oxlint --fix` and then `oxfmt`. Set `useTabs: true, printWidth: 80`. That matches the majority style in the repo, and the output was within 22 changed lines of Prettier's across the whole tree.
- **The repo has already drifted.** 20 files use tabs and 16 use spaces. Two files contain a `return err(...)` that some agent left at column 0. A first format run touches 30 of 36 files, but 85% of the changed lines are indentation only. That is one commit plus `.git-blame-ignore-revs`.
- **Duplication is real, and it is in business code.** At default settings, jscpd finds 4 clones in production code (4.0%). The same "fee cannot exceed $X" guard is copied across `EnrollmentFee`, `PenaltyFee` and `MonthlyDues`. Gate on *new* clones using a baseline. A percentage threshold jumps about 1 point per clone on a repo this small.
- **Complexity limits cost nothing today.** Production code shows 0 violations at complexity 10 / depth 3 / params 4 / 50 lines per function. The only hits are `describe` blocks in tests. Adding the limits now is a free ratchet.
- **knip already runs, but local results are wrong.** `tsc` has no `outDir`, so `pnpm build` writes `.mjs` next to the sources. Tests import `./X.mjs`, knip resolves those imports to the emitted JS, and then reports 22 `.mts` files as unused (21 of them wrongly). With the emit removed, it reports 2 real findings. `--strict` is about dependencies, not stricter export checks, and `duplicates` means "exported twice", not code clones.

---

## 1. Formatter

### Status and compatibility (primary sources)

| Tool | Status (2026-09-29) | Prettier compatibility | `.mts` | Default width / indent |
|---|---|---|---|---|
| oxfmt | **Beta** since 2026-02-24. npm `latest` is 0.71.0 (2026-09-28). 1.0 is still pending: Prettier plugin support, embedded-language formatting, stability, perf ([Oxfmt Beta](https://oxc.rs/blog/2026-02-24-oxfmt-beta), Boshen, Dunqing, Yuji Sugiura / Oxc) [V] | "passes 100% of Prettier's JavaScript and TypeScript conformance tests" ([Oxfmt docs](https://oxc.rs/docs/guide/usage/formatter)) [V] | yes (measured) | 100 / spaces. Width deliberately differs from Prettier ([config docs](https://oxc.rs/docs/guide/usage/formatter/config.html)) |
| Biome | Stable (2.x) | "97% compatibility with Prettier" ([biomejs.dev](https://biomejs.dev/)). Deliberate deviations listed in [Differences with Prettier](https://biomejs.dev/formatter/differences-with-prettier/) [V] | yes (measured) | 80 / **tabs** ([Formatter](https://biomejs.dev/formatter/)) |
| Prettier | Stable reference | n/a | yes | 80 / spaces |
| dprint | Stable, wasm plugins ([dprint.dev](https://dprint.dev/overview/)) | Not a Prettier clone. Has its own style [V] | yes (measured) | per plugin |

Vendor speed claims [V]: oxfmt is ">30× faster than Prettier and 3× faster than Biome" on an uncached initial run (Oxfmt Beta post). Our repo is too small for those ratios to show.

### Measured on our `src/` (scratch copy)

First-format churn, with each tool configured to match the repo's majority style (tabs, double quotes, semicolons):

| Config | oxfmt | Biome | Prettier | dprint |
|---|---|---|---|---|
| tabs, width 80: files / lines changed | 30 / +1143 −1127 | 30 / +1143 −1125 | 31 / +1147 −1139 | 36 / +1254 −1211 |
| tabs, width 100 | 32 / +1060 −1223 | 32 / +1059 −1218 | 32 / +1063 −1229 | 35 / +1227 −1212 |
| defaults (no config) | 36 / +1233 −1396 (also formats `.md`) | 30 / +1143 −1125 | 36 / +1314 −1306 | 36 / +1359 −1353 |
| Differs from Prettier (tabs/80) | 5 files, 22 lines (union-type line breaks) | 6 files, 26 lines | — | whole-file style |

- Ignoring whitespace (`git diff -w`), the oxfmt tabs/80 run changes only **+180 −164** lines. The rest is re-indentation of the 16 space-indented files.
- oxfmt tabs/100 joins more lines (−347 non-whitespace). Width 80 is the smaller first diff.
- After the oxfmt run, the test suite gave the same result as before (45/45 tests pass; the 1 failing file is the `sandbox/locker` acceptance spec, which fails before formatting too). `oxfmt --check` then reports clean, so the output is stable.

Cost per file, as a hook would run it (`ContractDraft.spec.mts`, 326 lines, median of 10 runs after 2 warm-ups, npm bin shims included):

| Command | Median | Min |
|---|---|---|
| `oxfmt <file>` | 112 ms | 90 ms |
| `biome format --write <file>` | 102 ms | 83 ms |
| `dprint fmt <file>` | 43 ms | 35 ms |
| `prettier --write <file>` | 846 ms | 414 ms |
| `oxlint <file>` (our type-aware config), for comparison | 448 ms | — |

All except Prettier are negligible next to the oxlint pass the hook would already run.

### Why tools, not agents, should format

- [E] Pan, Sun, Zhang, Lo, Du, *The Hidden Cost of Readability* ([arXiv:2508.13666](https://arxiv.org/abs/2508.13666), ICSE 2026). Across 10 LLMs and 4 languages, removing formatting cut input tokens by 24.5% on average with no loss in performance. Prompting or fine-tuning models to emit unformatted code cut output length "up to 36.1% … without compromising correctness". Their proposal: the model works on unformatted code and a tool reformats the output. Formatting is pure overhead for the model, and a tool does it for free.
- [V] Anthropic, [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide), "Auto-format code after edits": a `PostToolUse` hook with matcher `Edit|Write` runs Prettier on the edited file, and hooks give "deterministic control: certain actions always happen rather than relying on the LLM to choose to run them." [Best practices](https://code.claude.com/docs/en/best-practices): "If Claude already does something correctly without the instruction, delete it or convert it to a hook." A style section in `AGENTS.md` is exactly that kind of instruction.
- [V] Oxc, [Coding agents](https://oxc.rs/docs/guide/usage/coding-agents.html): for Claude Code, a `PostToolUse` hook running `npx oxlint --fix --no-error-on-unmatched-pattern "$file"; npx oxfmt --no-error-on-unmatched-pattern "$file"`. For Codex, an `AGENTS.md` line ending in `oxlint --deny-warnings --format=agent`. `--format=agent` exists in our oxlint 1.85 (checked with `--help`).
- [E, ours] Diff noise in this repo: two files contain a `return err(...)` at column 0 inside a tab-indented method (`src/money/EnrollmentFee.mts:35`, `src/money/PenaltyFee.mts:69`), and the files are split 20/16 between tabs and spaces. No tool enforces style today, and it shows.
- **No good source found** for a controlled measurement of review-diff noise from agent formatting. The token argument above is the only quantified one.

### Plays with oxlint

- oxlint's `style` category is off in our config, so no lint rule can fight the formatter. [O, ours] Keep it off, and keep `style` rules out of any future config.
- oxfmt and oxlint share a vendor, a config style (`oxfmt.config.mts` is a supported config name, per the config docs) and Vite+ packaging. Biome would add a second vendor for no gain here. dprint is the fastest but produces its own non-Prettier style, and it needs a wasm plugin URL in the config.
- Open risk [O]: a `PostToolUse` rewrite changes the file after the agent's edit. The Claude Code guide documents this pattern, so we expect it to be handled. We have not measured how often it causes a stale-`old_string` re-read in agy. Check it in the next agy run.

## 2. Duplication

### Do agents create it?

- [E, vendor, correlational] GitClear, [*AI Copilot Code Quality: 2025*](https://www.gitclear.com/ai_assistant_code_quality_2025_research), 211M changed lines, 2020–2024: copy/pasted lines rose from 8.3% to 12.3%, refactored ("moved") lines fell from 25% to under 10%, and 2024 was the first year copy/paste exceeded moved code. Per GitClear, duplicated blocks grew about 4× (8× in the press summary). GitClear does **not** attribute individual lines to AI. The link is by time period only.
- [E, vendor, correlational] GitClear, [*The Maintainability Gap: 2026*](https://www.gitclear.com/the_ai_code_quality_maintainability_gap), 623M changes, 2023–2026: block duplication +81%, copy/paste at 15.7% of changed lines against moved/refactored at 3.8%. We read these figures from a fetched page summary, so re-check them before quoting.
- [E] Borg & Tornhill (CodeScene), *Code for Machines, Not Just Humans* ([arXiv:2601.02200](https://arxiv.org/abs/2601.02200), FORGE 2026): LLM refactoring breaks semantics more often on low Code Health code. The data is Python competitive-programming files. This is already noted in `lint-strictness.md` as not directly transferable to TS.
- [E, ours] In this repo, jscpd's production-code clones sit in `money/` and cover one business rule (a maximum-amount guard) repeated in three value objects. `SignedContract.mts` 45–54 and 56–65 is an AST near-clone (similarity ~1.00). Separately, knip flags `contracting/draft/FeeStructure.mts` as unused. It is a second `FeeStructure` class that parallels `money/FeeStructure.mts`.

### jscpd (Andrey Kucherenko, [github.com/kucherenko/jscpd](https://github.com/kucherenko/jscpd))

- [V] v5 is a Rust binary. It has an `ai` reporter ("~79% fewer tokens than console"), a built-in MCP server, and a `--baseline` + `--fail-on-new-clones` mode to "gate CI on *new* duplication only". v5 also adds `--similarity` (AST near-miss) and `--complexity`/`--health` reports.
- Measured (runtime under 30 ms):

| Scope | Setting | Clones | Duplicated lines |
|---|---|---|---|
| all `src` | default (= `-k 50`) | 10 | 5.1% |
| all `src` | `-k 30` | 41 | 14.7% |
| production (no `__tests__`) | default | 4 | 4.0% |
| production | `-k 70` / `-k 100` | 3 / 1 | 3.2% / 1.3% |
| production | `--similarity 0.85` | 6 | 7.0% |
| repo `src` as it is on disk (with emitted `.mjs`) | default | 17 | adds 7 JS clones of the same code |

- Thresholds on small repos [O, ours]. With 25 production files, one 19-line clone moves the percentage by about 1.3 points. A `--threshold 5` gate is either already failing or meaningless. A baseline plus `--fail-on-new-clones` expresses "don't add more" regardless of repo size. The default of 50 tokens caught the real rule duplication. 30 tokens mostly adds test setup noise.

## 3. Complexity limits (oxlint)

- [V] `eslint/complexity` is in oxlint (category restriction, default max 20). It counts optional chaining and default parameters as paths ([rule doc](https://oxc.rs/docs/guide/usage/linter/rules/eslint/complexity)). `max-depth`, `max-params`, `max-lines`, `max-lines-per-function`, `max-nested-callbacks`, `max-statements` and `max-classes-per-file` also ran without error under oxlint 1.85.
- Measured on our `src` (thresholds taken from Tune's published set in `lint-strictness.md`):

| Thresholds | Production violations | Test violations |
|---|---|---|
| complexity 10, depth 3, params 4, fn lines 50, file 300, nested callbacks 3, statements 20 | **0** | 9 (all `max-lines-per-function` on `describe` callbacks) |
| complexity 6, depth 2, params 3, fn lines 30, statements 12 | 11 (max observed complexity 10: `Money.fromMajor`) | not run |

- [O, ours] At the first set, the limits cost nothing today and stop the growth GitClear describes. The tighter set would already force refactors. That is where Böckeler's "many small units, many params" thrash starts (see `lint-strictness.md`).

## 4. knip extras

- [V] knip docs, [issue types](https://knip.dev/reference/issue-types): `duplicates` = "This is exported more than once". It is on by default, and it is **not** a code-clone check. `cycles` exists and defaults to `warn`.
- [V] [Production mode](https://knip.dev/features/production-mode): `--production` keeps only `entry`/`project` patterns ending in `!` and the `start` script, and ignores `@internal` exports. `--strict` checks dependency isolation and type-only imports and "implies `--production`". "The production run does not replace the default run."
- Measured (about 1 s per run):

| Run | Result |
|---|---|
| default, tree as on disk (emitted `.mjs` present) | **22 `.mts` files reported unused (21 false positives)**, 3 bogus unused exports in `Result.mjs`, 8 unresolved imports |
| default, emit removed | 2 unused files: `knip.config.js` (dead duplicate config; knip loads `knip.config.ts`) and `src/contracting/draft/FeeStructure.mts`. 4 unresolved imports (the `sandbox/locker` spec, whose production files don't exist yet) |
| `--production` / `--strict` | 23 unused files + `date-fns` unused: the domain isn't reachable from `src/index.ts` yet, so this mode is noise until HTTP wiring exists |
| `--include duplicates,cycles,nsExports,nsTypes,enumMembers` | 0 |

- Cause of the first row: `tsconfig.json` has no `outDir`, so `pnpm build` (also run in CI) emits `.mjs` beside every `.mts`. `package.json#start` expects `dist/index.js`, so the emit also breaks `start`. CI runs knip before build on a fresh clone and is unaffected. Local runs and agent runs are wrong whenever someone has built. oxlint also lints the emitted `.mjs` (5 extra `no-unused-vars` errors in the scratch copy).

---

## Applied to us (ranked by leverage vs cost)

1. **Stop `tsc` emitting into `src/`** (ours, [O]; cheapest, unblocks knip and jscpd). In `tsconfig.json` set `"outDir": "dist"` (`dist` is already gitignored), then delete the stray `src/**/*.mjs` and `src/index.js`. Delete `knip.config.js`.

2. **oxfmt with a Claude Code hook** (ours, [O]; about 100 ms per edit, and style instructions leave `AGENTS.md`).
   ```json
   // .oxfmtrc.json
   { "useTabs": true, "printWidth": 80, "ignorePatterns": ["**/*.md", "pnpm-lock.yaml"] }
   ```
   ```json
   // package.json scripts
   "format": "oxfmt", "format:check": "oxfmt --check"
   ```
   ```json
   // .claude/settings.json → hooks.PostToolUse (per oxc Coding agents docs)
   { "matcher": "Edit|Write",
     "hooks": [{ "type": "command",
       "command": "f=$(jq -r '.tool_input.file_path'); pnpm exec oxlint --fix --no-error-on-unmatched-pattern \"$f\"; pnpm exec oxfmt --no-error-on-unmatched-pattern \"$f\"" }] }
   ```
   - Land the one-time reformat as its own commit and add its SHA to `.git-blame-ignore-revs`.
   - Add `pnpm format:check` to pre-commit and CI. CI currently has no `lint` step either, so add both.
   - For agy: the documented events (see `agy-open-gaps-research.md` §7) have no per-tool post hook. Run `oxfmt` on `git diff --name-only` from a `PostInvocation`/`Stop` hook once the hook probe confirms hooks fire under `-p`. Until then, `pnpm check` should include `format:check` so drift fails loudly.

3. **Complexity limits at the zero-cost level** (ours, [O]).
   ```ts
   // oxlint.config.mts → rules
   "eslint/complexity": ["error", { max: 10 }],
   "eslint/max-depth": ["error", { max: 3 }],
   "eslint/max-params": ["error", { max: 4 }],
   "eslint/max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
   "eslint/max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
   // overrides for **/__tests__/**: "eslint/max-lines-per-function": "off"
   ```

4. **jscpd with a baseline, gating new clones only** (ours, [O]).
   ```json
   // package.json scripts
   "scan:dup": "jscpd src --ignore \"**/__tests__/**\" --reporters ai --baseline .jscpd-baseline.json --fail-on-new-clones"
   ```
   - Create the baseline once with `--update-baseline`, then run `scan:dup` in CI next to `scan:deadcode`.
   - The `ai` reporter output is short enough to return to an agent directly.
   - Don't use `--threshold` on a repo this size.

5. **Fix the flagged duplication by hand, not by rule** (ours, [O]). Decide whether the max-amount guard in `EnrollmentFee`/`PenaltyFee`/`MonthlyDues` belongs on `Money`, and whether `contracting/draft/FeeStructure.mts` should be deleted in favour of `money/FeeStructure.mts`. These are domain calls, not tooling ones.

6. **knip:** keep the default run in CI and set `rules: { cycles: "error" }` in `knip.config.ts`. Skip `--production`/`--strict` until `src/index.ts` reaches the domain. `duplicates` is already on.

Not recommended: Biome (second vendor, no measured gain over oxfmt), dprint (non-Prettier style, largest first diff), Prettier (8× slower per hook call), and CodeScene (paid; overlaps item 3 at this repo size).
