# Research: custom lint rules for this repo's DDD conventions

Created: 2026-09-29
Input: `docs/architecture/*.md`, `src/contracting/CONTEXT.md`, `LANGUAGE.md`, the `src/` code, and the open item "Role rules for DDD building blocks … Prototype one as a custom oxlint rule" in `docs/tasks/lint-strictness.md` §4.
Tags as in the earlier docs: **[E]** evidence, **[V]** vendor guidance, **[O]** opinion (ours says "ours").
Sources already cited in `agy-findings-research.md` and `agy-open-gaps-research.md` are not repeated. Tune and Böckeler appear in `lint-strictness.md` only as "pasted, not re-verified"; the passages quoted here were read at the source.
Scratchpad: a copy of the repo with the prototypes, run on 2026-09-29 against the 35 `.mts` files in `src/` (23 non-test). No repo file other than this one was changed.

## Bottom line

- **Use ast-grep for single-file shape rules, and oxlint JS plugins for rules that need a multi-range autofix or should live in `pnpm lint`.** Both work with TS 7 because neither loads `typescript`. ast-grep scanned `src/` in 49 ms (median of 7). Adding the JS plugin to oxlint raised its run from 552 ms to 717 ms.
- **Semgrep and ESLint are out.**
  - Semgrep's TypeScript target covers only `.ts`/`.tsx`. It skipped every `.mts` file, reported `scanned: []` and exited 0.
  - `@typescript-eslint/parser` 8.70.1 refuses TS 7 at startup ("typescript-eslint does not support TS 7.0.").
- **Cross-file conventions need vitest structural tests.** Examples: `events.mts` next to each entity, and repository implementations kept out of the domain folder. Our prototype uses `oxc-parser` (no `typescript` dependency), runs in about 40 ms and puts the fix text in the assertion message.
- **The prototypes found 77 violations in 23 files. Every one was a true positive against the written conventions, and there were no false positives.**
  - 65 of them are mechanical and autofixable: `ok()`/`err()` helpers and the `Result<T, E>` alias.
  - 12 are design defects:
    - string errors in `draft/FeeStructure.mts` and `UnsignedContract.mts` (8);
    - silent `return;` on invalid state in `SignedContract.mts` (3);
    - an infrastructure class next to the port in `ContractDraftRepository.mts` (1).
  - `SignedContract.mts` is listed as a reference implementation in `entity.md`, yet it contradicts that doc's own pattern.
- **The rule message is the fix instruction.** [O, ours] Put the convention's source file, the exact target shape and the import line in the message. Use ast-grep `--report-style medium`, which prints `message` plus `note` on about 7 lines per hit. The default `rich` style prints source excerpts, which cost tokens without helping the agent.
- **Two built-in oxlint rules do part of this for free.**
  - `typescript/explicit-module-boundary-types` flagged exactly the entity methods that lack a `Result` return (5 hits).
  - `no-restricted-globals` on `Date` enforces "never expose JS Date in domain" (0 domain hits today).

---

## 1. Conventions that can be checked

Taken from `docs/architecture/*.md` and the reference files. Tool = cheapest tool that can enforce it (ours, [O]).

