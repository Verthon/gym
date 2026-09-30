# Resume prompt: architecture drivers and ADR 0001

Paste this into a new session.

---

We are defining architectural drivers and recording ADRs. Ask one question at a time. Keep every file short. ADRs stay self-contained: no links to other docs, evidence goes inline.

## Agreed so far (2026-09-30)

**Purpose:** a learning and showcase project for DDD, plus an LLM-friendly API boilerplate that other API projects can reuse. The domain follows the book (Jedrzejewski) and stays in the repo.

**`architecture/quality-attributes.md`** (done, ranked, the higher attribute wins a conflict):
1. Agent guardrails: every agent failure pattern in `docs/tasks/agy-findings.md` has a gate that blocks it, not only a prose rule.
2. Agent efficiency: an agent finishes a scoped task with 0 corrective prompts.
3. Reusability: an experiment. Every recurring building block (value object, entity, repository, spec) has a CLI generator, Angular-style, and agents use it.

**`architecture/adr/0001-run-typescript-source-on-node-24.md`** (status Proposed):
- Chosen: run the TS source on Node 24 with type stripping and no build step. `tsconfig` sets `noEmit`. Imports use `"#/*": "./src/*"`. `engines.node` is `>=24.14`. The deploy ships `src/` + `node_modules`. The start command is `node src/index.ts`.
- Rejected: tsc emit to `dist/`; `noEmit` but keep `@/`; relative imports only; the `#src/*` prefix; bundling with esbuild or tsdown.
- Verified: Node docs (`paths` not transformed; `#/` from v24.14.0), TypeScript 6.0 supports `#/`, and a scratch test passed on Node 24.21, tsc 7.0.2, tsx 4.7.1 and vitest 3.2.4.
- Cross-checked with mcollina/skills `node` skill: its dev tsconfig matches ours. Its `dist/` build is only for publishing npm packages. It says nothing about bundling or deploy.

**Rejected from the external research:** the compile cache, `pnpm deploy --prod`, and startup time as a quality attribute. None of them matches a current driver, and there is no deploy setup yet.

## Open, in this order

1. **Bundler rejection is parked.** It needs better research. The question: can a bundled Node API drop `node_modules` in practice, given native modules and dynamic imports? The current lead: esbuild recommends `--packages=external` for apps, and tsdown describes itself as a library bundler.
2. **Agent efficiency has no measure in ADR 0001.** The candidate is 0 `@/` or `.mjs` imports in agent-written code, or keep it with no measure.
3. **`constraints.md`:** Node 24.14 floor, solo developer, and a weaker coder model as the main author. Then check ADR 0001 against it.
4. **Done 2026-09-30:** `#/` + `.mts` imports applied, `@/` and `vite-tsconfig-paths` removed, `engines.node >=24.14.0`, `.nvmrc` v24.21.0, `prepare` safe without `.git`, lint step in CI. Agent-facing docs updated; run logs (`agy-dry-run.md`, `agy-run-2.md`) left as history.
5. **Untested:** whether dependency-cruiser resolves `#/`.
6. **Not built yet:** the pre-commit/CI guard for stale `.mjs`/`.js` next to `.mts`/`.ts`. ADR 0001's measure depends on it.
7. **Measure gap:** nothing records corrective prompts per interactive session, so the measure for attribute #2 is not tracked yet.
