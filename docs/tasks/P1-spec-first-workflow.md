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

## Next

1. [ ] Resolve naming conflicts in `src/contracting/LANGUAGE.md` → `## Open` (with the book at hand), fill `Avoid`, rename code
   - `ContractActivated` vs "Contract started"
   - `userId` / `userInfo` / `PersonId` vs Potential Customer
   - `toNotSignedContract` vs Unsigned Contract
   - `recordPaymentAccepted` / `recordPaymentRejected` vs Payment Confirmed / Payment Failed
   - Contract Expired: define or drop
2. [ ] Write or obtain the `domain-modeling` skill. `grill-with-docs` calls it and it's missing. It should read and update `CONTEXT.md` / `LANGUAGE.md` in the affected scope and write ADRs
3. [ ] Decide: grilling skill asks the whole frontier per round, but the global rule is one decision at a time. Keep the override while it's invoked, or edit the skill
4. [ ] `to-spec` skill using the template from decision 7
5. [ ] Vocabulary check script + wire into `pnpm check`
6. [ ] AC-ID traceability check + naming convention that separates acceptance tests from implementation tests
7. [ ] Lock acceptance tests against coder edits (hook + git-level check for `.skip` / `.only` / deleted tests; Gemini doesn't read `.claude/` hooks)
8. [ ] Trim the Contracting section of `docs/domain.md` (now in `CONTEXT.md` / `LANGUAGE.md`)
9. [ ] Rewrite `AGENTS.md` / `CLAUDE.md` around this workflow (see `harness.md` §3)

## Found along the way

- `package.json` has no `test` script (only `test:unit`), but `pnpm check` and pre-push call `pnpm test`. `harness.md` marks this done. Not verified by running it
- `harness.md` §3 refers to `GEMINI.md`, `WARP.md`, and `llm/`, which don't exist
- The `DomainEventPublisher` blocker in `harness.md` §1 looks resolved by the uncommitted event-publisher changes