| # | Convention | Source | Scope | Tool | Today |
|---|---|---|---|---|---|
| 1 | Failing operations return `Result<T, E>` built with `ok()`/`err()` | building-blocks.md, value-object.md | single file | ast-grep (autofix) | 65 violations, 11 files |
| 2 | Errors are a union of `{ code }` objects | value-object.md | single file | ast-grep / oxlint plugin | 8 violations, 2 files |
| 3 | Entity methods check invariants and return `Result` when they can fail | entity.md | single file | ast-grep / oxlint plugin + built-in `explicit-module-boundary-types` | 3 silent returns, 5 missing return types |
| 4 | Private constructor + static factory | value-object.md, entity.md | single file | ast-grep or structural test | 1 violation (`InMemoryContractDraftRepository`) |
| 5 | No `throw` in domain | building-blocks.md (via Result), repository.md (only infra throws) | single file | ast-grep | 0 |
| 6 | No JS `Date` in domain, only `LocalDate` | `LocalDate.mts` header comment | single file | built-in `no-restricted-globals` | 0 outside `LocalDate.mts` |
| 7 | Entity events in `events.mts` in the same folder | events.md rule 5 | cross-file | structural test | 0 |
| 8 | Application service = `export const x = (deps) => async (input) => Result` | application-service.md | single file | structural test or ast-grep | 0 |
| 9 | Repository implementations live in infrastructure | repository.md | cross-file (placement) | structural test / dependency-cruiser | 1 (same as #4) |
| 10 | Event type is `Readonly<{ type; occurredAt; payload }>` | events.md | single file | ast-grep | not prototyped |
| 11 | VO fields `private readonly`, no setters; `equals` present | value-object.md | single file | ast-grep | not prototyped |
| 12 | Typed id VO, never raw string | entity.md | needs judgement | none. `repository.md`'s own pattern uses `get(id: string)` | conflict in docs |

Item 12 conflicts with `repository.md`, so the docs need a decision before a rule can exist.

## 2. Tool comparison

| | ast-grep 0.45.3 | oxlint 1.85 JS plugin | Semgrep 1.136 | ESLint 10 + typescript-eslint 8.70 | vitest structural test |
|---|---|---|---|---|---|
| TS 7 | works (tree-sitter, no `typescript`) | works (oxc parser) | parser OK, **skips `.mts`** | **refuses TS 7** | works with `oxc-parser` |
| Run time on `src/` (median of 7) | 49 ms | +165 ms over 552 ms baseline | 3.3–3.6 s (1 rule) | n/a | ~40 ms test time, ~1.2 s vitest start |
| Rule format | YAML pattern + relational rules | JS ESTree visitor | YAML pattern | JS ESTree visitor | plain TS |
| Fix | yes, single-range rewrite with metavariables | yes, multi-range (can add the import) | yes, single-range | yes | no |
| Rule tests | `ast-grep test`: valid/invalid YAML + snapshots | `RuleTester` from `oxlint/plugins-dev`, runs under vitest | `semgrep --test`, `ruleid:`/`ok:` comments | `RuleTester` | the test is the rule; needs a non-empty-scope assertion |
| Type info | no | no custom type-aware rules | no | yes (the reason it breaks) | no (unless TS 7.1 API) |
| Suppression | `// ast-grep-ignore: id`; unused ones reported | `oxlint-disable` + our `reportUnusedDisableDirectives: "error"` | `// nosemgrep` | `eslint-disable` | none (edit the test) |
| Status | pre-1.0, last release 2026-08-31 | **alpha** | GA for TS | stable, TS 7 blocked | n/a |

### ast-grep

- [V] ast-grep docs, [rule config reference](https://ast-grep.github.io/reference/yaml.html):
  - `message` is the "Main message highlighting why this rule fired. It should be single line and concise, but specific enough to be understood without additional context."
  - `note` gives "Additional notes to elaborate the message and provide potential fix to the issue". Markdown is allowed, but `note` can't use meta-variables.
  - `severity` is one of `hint | info | warning | error | off`.
- [V] ast-grep docs, [testing rules](https://ast-grep.github.io/guide/test-rule.html):
  - Test files hold `valid` and `invalid` code lists.
  - Each case is reported as Reported / Validated / **Noisy** (false positive) / **Missing** (false negative).
  - Snapshots store message, span and labels.
- [V] ast-grep docs, [languages](https://ast-grep.github.io/reference/languages.html): TypeScript covers `ts`, `cts`, `mts`.
- [E, ours] What we saw in the scratchpad:
  - **Exit code.** An `error` diagnostic gives exit 1, so ast-grep can gate hooks and CI.
  - **Test harness.** Deleting the `not inside arrow_function` guard from one rule turned its test into `FAIL … [Noisy]`, so the harness does catch regressions.
  - **Unused suppressions.** An unused `// ast-grep-ignore` is reported as `help[unused-suppression]`.
- [E, ours] Pitfalls we hit:
  - **Leading `|` in a union.** Formatters write `| A | B`, and tree-sitter parses that as a nested union, so the one-line pattern missed 12 of 17 cases. It took a second pattern with the leading `|` to catch them.
  - **Install approval.** pnpm 12 blocks `@ast-grep/cli`'s postinstall until it is added to `allowBuilds`.
  - **Silent empty scope.** A `files:` glob that matches nothing exits 0. That is the same empty-scope trap `architecture-check.md` records for dpdm.
- [E, ours] **Autofix result.** `ast-grep scan -U` applied 65 rewrites. After a script added the missing `import { ok, err, type Result }` lines, tsc showed 4 new errors and 45/45 tests passed. All 4 errors were in `ContractDraft.mts`: its return type isn't a plain success/error union, so no rewrite applied there, and `err({ code: "…" })` widened `code` to `string` against the declared union. That is a real follow-up, not a bug in the rewrite. ast-grep's `fix` can't insert the import, because it only rewrites the matched node.

### oxlint JS plugins

- [V] Oxc, [JS Plugins docs](https://oxc.rs/docs/guide/usage/linter/js-plugins.html): "JS plugins are currently in alpha, and remain under active development." Also: "All APIs should behave identically to ESLint." Type-aware custom rules are not supported.
- [V] overlookmotel and Cameron (Oxc core team), [*Oxlint JS Plugins Alpha*](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html) (2026-03-11):
  - "we expect 80% of ESLint users can now switch to Oxlint and have it 'just work'."
  - Known limits: "No custom type-aware rules", plus weaker support for Windows and custom file formats.
- [V] Oxc, [Writing JS plugins](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html):
  - `createOnce` is the faster alternative to `create`.
  - `RuleTester` is imported from `oxlint/plugins-dev`.
  - The `before` hook is "NOT guaranteed to run on every file".
- [E, ours] What we saw with oxlint 1.85 and `typeAware: true`:
  - **Output.** The plugin loads from `jsPlugins` in `oxlint.config.mts` and its diagnostics appear inline with the built-in ones, in the same format.
  - **Tests.** `RuleTester` runs under vitest 3.2 with `parserOptions: { lang: "ts" }`: 10 cases in 12 ms. A deliberately wrong `valid` case failed with "Should have no errors but had 1".
  - **Fixes.**
    - A multi-range fix (rewrite plus inserted `import { err }`) works.
    - Two fixes that insert the same import conflict, so the second hit needs a second `--fix` pass.
    - ESLint re-runs fixes automatically. We didn't check whether oxlint does. In our run it didn't.
  - **Same hits as ast-grep.** For the 2 ported rules, oxlint reported the same 11 hits as ast-grep.
  - **Escape hatch already covered.** Suppression uses `oxlint-disable`. Our config already sets `reportUnusedDisableDirectives: "error"`, so the same policy covers the custom rules.
  - **Plugin file is linted too.** oxlint checks the plugin source itself, and `unicorn/consistent-function-scoping` flagged a helper in it.

### Semgrep

- [V] Semgrep, [testing rules](https://docs.semgrep.dev/writing-rules/testing-rules): `// ruleid:` guards against false negatives and `// ok:` against false positives. `semgrep --test` also checks fixes against `.fixed` files.
- [V] Semgrep, [`lang.json`](https://github.com/semgrep/semgrep-interfaces/blob/main/lang.json) (main branch, fetched 2026-09-29): TypeScript `exts: [".ts", ".tsx"]`, maturity `ga`.
- [E, ours] What we saw with Semgrep 1.136:
  - **Tests pass.** The rule's own `.ts` test passed.
  - **Our code is skipped.** Scanning `src/` produced 0 findings with `paths.scanned: []` and exit 0. The same rule found 4 hits on `UnsignedContract.mts` after it was copied to `.ts`.
  - **Speed.** A single rule took 3.3–3.6 s per run.
  - **Setup.** It needs a Python toolchain.
  - **Verdict:** disqualified for an all-`.mts` repo.

### ESLint custom rules

- [V] Daniel Rosenwasser (Microsoft), [*Announcing TypeScript 7.0*](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (2026-07-08):
  - "Because some tools like typescript-eslint expect to import from `typescript` directly via peer dependencies, we recommend achieving this via npm aliases" to `@typescript/typescript6`.
  - "We expect TypeScript 7.1 to ship with a new (and different) API."
- [E] typescript-eslint [issue #12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518) (2026-07-08, closed as not planned):
  - the peer range is `<6.1.0`;
  - a forced install crashes in `typescript-estree`.
- [E] typescript-eslint [PR #12803](https://github.com/typescript-eslint/typescript-eslint/pull/12803) (Josh Goldberg) prototypes an opt-in TS 7.1 native backend. It is unreleased.
- [E, ours] `eslint` 10.11 + `@typescript-eslint/parser` 8.70.1 with TS 7.0.2 hoisted exits 2 with "typescript-eslint does not support TS 7.0." That happens even for a syntax-only rule.
- (ours, [O]) The workaround is to alias TS 6 for typescript-eslint alone. That puts a second compiler and a second linter in the loop, and all it buys is the ESLint API, which oxlint JS plugins already copy. Revisit when TS 7.1 ships.

### vitest structural tests

- [O, named practitioner] Nick Tune, [*Deterministic Code Conventions with Oxlint*](https://nick-tune.me/blog/2026-04-10-deterministic-code-conventions-oxlint/) (2026-04-10):
  - He labels code with roles (`/** @riviere-role … */`) and enforces location, coupling and shape per role, e.g. a `command-use-case` must have "exactly 1 public method".
  - Recovery help for agents comes from a `roleDefinitionsDir` of markdown files ("So AI can read those before writing code").
  - Speed: "Finished in 1.3s on 238 files with 94 rules using 8 threads."
  - His own caveats: "I am not using this approach in production", and "there is a very serious chance with this approach that your AI agent is just going to keep bouncing from one guard rail to another and get stuck."
- [O, named practitioner] Birgitta Böckeler (Thoughtworks), [*Maintainability sensors for coding agents*](https://martinfowler.com/articles/sensors-for-coding-agents.html) (2026-05-27):
  - "I built a custom ESLint formatter to override some of the default messages".
  - On `no-explicit-any`, the message told the agent to "Make a judgment call about this. If you choose to not introduce a type, suppress it with: // eslint-disable-next-line…".
  - Her read of the result: "an indicator that the custom lint messages can indeed make quite a difference." There is no count behind it.
- [E] ArchUnitTS ([LukasNiessen/ArchUnitTS](https://github.com/LukasNiessen/ArchUnitTS)) runs under vitest. Its README names "empty test protection" (it fails when no files match) as a differentiator from ts-arch. We did not check whether it loads `typescript` under TS 7. Given the dependency-cruiser choice in `architecture-check.md`, it would duplicate that.
- [E, ours] The hand-written structural test below takes about 60 lines, uses `oxc-parser` 0.151, and ran in 40 ms.
  - **Hit.** It found `InMemoryContractDraftRepository` with no private constructor. That class sits in `draft/ContractDraftRepository.mts`, and `repository.md` says implementations live in infrastructure.
  - **Clean.** The `events.mts` and service-shape checks pass.
  - **Guard.** A "scans a non-empty file set" case guards against the empty-scope trap.
  - **Limit.** It runs in pre-push (unit tests), not pre-commit, so the agent sees it later than lint unless `pnpm check` runs it.

## 3. Results on `src/`

| Rule | Tool | Hits | Files | TP | FP | Known FN |
|---|---|---|---|---|---|---|
| `use-ok-helper` | ast-grep | 13 | 11 | 13 | 0 | shorthand `{ success: true, value }` not matched |
| `use-err-helper` | ast-grep | 35 | 11 | 35 | 0 | — |
| `use-result-type` | ast-grep | 17 | 10 | 17 | 0 | `ContractDraft.toNotSignedContract` (`ReturnType<typeof okVoid> \| {…}`) |
| `error-is-code-object` | ast-grep and oxlint plugin | 8 | 2 | 8 | 0 | `ContractDraft.create` error `{ code: string }` (not a literal union) |
| `entity-no-silent-return` | ast-grep and oxlint plugin | 3 | 1 | 3 | 0 | `ActiveContract.suspend` has no state check at all |
| `no-throw-in-domain` | ast-grep | 0 | 0 | — | 0 | — |
| private constructor | structural | 1 | 1 | 1 | 0 | — |
| `events.mts` beside entity | structural | 0 | 0 | — | — | — |
| curried service export | structural | 0 | 0 | — | — | — |
| `explicit-module-boundary-types` (built-in) | oxlint | 5 in domain | 3 | 5 | 0 | — |

- **How TP was judged.** TP means the code contradicts the text of `docs/architecture/*.md`. Nothing was flagged that the docs allow.
- **Cross-check.** `grep` found the same 8 string-error sites that `error-is-code-object` reported.
- **Overlap.** On `draft/FeeStructure.mts`, `use-err-helper` and `error-is-code-object` fire on the same 3 lines. The autofix turns `{ success: false, error: "…" }` into `err("…")`, which still trips the second rule. That order is correct: mechanical fix first, then the design fix.

## 4. Prototype rules (verbatim)

### 4.1 ast-grep: `sgconfig.yml`

```yaml
ruleDirs:
  - lint/ast-grep/rules
testConfigs:
  - testDir: lint/ast-grep/tests
```

### 4.2 ast-grep: `lint/ast-grep/rules/use-result-helpers.yml` (3 rules, autofix)

```yaml
id: use-ok-helper
language: TypeScript
severity: error
files: ["src/**/*.mts"]
ignores: ["src/**/__tests__/**", "src/utils/Result.mts", "src/utils/test.mts"]
message: Build a success Result with ok(value), not an object literal.
note: |
  Convention (docs/architecture/building-blocks.md): every operation that can fail
  returns Result<T, E> from "@/utils/Result.mjs".
  Fix: replace `{ success: true, value: X }` with `ok(X)` and add
  `import { ok } from "@/utils/Result.mjs";`. Autofix: `pnpm exec ast-grep scan -U`.
rule:
  pattern:
    context: "const x = { success: true, value: $V }"
    selector: object
fix: ok($V)
---
id: use-err-helper
language: TypeScript
severity: error
files: ["src/**/*.mts"]
ignores: ["src/**/__tests__/**", "src/utils/Result.mts", "src/utils/test.mts"]
message: Build a failed Result with err({ code }), not an object literal.
note: |
  Convention (docs/architecture/building-blocks.md): every operation that can fail
  returns Result<T, E> from "@/utils/Result.mjs".
  Fix: replace `{ success: false, error: E }` with `err(E)` and add
  `import { err } from "@/utils/Result.mjs";`. Autofix: `pnpm exec ast-grep scan -U`.
rule:
  pattern:
    context: "const x = { success: false, error: $E }"
    selector: object
fix: err($E)
---
id: use-result-type
language: TypeScript
severity: error
files: ["src/**/*.mts"]
ignores: ["src/**/__tests__/**", "src/utils/Result.mts", "src/utils/test.mts"]
message: Declare the return type as Result<T, E>, not an inline success/error union.
note: |
  Convention (docs/architecture/value-object.md): the static factory returns
  Result<VO, VOError>; the error type is a named union of { code } objects.
  Fix: `Result<$T, $E>` and `import { type Result } from "@/utils/Result.mjs";`.
  Autofix: `pnpm exec ast-grep scan -U`.
rule:
  any:
    - pattern:
        context: "type X = { success: true; value: $T } | { success: false; error: $E }"
        selector: union_type
    - pattern:
        context: "type X = | { success: true; value: $T } | { success: false; error: $E }"
        selector: union_type
fix: Result<$T, $E>
```

### 4.3 ast-grep: `lint/ast-grep/rules/error-is-code-object.yml`

```yaml
id: error-is-code-object
language: TypeScript
severity: error
files: ["src/**/*.mts"]
ignores: ["src/**/__tests__/**"]
message: Domain errors are { code } objects, not strings.
note: |
  Convention (docs/architecture/value-object.md): "Errors are a union of { code } objects,
  with context where it helps." Callers and application services switch on `error.code`.
  Fix: declare `export type <Name>Error = { code: "SOME_CODE" } | ...` and return
  `err({ code: "SOME_CODE" })`; add `context: {...}` if the caller needs the offending value.
rule:
  any:
    - pattern: err($ARG)
    - pattern:
        context: "const x = { success: false, error: $ARG }"
        selector: object
    - pattern:
        context: "type X = Result<$T, $ARG>"
        selector: generic_type
constraints:
  ARG:
    any:
      - kind: string
      - kind: template_string
      - kind: literal_type
      - kind: union_type
        has: { kind: literal_type, stopBy: end, has: { kind: string } }
      - regex: "^string$"
```

### 4.4 ast-grep: `lint/ast-grep/rules/entity-no-silent-return.yml`

```yaml
id: entity-no-silent-return
language: TypeScript
severity: error
files: ["src/**/*.mts"]
ignores: ["src/**/__tests__/**"]
message: Entity method ignores an invalid state with a bare `return;`. Return err({ code }) instead.
note: |
  Convention (docs/architecture/entity.md): "Each method checks invariants first and
  returns Result when it can fail." A bare `return;` hides the failure from the
  application service, which then saves and reports success.
  Fix: declare `: Result<void, <Entity>Error>`, replace `return;` with
  `return err({ code: "NOT_<EXPECTED_STATE>" })`, end with `return okVoid();`,
  and add the code to `export type <Entity>Error`.
rule:
  pattern: return;
  not:
    inside: { kind: arrow_function, stopBy: end }
  inside:
    stopBy: end
    kind: method_definition
    inside:
      stopBy: end
      kind: class_body
      has:
        kind: method_definition
        has: { field: name, regex: "^pullEvents$" }
```

### 4.5 ast-grep: `lint/ast-grep/rules/no-throw-in-domain.yml`

```yaml
id: no-throw-in-domain
language: TypeScript
severity: error
files: ["src/contracting/**/*.mts", "src/money/**/*.mts"]
ignores: ["src/**/__tests__/**"]
message: Domain code does not throw. Return err({ code }) instead.
note: |
  Convention (docs/architecture/building-blocks.md): every operation that can fail
  returns Result<T, E>. Only infrastructure failures (repositories) throw.
  Fix: add a code to the object's `<Name>Error` union and `return err({ code: "..." })`.
rule:
  kind: throw_statement
```

### 4.6 ast-grep rule tests (two of six; `ast-grep test` → 6 passed)

```yaml
id: error-is-code-object
valid:
  - 'return err({ code: "EMPTY" });'
  - 'return err({ code: r.error.code });'
  - 'return err(r.error);'
  - 'function f(): Result<PersonId, PersonIdError> {}'
invalid:
  - 'return err("INVALID_STATE");'
  - 'return err(`bad ${x}`);'
  - 'return { success: false, error: "Monthly dues cannot be negative" };'
  - 'function f(): Result<FeeStructure, string> {}'
  - 'function f(): Result<void, "INVALID_STATE"> {}'
  - 'function f(): Result<void, "A" | "B"> {}'
```

```yaml
id: entity-no-silent-return
valid:
  - |
    class SignedContract {
      recordPaymentAccepted(): Result<void, E> {
        if (this.state.kind !== "AwaitingPayment") return err({ code: "NOT_AWAITING_PAYMENT" });
        return okVoid();
      }
      pullEvents() { return []; }
    }
  - |
    class Money {
      f() { if (x) return; }
    }
  - |
    class Stage {
      each() { this.items.forEach((i) => { if (!i) return; }); }
      pullEvents() { return []; }
    }
invalid:
  - |
    class SignedContract {
      toActiveContract() {
        if (this.state.kind !== "PaymentAccepted") return;
      }
      pullEvents() { return []; }
    }
```

What an agent sees (`ast-grep scan --report-style medium`):

```text
src/contracting/signed-contract/SignedContract.mts:35:48: error[entity-no-silent-return]: Entity method ignores an invalid state with a bare `return;`. Return err({ code }) instead.
 = Convention (docs/architecture/entity.md): "Each method checks invariants first and
   returns Result when it can fail." A bare return; hides the failure from the
   application service, which then saves and reports success.
   Fix: declare : Result<void, <Entity>Error>, replace return; with
   return err({ code: "NOT_<EXPECTED_STATE>" }), end with return okVoid();,
   and add the code to export type <Entity>Error.
```

The terminal renderer strips the backticks from `note`, so code in a note should still read clearly without them.

### 4.7 oxlint JS plugin: `lint/oxlint-plugin/ddd.mjs`

Wired in `oxlint.config.mts` with `jsPlugins: ["./lint/oxlint-plugin/ddd.mjs"]` and `"ddd/error-is-code-object": "error"`, `"ddd/entity-no-silent-return": "error"`.

```js
const isStringy = (n) =>
  (n.type === "Literal" && typeof n.value === "string") ||
  n.type === "TemplateLiteral" ||
  n.type === "TSStringKeyword" ||
  (n.type === "TSLiteralType" && typeof n.literal.value === "string") ||
  (n.type === "TSUnionType" && n.types.some(isStringy));

const errorIsCodeObject = {
  meta: {
    type: "problem",
    messages: {
      stringError:
        'Domain errors are { code } objects, not strings. Declare `export type <Name>Error = { code: "SOME_CODE" } | ...` and return `err({ code: "SOME_CODE" })`. See docs/architecture/value-object.md.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "err" && node.arguments[0] && isStringy(node.arguments[0]))
          context.report({ node: node.arguments[0], messageId: "stringError" });
      },
      TSTypeReference(node) {
        const args = node.typeArguments?.params;
        if (node.typeName.type === "Identifier" && node.typeName.name === "Result" && args?.length === 2 && isStringy(args[1]))
          context.report({ node: args[1], messageId: "stringError" });
      },
      ObjectExpression(node) {
        const succ = node.properties.find((p) => p.type === "Property" && p.key.name === "success");
        const errP = node.properties.find((p) => p.type === "Property" && p.key.name === "error");
        if (succ?.value.type === "Literal" && succ.value.value === false && errP && isStringy(errP.value))
          context.report({ node: errP.value, messageId: "stringError" });
      },
    };
  },
};

const entityNoSilentReturn = {
  meta: {
    type: "problem",
    messages: {
      silent:
        'Entity method ignores an invalid state with a bare `return;`. Declare `: Result<void, <Entity>Error>`, return `err({ code: "NOT_<EXPECTED_STATE>" })` here and `okVoid()` at the end. See docs/architecture/entity.md.',
    },
  },
  create(context) {
    const isEntity = (classBody) =>
      classBody.body.some((m) => m.type === "MethodDefinition" && m.key.type === "Identifier" && m.key.name === "pullEvents");
    return {
      ReturnStatement(node) {
        if (node.argument) return;
        const ancestors = context.sourceCode.getAncestors(node);
        const fnIdx = ancestors.findLastIndex((a) => a.type === "FunctionExpression" || a.type === "ArrowFunctionExpression" || a.type === "FunctionDeclaration");
        const fn = ancestors[fnIdx];
        const method = ancestors[fnIdx - 1];
        if (fn?.type !== "FunctionExpression" || method?.type !== "MethodDefinition") return;
        if (isEntity(ancestors[fnIdx - 2])) context.report({ node, messageId: "silent" });
      },
    };
  },
};

export default {
  meta: { name: "ddd" },
  rules: {
    "error-is-code-object": errorIsCodeObject,
    "entity-no-silent-return": entityNoSilentReturn,
  },
};
```

### 4.8 oxlint plugin tests: `lint/oxlint-plugin/__tests__/ddd.spec.mts`

```ts
import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "../ddd.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("error-is-code-object", plugin.rules["error-is-code-object"], {
  valid: [
    'err({ code: "EMPTY" });',
    "err(r.error);",
    "function f(): Result<PersonId, PersonIdError> {}",
  ],
  invalid: [
    { code: 'err("INVALID_STATE");', errors: [{ messageId: "stringError" }] },
    { code: 'const r = { success: false, error: "negative" };', errors: [{ messageId: "stringError" }] },
    { code: "function f(): Result<FeeStructure, string> {}", errors: [{ messageId: "stringError" }] },
    { code: 'function f(): Result<void, "A" | "B"> {}', errors: [{ messageId: "stringError" }] },
  ],
});

tester.run("entity-no-silent-return", plugin.rules["entity-no-silent-return"], {
  valid: [
    "class Money { f() { if (x) return; } }",
    "class S { each() { this.xs.forEach((i) => { if (!i) return; }); } pullEvents() { return []; } }",
  ],
  invalid: [
    {
      code: 'class S { toActive() { if (this.state.kind !== "Paid") return; } pullEvents() { return []; } }',
      errors: [{ messageId: "silent" }],
    },
  ],
});
```

### 4.9 Structural test: `lint/structure/conventions.spec.mts`

```ts
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

const DOMAIN_ROOTS = ["src/contracting", "src/money"];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".mts") && !e.parentPath.includes("__tests__"))
    .map((e) => join(e.parentPath, e.name));

const files = DOMAIN_ROOTS.flatMap(sourceFiles);

const classesIn = (file: string) => {
  const { program } = parseSync(file, readFileSync(file, "utf8"));
  return program.body
    .map((s: any) => (s.type === "ExportNamedDeclaration" ? s.declaration : s))
    .filter((d: any) => d?.type === "ClassDeclaration");
};
const members = (cls: any) => cls.body.body.filter((m: any) => m.type === "MethodDefinition");

describe("domain structure", () => {
  it("scans a non-empty file set", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("every domain class has a private constructor", () => {
    const offenders = files.flatMap((f) =>
      classesIn(f)
        .filter((c: any) => !members(c).some((m: any) => m.kind === "constructor" && m.accessibility === "private"))
        .map((c: any) => `${f}: class ${c.id.name}`),
    );
    expect(
      offenders,
      "Add `private constructor(...)` and create instances through `static create(...)` returning Result (docs/architecture/value-object.md, entity.md). Repository implementations belong in infrastructure, not next to the port (docs/architecture/repository.md).",
    ).toEqual([]);
  });

  it("every entity (class with pullEvents) has events.mts beside it", () => {
    const offenders = files.flatMap((f) =>
      classesIn(f)
        .filter((c: any) => members(c).some((m: any) => m.key.name === "pullEvents"))
        .filter(() => !existsSync(join(dirname(f), "events.mts")))
        .map((c: any) => `${f}: class ${c.id.name}`),
    );
    expect(offenders, "Declare this entity's events in events.mts in the same folder (docs/architecture/events.md rule 5).").toEqual([]);
  });

  it("application services export only curried use-case functions", () => {
    const services = files.filter((f) => f.endsWith("Service.mts"));
    expect(services.length).toBeGreaterThan(0);
    const offenders = services.flatMap((f) => {
      const { program } = parseSync(f, readFileSync(f, "utf8"));
      return program.body
        .filter((s: any) => s.type === "ExportNamedDeclaration" && s.declaration && s.exportKind !== "type")
        .filter((s: any) => {
          const d = s.declaration;
          if (d.type === "TSTypeAliasDeclaration" || d.type === "TSInterfaceDeclaration") return false;
          const init = d.type === "VariableDeclaration" ? d.declarations[0]?.init : null;
          const curried = init?.type === "ArrowFunctionExpression" && init.params.length === 1 && init.body.type === "ArrowFunctionExpression" && init.body.async;
          return !curried;
        })
        .map((s: any) => `${f}:${s.start}`);
    });
    expect(offenders, "Export each use case as `export const useCase = (deps) => async (input) => Result` (docs/architecture/application-service.md).").toEqual([]);
  });
});
```

---

## Applied to us

Ranked by leverage against cost (ours, [O]).

1. **Turn on 2 built-in oxlint rules. High leverage, near-zero cost.**
   - `typescript/explicit-module-boundary-types` catches the 5 entity methods with no declared `Result`. It also makes every factory's return type visible to the shape rules below.
   - `no-restricted-globals` on `Date`, with an override for `src/utils/LocalDate.mts`, enforces convention #6.
   - No new tool is needed. Put the fix text in `message`.
2. **Adopt ast-grep for single-file shape rules, starting with the 5 prototypes. High leverage, low cost.**
   - Cost: 1 dev dependency (added to `allowBuilds`), `sgconfig.yml`, about 20 lines of YAML per rule, and `ast-grep test` in `pnpm check`.
   - Wiring: `ast-grep scan --report-style medium` in the pre-commit lint step and in CI.
   - Rollout:
     1. Run `ast-grep scan -U` once, add the imports, and fix `ContractDraft.mts` by hand. That is one commit and clears 65 of 77 violations.
     2. Set the 3 design rules to `warning` until the error codes for `draft/FeeStructure`, `UnsignedContract` and `SignedContract` are decided. They are domain decisions, not lint fixes.
   - Ban `ast-grep-ignore` in agent edits the same way `--no-verify` is banned.
3. **Fix the reference files the rules flag. High leverage, and the cost is the domain decisions.**
   - `entity.md` names `SignedContract` as a reference, yet the file breaks that doc's own pattern.
   - This is the same problem as gap 4 in `agy-open-gaps-research.md`: agents copy code, not docs. A rule keeps it from coming back.
4. **Add one vitest structural test for cross-file conventions. Medium leverage, low cost.**
   - It covers `events.mts` placement, repository implementations outside the domain folder, and the non-empty-scope guard.
   - Keep it small. Import-direction boundaries belong to dependency-cruiser (`architecture-check.md`), not here.
5. **Oxlint JS plugin: only when a rule needs a multi-range autofix or ast-grep's patterns get awkward. Medium leverage, medium cost.**
   - It is alpha, but the ESLint-compatible API and `RuleTester` keep lock-in low, and it adds about 165 ms per run.
   - Prefer it over ast-grep for `use-err-helper`/`use-ok-helper`, since it can add the import. Everything else stays in ast-grep until a need shows up.
6. **Reject for now:**
   - **Semgrep:** skips `.mts`, 3 s per rule, needs Python.
   - **ESLint + typescript-eslint:** refuses TS 7. Revisit after TS 7.1 ships its API.
   - **Tune-style role DSL:** his own "not using this in production" and "bouncing" caveats. At 23 files our conventions are few enough to write as direct rules.
7. **Resolve the typed-id conflict before writing a rule for it.** `entity.md` says "never a raw string" while `repository.md` uses `get(id: string)`.

Aside, found while running the prototypes:

- The working tree has 34 untracked `.mjs` files next to the `.mts` sources, apparently left by an earlier `tsc` emit. `tsconfig.json` has no `noEmit`/`outDir`.
- `vite-tsconfig-paths` resolves `@/…mjs` imports to these stale files, and the `.spec.mjs` copies can't resolve `@/…`. So `vitest run` fails 20 of 22 test files, both in the repo itself and in the scratchpad copy.
- After deleting the `.mjs` files, 45/45 pass.
