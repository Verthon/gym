# Research: tsc strictness and type-level enforcement on TypeScript 7

Created: 2026-09-29
Input: `tsconfig.json` (`strict: true` only), TypeScript 7.0.2, `docs/tasks/lint-strictness.md` (tsconfig checklist item), the untracked `.mjs` files next to every `.mts` in `src/`.
Tags as in `agy-findings-research.md`: **[E]** evidence (here: measured in a scratch copy of the repo), **[V]** vendor guidance, **[O]** opinion (ours says "ours").
Scratch copy: `/private/tmp/claude-501/-Users-verthon-Projects-gym/91e3d8f0-a4d7-4607-98a6-6e5f12b28b49/scratchpad/tsc-flags` (flag sweep, canary file) and `.../scratchpad/strip` (no-emit + subpath-import variant). No repo file other than this one was changed.

## Bottom line

- **The emit problem is a live test-correctness bug, not clutter.** Vitest resolves `import "../Money.mjs"` to the stale emitted `Money.mjs` when it exists, not to `Money.mts`. With a `throw` added to `Money.mts` and the old `Money.mjs` present, the suite passes. Without the `.mjs`, it fails. On the current working tree, 38 of 42 test files fail because the stale `.mjs` files also carry the unresolvable `@/` alias. `"noEmit": true` plus deleting the 36 emitted files fixes this. It is the highest-leverage change in this doc.
- **Most strictness flags cost zero errors on this codebase today.** `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `erasableSyntaxOnly`, `allowUnreachableCode: false`, `allowUnusedLabels: false` and `lib: es2025` each add 0 errors. The existing code already guards indexed access by hand (`FeeStructure.equals` uses `ai?.`, `Money` uses `??`). Turning them on now makes the compiler enforce what the reference code already does, so the agent can't drift from it.
- **`exactOptionalPropertyTypes` is the only flag with hits: 2 errors, one root cause, no bug.** Defer it. **`noUnusedLocals`/`noUnusedParameters`: skip.** oxlint's `no-unused-vars` already errors on the same cases and has options that tsc doesn't.
- **TS 7 tooling:** tsc-driven tools work (vitest `--typecheck`, `expectTypeOf`, ts-reset). Tools that need the compiler API don't. `type-coverage` 2.30.2 refuses to run on TS 7 and needs `@typescript/typescript6` side by side. It reports 99.66% here anyway, so skip it.

---

## 1. TS 7 changed defaults and removed options

[V] Daniel Rosenwasser (Microsoft), [*Announcing TypeScript 7.0*](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), 2026-07-08, and [*Announcing TypeScript 6.0*](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), which introduced the defaults and deprecations that 7.0 makes final:

| Option | TS 7 behaviour | Us |
|---|---|---|
| `strict` | `true` by default | set explicitly; keep it (documents intent) |
| `target` | current ES year (`es2025` per `tsc --help --all` on 7.0.2) | `ESNext`; irrelevant once `noEmit` |
| `module` | `esnext` | `NodeNext`, correct for Node |
| `types` | `[]`, no auto-inclusion of `@types/*` | set to `["node", "vitest/globals"]`, so unaffected |
| `rootDir` | `.` (tsconfig dir), not inferred | matters only if we emit. A build config must set `rootDir: "src"` or output lands in `dist/src/` |
| `noUncheckedSideEffectImports` | `true` | nothing to do |
| `stableTypeOrdering` | on, cannot be turned off | nothing to do |
| `esModuleInterop`, `allowSyntheticDefaultImports` | cannot be `false` | nothing to do |
| Removed | `target: es5`, `downlevelIteration`, `baseUrl`, `moduleResolution: classic` and `node`/`node10`, `module: amd/umd/systemjs/none`, `outFile` | none used. `paths` works without `baseUrl` (verified: tsc resolves `@/` today) |
| API | none in 7.0; a new, different API expected in 7.1. Run TS 6 side by side via `@typescript/typescript6` | see §4 |

[E] `tsc --showConfig` on our config shows `isolatedModules: true` already implied by `verbatimModuleSyntax`. The canary (§2) shows `useUnknownInCatchVariables` already active under `strict` (`catch (e) { e.message }` → TS18046 with no extra flag). Neither needs adding.

[V] TS 6.0 also added support for `"#/*"` subpath imports, which matters for §3.

## 2. Flag sweep on this codebase

Method [E]: `tsc --noEmit --pretty false --<flag>` one flag at a time, counting `error TS` lines. The untracked `src/sandbox/locker` acceptance spec has 8 errors in every run: it is the agy fixture, red by design with its modules missing. Those 8 are excluded below. To confirm each flag actually fires under tsgo, a canary file with one deliberate violation per flag was also checked. All of them fired.

| Flag | New errors on repo | Real bug or noise | Overlap | Recommendation |
|---|---|---|---|---|
| `noUncheckedIndexedAccess` | 0 | n/a. Code already guards by hand (`FeeStructure.mts:98-100`, `Money.mts:28`) | none in oxlint | **enable** |
| `noImplicitOverride` | 0 | n/a, no inheritance yet | none | **enable** (free guard for when a base class appears) |
| `noImplicitReturns` | 0 | n/a | oxlint `typescript/consistent-return` (suspicious, already error) caught the canary too | **enable**. Cheap, and tsc runs in CI where oxlint's type-aware pass also runs |
| `noFallthroughCasesInSwitch` | 0 | n/a. Both `switch`es in `UnsignedContract.mts` return per case | oxlint `eslint/no-fallthrough` is `pedantic`, not enabled; did **not** catch the canary | **enable** |
| `noPropertyAccessFromIndexSignature` | 0 | n/a | oxlint `typescript/dot-notation` (style, off) conflicts with it unless configured | **enable** (ours, [O]: with `noUncheckedIndexedAccess`, `obj["key"]` shows at the call site that the key may be missing) |
| `erasableSyntaxOnly` | 0 | n/a. No enums, namespaces or parameter properties in `src/` | none | **enable**. Required for Node type stripping (§3) |
| `allowUnreachableCode: false` / `allowUnusedLabels: false` | 0 / 0 | n/a | oxlint `eslint/no-unreachable` and `eslint/no-unused-labels` (both correctness, already on) | enable. It turns tsc's default editor suggestions into errors, and since oxlint already covers both, this is belt and braces |
| `lib: es2025` (from `es2022`) | 0 | n/a | none | **change**. `es2022` hides `toSorted`, `Object.groupBy` and the Set methods that Node 24 has, so the agent gets false type errors |
| `exactOptionalPropertyTypes` | **2** | Not a bug. `SignedContract.mts:58` and `:60` pass `reason: args.reason` (possibly `undefined`) into `{ reason?: string }`. That puts an explicit `undefined` key into state and the event instead of omitting it. Only `toStrictEqual`, `in` or `Object.keys` can see the difference | none | **defer** (ours, [O]). Every optional pass-through then needs a conditional spread, which is friction on each agent task for a distinction our domain doesn't use yet. Revisit when the Postgres mapping or a validation library defines what "absent" means |
| `noUnusedLocals` | 0 | n/a | oxlint `no-unused-vars` (correctness, error) caught the same canary | **skip**. It would report the same thing twice, and during WIP edits it turns type-check red for the same cause lint already reports |
| `noUnusedParameters` | 0 | n/a | same, and ours has `args: "after-used"` plus `ignoreRestSiblings`, which tsc can't express | **skip** |
| `rewriteRelativeImportExtensions` | 0 alone | n/a | conflicts with `#src/*.mts` imports (TS2877 "not a relative path") | **don't use**; `allowImportingTsExtensions` + `noEmit` instead (§3) |
| `isolatedDeclarations` | config error TS5069 | needs `declaration`/`composite` | n/a | **skip**. It's for publishing libraries |
| `checkJs` | 448 | noise, all from the stale emitted `.mjs` | n/a | **skip** |
| All "enable" rows together | **0** | | | verified as one config; vitest 10/10 files green, oxlint unchanged |

[E] `oxlint.config.mts` has `typeCheck: true`, so oxlint re-reports tsc diagnostics (the sandbox's TS18046 appears in both `pnpm lint` and `pnpm type-check`). Any tsconfig flag therefore shows up twice in the pre-commit output. That's harmless, but it is another reason not to add `noUnused*`, which would make the same finding appear up to three times.

**@tsconfig/strictest** 2.0.8 ([source](https://github.com/tsconfig/bases/blob/main/bases/strictest.json), maintained by the `tsconfig/bases` project) is exactly the 11 flags above plus `isolatedModules`, `esModuleInterop` and `skipLibCheck`. Don't `extends` it (ours, [O]): it brings in `exactOptionalPropertyTypes` and both `noUnused*`, which we reject above. It also adds a dependency whose contents can change on minor bumps (2.0.8 published 2026-09-24). Copy the subset instead.

## 3. The emit problem

**What's happening [E].**

- `tsconfig.json` has no `outDir` and no `noEmit`, and `package.json` has `"build": "tsc"`. Any plain `tsc` run writes `X.mjs` next to every `X.mts` (36 files, timestamped 2026-09-29 13:18).
- `vitest list` then collects every spec twice (`.spec.mts` and `.spec.mjs`).
- Worse, the `.spec.mts` imports `../Money.mjs` and Vite loads the real `Money.mjs` from disk instead of mapping it to `Money.mts`.
- Probe: append `throw new Error(...)` to `Money.mts` with the old `Money.mjs` present → `src/money` tests **pass**. Remove the `.mjs` → they fail with the throw.
- An agent that runs `pnpm build` once and then edits `.mts` files gets green tests against stale code.
- **The build output doesn't run either.** A separate `tsconfig.build.json` (`outDir: dist`, `rootDir: src`, tests excluded) compiles cleanly. But `node` then fails on `dist/money/EnrollmentFee.mjs` with `ERR_MODULE_NOT_FOUND: Cannot find package '@/utils'`, because tsc never rewrites `paths` aliases. `"start": "node dist/index.js"` works today only because `index.ts` imports no domain code.

**Vendor guidance [V].**

- Node.js docs, [*Modules: TypeScript*](https://nodejs.org/api/typescript.html): type stripping is stable in v24.12.0 (we run 24.21.0). The recommended config is `noEmit`, `erasableSyntaxOnly` and `verbatimModuleSyntax`. File extensions in specifiers are mandatory. "`tsconfig` "paths" won't be transformed and therefore produce an error"; use subpath imports (`#…`) instead.
- TSConfig reference, [`allowImportingTsExtensions`](https://www.typescriptlang.org/tsconfig/#allowImportingTsExtensions): "only allowed when `--noEmit` or `--emitDeclarationOnly` is enabled".

**Two fixes, both verified in scratch.**

- **A. Minimal: stop emitting.**
  - Add `"noEmit": true` and delete the 36 `.mjs`/`.js` files that have a `.mts`/`.ts` sibling.
  - `pnpm build` becomes a second type-check. Drop the CI "Build" step, or keep it as a no-op until there is something to build.
  - `node src/index.ts` boots and serves `/health` [E], so `"start": "node src/index.ts"` replaces `dist/`.
  - Cost: minutes.
- **B. Full: run source directly.**
  - Replace `@/x.mjs` with `#src/x.mts` and relative `.mjs` with `.mts` (mechanical sed over `src/`).
  - Add `"imports": { "#src/*": "./src/*" }` to `package.json`.
  - Swap `paths` for `allowImportingTsExtensions` + `noEmit`, and drop `vite-tsconfig-paths`.
  - Results [E]: tsc 0 errors, vitest 10/10 files, knip and oxlint output identical to before; `node` and `tsx` both load `#src/money/FeeStructure.mts`. `rewriteRelativeImportExtensions` does **not** work here: TS2877 on every `#src/` import, because it only rewrites relative paths.
  - Cost: one sweep, plus updating the docs and skills that name `@/utils/test.mjs` (`docs/tasks/coder-agent.md`, `agy-dry-run.md`). `docs/tasks/architecture-check.md` must also check that dependency-cruiser resolves `#src/`; that wasn't tested here.
  - Payoff: no build step to go stale, and one module specifier form that is valid in tsc, Vite, tsx and Node.

**Guard either way (ours, [O]).** Add a pre-commit/CI check that fails if `src/` contains any `*.mjs`/`*.js` next to a same-named `.mts`/`.ts`. `noEmit` stops our own scripts from emitting, but an agent running `tsc --outDir .` or an old branch could still bring the files back, and vitest won't warn when it happens.

## 4. Tools around tsc on TS 7

- **Type-level tests work [E].**
  - `expectTypeOf` assertions in any file inside the tsc program fail `pnpm type-check` directly: a probe `expectTypeOf<string>().toEqualTypeOf<number>()` gave TS2344.
  - `vitest run --typecheck.only` also works with 7.0.2. [V] [Vitest docs](https://vitest.dev/guide/testing-types): "Under the hood Vitest calls `tsc` … and parses results". The `tsc` binary is tsgo, so there's no API dependency. Default include is `*.test-d.ts`.
  - Our tsconfig includes the specs, so no separate typecheck mode is needed. Plain `expectTypeOf` in `.spec.mts` is enforced by the existing pre-commit hook.
  - Use (ours, [O]): pin value-object guarantees the agent could erode, e.g. `expectTypeOf<string>().not.toMatchTypeOf<PersonId>()`, and that `create` returns `Result<…>`.
- **type-coverage: skip.** [E] 2.30.2 (published 2026-09-28) exits with "needs the TypeScript compiler API (ts.createProgram), which typescript@7.0.2 does not export" and points to [issue #147](https://github.com/plantain-00/type-coverage/issues/147). With the override it suggests (`type-coverage-core` → `npm:@typescript/typescript6@^6`) it runs and reports **99.66%** (3924/3937, sandbox excluded). The misses are all test fixtures and one `test.mts` helper. That doesn't justify a second compiler in the tree. The same class of problem (`any` flowing through) belongs to oxlint's type-aware `typescript/no-unsafe-*` rules (category `pedantic`, not enabled), which is `lint-strictness.md` territory.
- **ts-reset: works, low value now.** [E] `@total-typescript/ts-reset` 0.6.1 (last release 2024-09-02, Matt Pocock / Total TypeScript) is pure `.d.ts` and works under tsgo: `JSON.parse` → `unknown`, `.filter(Boolean)` narrows, and `includes` on readonly tuples accepts `string`. On this repo it adds 3 errors, all in `GovernmentIdInfo.spec.mts:78-91`, where a test uses `JSON.parse`'s `any` deliberately to feed bad input. Those errors are noise: the fix is an explicit cast. Reconsider at the HTTP boundary (ours, [O]), but note that it doesn't cover Hono's `c.req.json()`, which is where untrusted input will actually enter.

## Applied to us (ranked leverage vs cost, ours [O])

1. **`noEmit: true` + delete emitted files + stale-`.mjs` guard** (§3 A). Highest leverage: tests currently can't be trusted after any `tsc` run. Cost: minutes.
2. **The zero-error flags**: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `erasableSyntaxOnly`, `allowUnreachableCode: false`, `allowUnusedLabels: false`. They cost nothing today, and every new file the agent writes has to meet them. Once the code grows, enabling them means a migration.
3. **`lib: ["es2025"]`**. Removes false errors on APIs Node 24 has. Zero cost.
4. **Subpath imports + Node type stripping** (§3 B). Removes the build step and the latent `@/` runtime break. Cost: one mechanical sweep plus doc updates. Do it before persistence code multiplies the imports.
5. **`expectTypeOf` for value-object brands** in existing specs. Small, and enforced by the current type-check.
6. **Defer:** `exactOptionalPropertyTypes` (2 errors, no bug), ts-reset.
7. **Skip:** `noUnusedLocals`/`noUnusedParameters` (oxlint covers them), `@tsconfig/strictest` as `extends`, `type-coverage`, `isolatedDeclarations`, `rewriteRelativeImportExtensions`.

## Proposed `tsconfig.json` diff (items 1–3)

Verified as a whole in scratch: 0 errors outside `src/sandbox`, no files emitted, vitest 10/10 files green, oxlint unchanged.

```diff
 {
   "compilerOptions": {
     "target": "ESNext",
     "module": "NodeNext",
     "strict": true,
     "verbatimModuleSyntax": true,
+    "erasableSyntaxOnly": true,
+    "noEmit": true,
+    "noUncheckedIndexedAccess": true,
+    "noImplicitOverride": true,
+    "noImplicitReturns": true,
+    "noFallthroughCasesInSwitch": true,
+    "noPropertyAccessFromIndexSignature": true,
+    "allowUnreachableCode": false,
+    "allowUnusedLabels": false,
     "skipLibCheck": true,
     "jsx": "react-jsx",
     "jsxImportSource": "hono/jsx",
 
     /* If your code doesn't run in the DOM: */
-    "lib": ["es2022"],
+    "lib": ["es2025"],
     "paths": {
       "@/*": ["./src/*"]
     },
```

Companion changes outside `tsconfig.json`, for item 1:

- `package.json`: `"build"` → remove, or alias to `type-check`; `"start": "node src/index.ts"`.
- CI: drop the "Build" step.
- Delete the `src/**/*.mjs` and `src/index.js` files that have TS siblings.

For item 4, additionally:

- replace `paths` with `"allowImportingTsExtensions": true`;
- add `"imports": { "#src/*": "./src/*" }` to `package.json`;
- remove `vite-tsconfig-paths` from `vitest.config.mts`.
