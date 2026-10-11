# 0001. Run the backend as TypeScript source on Node 24, with no build step

- Date: 2026-09-30
- Status: Proposed
- Superseded in part by: [0002](0002-node-26-temporal-and-injected-clock.md) replaces the Node 24 floor.

## 1. Circumstances

### Problem
A plain `tsc` run writes `X.mjs` next to each `X.mts` in `src/`.
Vitest then loads the old `.mjs` from disk instead of the `.mts` source.
Tests pass against stale code after an agent runs `pnpm build` once and then edits `.mts` files.
The separate `dist/` build also fails at runtime with `ERR_MODULE_NOT_FOUND: Cannot find package '@/utils'`.

### Constraints
- Current architecture: Node 24 is the floor. The backend runs on Node 24.21.0. Type stripping is stable from Node 24.12.0.
- Current architecture: tsc does not rewrite `paths` aliases such as `@/`. Node type stripping does not transform them either.
- Current architecture: the project has no current need for a single-file artifact.

## 2. Intention

### Quality attributes
- Agent guardrails: tests must always run against the current `.mts` source. Stale emitted files must not let wrong code pass the gates.
- Agent efficiency: tsc, vitest, tsx and Node must resolve the same module specifier. The agent learns one import form.

### Measure
- Agent guardrails: the pre-commit/CI guard finds 0 `*.mjs`/`*.js` files in `src/` that have a same-named `.mts`/`.ts` file.

## 3. Decision

### Chosen
Run the backend as TypeScript source on Node 24 with native type stripping. There is no build step.

- `tsconfig.json` sets `noEmit`.
- Node subpath imports (`"#/*": "./src/*"` in `package.json` `"imports"`) replace the `@/` path alias.
- `package.json` sets `engines.node` to `>=24.14`.
- The deploy contains `src/` and `node_modules`.
- The start command is `node src/index.ts`.

**Why:** No tool writes output next to the source, so tests cannot load stale files. One specifier form is valid in tsc, vitest, tsx and Node. `#/` is the shortest form and needs no extra path segment.

### Rejected alternatives
#### tsc emit to `dist/`
**Why rejected:** tsc does not rewrite `@/`, so the output fails at runtime. Emit next to the source made tests run against stale `.mjs` files.

#### `noEmit`, but keep the `@/` alias
**Why rejected:** Node does not transform tsconfig `paths`. `node src/index.ts` fails when it imports domain code.

#### Relative imports only, no alias
**Why rejected:** Deep `../../../` paths are a common source of agent errors. This works against agent efficiency.

#### `#src/*` subpath prefix
**Why rejected:** It works on all Node 24 versions, but it adds a path segment to every import. `#/` needs only Node 24.14.

#### Bundle with esbuild or tsdown
**Why rejected:** It adds a dependency and a build output that can go stale. The project has no current need for a single-file artifact.

## 4. Consequences

### Positive
- Agent guardrails: no emitted files exist, so vitest always loads the `.mts` source.
- Agent efficiency: one `#/` specifier works in tsc, vitest, tsx and Node.

### Trade-offs
- Node 24.0–24.13 cannot resolve `#/`. `engines.node` makes this fail early.

## 5. Evidence
- Probe: a `throw` in `Money.mts` with a stale `Money.mjs` present → tests pass.
- Node docs, *Modules: TypeScript*: tsconfig `paths` are not transformed. Use subpath imports.
- Node docs, *Packages*: `#/` subpath imports are allowed from v24.14.0. TypeScript supports them from 6.0.
- Scratch test: `#/` imports load in Node 24.21.0, tsc 7.0.2, tsx 4.7.1 and vitest 3.2.4.
