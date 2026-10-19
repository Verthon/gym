# Spec-first workflow and ubiquitous language

Created: 2026-09-27
Status: in progress, resume with "Next"

## Goal

Spec, then implementation, so a cheaper model (e.g. Gemini) can do the coding against locked acceptance tests. Enforce the ubiquitous language in code instead of relying on undefended markdown.

## Decisions

1. Rules are defended by code and tests. Markdown holds only the why, open questions, and process.
2. Specs live in the repo: `docs/specs/<feature>.md`. No issue tracker.
3. Spec = acceptance criteria, not tests. Criteria have IDs (`AC-<X>-01`) and Given/When/Then.
4. Claude translates criteria into acceptance tests, and the user reviews them before implementation starts.
5. Acceptance tests go through one seam (use case), are locked for the coder, and carry AC IDs in their names. A check in `pnpm check` fails on AC IDs without tests and tests pointing to missing IDs.
6. The coder writes implementation tests below the seam freely. If an acceptance test looks wrong, it stops and reports.
7. Spec template (adapted from Pocock's to-spec): Problem · Solution · Seam (use case) · Commands (actor, preconditions, AC list) · Implementation decisions (type shapes allowed, no file paths) · Out of scope · Open questions (blocking/non-blocking). No "don't interview": open questions that affect a criterion block the spec.
8. Language lives in `src/contracting/CONTEXT.md` + `src/contracting/LANGUAGE.md` at the bounded-context level, not per stage. The `Avoid` column in `LANGUAGE.md` is what the vocabulary check reads.
9. Vocabulary check: start with a grep-based script in `pnpm check` that reads `Avoid` per `Stages` folder. Move to a custom oxlint rule only if false positives hurt.
10. Acceptance tests use a thin version of Farley's four layers (decided 2026-10-19): test cases in domain language → DSL → driver → system. The driver calls the use case in-process today and can switch to HTTP without changing test cases. Source: `~/Projects/advisors/research/testing-rules/raw/2026-10-18-acceptance-cd.md` rules 2, 4, 9 (Farley ATDD guide, read via archive copy; check before citing in an ADR).
11. All three test layers are locked as one set and approved together; the spec pins the use-case signature so the driver compiles against it (decided 2026-10-19, simplest option). Files sit in `__tests__/` with an `.acceptance.` infix (`<UseCase>.acceptance.spec.mts`, DSL and driver in one `<context>.acceptance.dsl.mts`), so lock and AC-ID check share one glob `**/*.acceptance.*` and no locked config changes. Acceptance tests fail on type-check until the coder creates the use case; `implement-spec` must say this red is expected.

## Next

1. [ ] Resolve naming conflicts in `src/contracting/LANGUAGE.md` → `## Open` (with the book at hand), fill `Avoid`, rename code
   - `userId` / `userInfo` / `PersonId` vs Potential Customer
   - `toNotSignedContract` vs Unsigned Contract
   - `recordPaymentAccepted` / `recordPaymentRejected` vs Payment Confirmed / Payment Failed
   - Contract Expired: define or drop
2. [ ] Write or obtain the `domain-modeling` skill. `grill-with-docs` calls it and it's missing here; `~/Projects/advisors/.agents/skills/domain-modeling/` exists, check it first. It should read and update `CONTEXT.md` / `LANGUAGE.md` in the affected scope and write ADRs
3. [ ] Decide: grilling skill asks the whole frontier per round, but the global rule is one decision at a time. Keep the override while it's invoked, or edit the skill
4. [ ] `to-spec` skill using the template from decision 7
5. [ ] Vocabulary check script + wire into `pnpm check`
6. [ ] AC-ID traceability check. Naming convention settled in decision 11 (`**/*.acceptance.*`)
7. [ ] Lock acceptance tests against coder edits: deny rules on `**/*.acceptance.*` (user commits `.claude/settings.json`), and add to `implement-spec` that acceptance tests start red on type-check. Until then the approval snapshot is `git add` of the acceptance files before the run, checked with `git diff -- '*.acceptance.*'` after. Gemini doesn't read `.claude/`
8. [ ] Trim the Contracting section of `docs/domain.md` (now in `CONTEXT.md` / `LANGUAGE.md`)
9. [ ] Rewrite `AGENTS.md` / `CLAUDE.md` around this workflow (see `harness.md` §3)

## First slice: prepare-contract (2026-10-19)

Spec `docs/specs/prepare-contract.md` (AC-PC-01..15, FR-C02 + FR-C05), committed in `a93be56`. Coder: Sonnet 5.5 subagent with `implement-spec`, ~72k tokens, 18 tool calls, no stop. Lock held, `pnpm check` and knip green, draft-stage mutation score 93.3%.

Open from the review:

1. The draft entity has an `Unsigned` status, duplicating the `unsigned-contract` stage. Caused by the spec putting the status query in the draft stage; arch forbids draft → unsigned imports. Decide how a stage hands over to the next.
2. Zero fee is untested (surviving mutant `ContractDraft.mts:36`, `< 0` → `<= 0`). FR-C05 implies zero passes; pin it in an AC or unit test.
3. `docs/architecture/repository.md` and `application-service.md` show `save(id, draft)` / `NOT_FOUND`; code now uses `save(draft)` keyed by a typed `ContractId`. Update the docs.
4. `knip.config.ts` still ignores `ContractDraftRepository.mts` and `ContractDraftService.mts` (hint only; locked file, user edits).
5. `stryker run --mutate <glob>` ran the whole tree; diff-scoped mutation needs another setup.
6. Spec template conflict: decision 7 says no file paths, but the locked driver needs one pinned module (`src/contracting/draft/index.mts`). Pin only what the driver imports; over-pinning exports made knip fail.

## Found along the way

- `package.json` has no `test` script (only `test:unit`), but `pnpm check` and pre-push call `pnpm test`. `harness.md` marks this done. Not verified by running it
- `harness.md` §3 refers to `GEMINI.md`, `WARP.md`, and `llm/`, which don't exist
- The `DomainEventPublisher` blocker in `harness.md` §1 looks resolved by the uncommitted event-publisher changes
