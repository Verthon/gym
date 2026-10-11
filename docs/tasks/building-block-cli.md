# Building-block CLI

Created: 2026-10-08
Status: parked, resume with decision 3

## Goal

A CLI that generates the skeleton of each building block deterministically, so the coder runs one command per block and then fills in only what the spec asks for. The markdown in `docs/architecture/` stops being the source of the patterns. Templates are the rule, and the docs keep only the why. Follows P1 decision 1: rules are defended by code, not by undefended markdown. Input: `docs/research/tooling/05-scaffolding.md`.

## Coder workflow after this

1. From the spec, list the building blocks (unchanged, `implement-spec` step 1).
2. Per block: `pnpm gen <block> <dir> <Name>`. This writes the file and its spec with the fixed parts filled in.
3. Fill in what the spec asks for: rules in `create`, error codes, state union, behaviours, events, AC-driven tests.
4. `pnpm check`.

## Scope

New files only. Edits to existing files (adding an event to a union, wiring a repository into a service) stay with the agent. That's where every generator gets fragile (research §Bottom line).

| Command | Generates | Left to the coder |
|---|---|---|
| `vo` | Value Object + spec: private ctor, `create` returning `Result`, `equals` | rules in `create`, error codes, extra tests |
| `id` | Typed id (the `vo` template, string primitive) | format rules |
| `repo` | Repository port + in-memory adapter | extra query methods |
| `entity` | Entity shell: private ctor, `create`, event buffer, `pullEvents`, getters + spec | state union, behaviours, invariants |
| `events` | New `events.mts` with one event and its factory | further events |
| `service` | Application service: load → read `deps.clock` once → call → save | the domain call |

## Decisions

1. **Language: TypeScript.** Decided 2026-10-08.
   - `scripts/gen.mts`, run directly by Node.
   - Dependencies kept minimal and lightweight. Default is none: template literals for templates, `node:util` `parseArgs` for arguments, `node:fs` for writing. Any added package needs a reason the built-ins can't cover, and a small install footprint. Generator frameworks (plop, hygen, Yeoman, Nx) are out (research §1).
   - The doc-sync test imports the template functions in vitest directly.

## Rules and shortcuts

A building-block rule is the default, not an absolute. An architect may take a shortcut where the business justifies it, as long as the team knows why and what it costs. So:

- Docs state each rule as a default plus its reason. Don't write "never" or "always".
- The template generates the default. A shortcut is a deliberate edit after generation, never a template option the coder picks without a reason.
- Every shortcut is recorded with three things: where it applies, the business reason, and the consequences accepted (what breaks or gets harder, and when to revisit).
- A deviation that has no record is drift, and gets fixed.

## Decisions to make

2. **Typed id vs `string` in repositories.** `entity.md` says "Typed id Value Object, never a raw string". `repository.md:17` and `ContractDraftRepository.mts:4` use `get(id: string)`. The `repo` template will generate the typed id (the default). Before `repo`, decide:
   - whether `ContractDraftRepository`'s `string` is a deliberate shortcut (record why and the consequences) or drift (fix the code);
   - align `repository.md` with the default;
   - reword `entity.md` from "never" to the default plus its reason.
3. **Where shortcuts are recorded.** Options: an ADR per shortcut, a `## Shortcuts` section in the bounded context's `CONTEXT.md`, or a section in the building-block doc. It needs to be somewhere the coder and reviewer read, and checkable later (for example, a check that flags a raw-string id with no matching record).
4. **What stays in `docs/architecture/*.md`.** Proposal: the why, the rules a template can't express, and a `<!-- generated:start/end -->` block holding the exact template output. The doc-sync test keeps that block equal to the template.
5. **`it.todo` in spec templates** as a forcing function for rule tests. It conflicts with the post-run check "no `.todo`" (`coder-agent.md`), so either the coder must replace every todo, or the check changes.

## Guards

- **gen-check**: generate every block into a temp dir, then run `tsc` + oxlint + vitest on it. Catches API drift (renamed helper). Run it in `pnpm check` or pre-push.
- **doc-sync test**: each doc's generated block equals the template output. Catches convention drift (gen-check didn't catch a dropped `private readonly` in the research prototype).
- The generator refuses to overwrite an existing file.

## Next

1. [x] Decide 1 (language): TypeScript, minimal dependencies
2. [ ] Decide 2 (typed id in repositories) and 3 (where shortcuts are recorded). Reword "never"/"always" rules in `docs/architecture/` as defaults with reasons
3. [ ] `scripts/gen.mts` with `vo` / `id` + spec template, `pnpm gen` script. Prototype in research §"Output of `pnpm gen vo`"
4. [ ] Doc-sync test + replace the `PersonId`-based pattern in `value-object.md` with the generated block
5. [ ] gen-check, wired into `pnpm check` or pre-push
6. [ ] `repo`, then `entity`, then `events`, then `service`. Each step adds a template, a generated doc block, and a gen-check case
7. [ ] Update `implement-spec`: the Load on demand table becomes "run `pnpm gen <block>`, then read the doc only for rules the skeleton doesn't show". Add `pnpm gen` to the agy allow-list
8. [ ] Agy run with the generator vs baseline `bae7d36`: tokens, steps, doc/code conflicts reported
9. [ ] Decide 5 (`it.todo`) after run 8

## Resume

Parked 2026-10-08. Resume with decision 3 (where shortcuts are recorded). Leaning: a `## Shortcuts` section in the bounded context's `CONTEXT.md`. Business reasons are context-local and the coder already reads that file. An ADR per shortcut is too heavy and fits system-wide decisions better.
