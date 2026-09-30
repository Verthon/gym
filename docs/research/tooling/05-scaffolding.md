# Research: scaffolding DDD building blocks so the agent doesn't hand-write boilerplate

Created: 2026-09-29
Input: the tooling goal ("deterministic tooling so the agent writes only business logic"), `docs/architecture/*.md`, the reference code in `src/contracting` and `src/money`.
Tags as in the earlier docs: **[E]** evidence, **[V]** vendor guidance, **[O]** opinion (ours says "ours").
Not repeated: finding 2 (cost comes from failure loops) and finding 4 (a single example is where it gets its patterns) from `agy-findings-research.md`, and gaps 2–4 from `agy-open-gaps-research.md`. This doc builds on them.

## Bottom line

- **Use a plain Node script, not a generator framework.** The prototype `scripts/gen.mts` is 118 lines with template literals and no dependencies. It creates a value object and its spec. Node 24 runs it directly. Its output passes type-aware oxlint, `tsc --noEmit`, vitest and knip unchanged, in the scratch copy of the repo.
- **The frameworks cost more than they give here.**
  - plop is maintained and works headless, but it adds ~120 packages and Handlebars to do string interpolation.
  - hygen hasn't released since 2022-09.
  - Yeoman and Nx are heavy (~500 packages each). An Nx generator needs `nx.json` plus a local plugin project.
- **No study compares "generator" with "give the agent an example".** Anthropic, Nx, OpenAI and Böckeler (martinfowler.com) all say to move deterministic work out of the model. None of them publishes numbers. For us the concrete argument is finding 4: a generator writes a fresh, doc-conforming example every time, so the coder never has to open `PersonId.mts` and copy what's wrong with it.
- **Two cheap checks stop templates drifting from the docs. Both are prototyped.**
  1. Generate into a temp dir, then run `tsc` + oxlint + vitest. This caught a renamed helper (API drift). It did **not** catch a template that dropped `private readonly` (convention drift).
  2. A doc-sync test: the `## Pattern` block in `value-object.md` must equal the template output. This caught the convention drift.
- **Generate new files only.** Edits to existing files are where every generator tool gets fragile (regex `modify`/`inject`, or AST tools that TS 7 can't provide). Examples: adding an event to a union, wiring a repository into a service. Leave those to the agent.

---

## 1. Tools compared

Measured on 2026-09-29. Footprint is the `npm ls --all --parseable` line count and the `node_modules` size after a clean `npm i -D <pkg>` in the scratchpad.

| Tool | Latest (npm) | Maintenance signal | Footprint | Non-interactive | Fit for us |
|---|---|---|---|---|---|
| plop | 4.0.5, 2026-01-22 | repo pushed 2026-09-10; ~1.9M weekly downloads | 123 pkgs, 26 MB | yes: prompts bypassed positionally or by name (`plop vo -- --name X`) | works, but Handlebars and a plopfile for what is `${name}` |
| hygen | 6.2.11, **2022-09-07** | last commit on default branch 2023-03-15; PR #456 "Update dependencies" (2025-02) unmerged | 93 pkgs, 9.5 MB | yes (CLI args) | no: effectively unmaintained |
| yo + yeoman-generator | 7.0.1 (2026-04-09) / 9.2.0 (2026-09-14) | maintained | 512 pkgs, 78 MB (`yo` only) | partly; built around prompts and interactive conflict resolution | no: project-bootstrap tool, too heavy for per-file scaffolding |
| Nx local generator | nx / @nx/devkit / @nx/plugin 23.2.1, 2026-09-09 | very active | 552 pkgs, 165 MB | yes, plus virtual-FS `Tree` and dry-run | no: needs `nx.json` and a plugin project; the best agent story, but adopting Nx just for this is out of proportion |
| Plain Node script | n/a | ours | 0 pkgs | yes | **yes** |
| Claude Code skill / slash command | n/a | n/a | n/a | n/a | a wrapper around a generator, not a generator |

Details:

- **plop.**
  - [V] The [README](https://github.com/plopjs/plop) documents "Bypassing Prompts" (positional, or by name after `--`). It also documents TypeScript plopfiles that run on Node's built-in TS support, with "No extra setup or CLI flags".
  - `add` refuses to overwrite by default. `modify`/`append` edit existing files by regex `pattern`.
- **hygen.**
  - Status from the maintainer only ([issue #443](https://github.com/jondot/hygen/issues/443), 2024-03-20, jondot): "yes, this is still maintained … I always hesitate before trying to update".
  - Nothing has been released since. A contributor's fork, hypergen, is described in the same thread as "almost usable".
- **Nx.**
  - [V] Nx docs, [Local Generators](https://nx.dev/docs/kb/local-generators). The setup is `nx add @nx/plugin`, `nx g @nx/plugin:plugin tools/my-plugin`, then `nx generate @nx/plugin:generator …`. That produces `generator.ts`, `schema.json`, `schema.d.ts` and a spec under a plugin project, with `nx.json` at the root.
  - The page embeds a video titled "AI didn't kill code generators. It made them better."
- **Plain script.**
  - [E, ours] Node 24.21 ran `node scripts/gen.mts` with no flags.
  - `tsconfig.json` has no `include`, so `tsc` also type-checks the generator. Type-aware oxlint lints it too, and it found 3 real errors in the first version (§4). The generator gets the same safety net as the domain code.
- **Skill wrapper.**
  - [V] Claude Code [skills docs](https://code.claude.com/docs/en/skills): `allowed-tools` pre-approves tools for the turn that invokes the skill. `${CLAUDE_SKILL_DIR}` lets a skill run a bundled script without a prompt. `disable-model-invocation: true` keeps a skill manual-only.
  - (ours, [O]) Both of our agents already run `pnpm` scripts, and agy reads `.agents/skills/` in the same Agent Skills format. So the command line is the portable interface, and a skill is optional glue on top.

## 2. Do generators reduce agent errors compared with an example?

**No good source found** for a controlled comparison. What exists is vendor guidance and practitioner reasoning:

- [V] Anthropic, [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), "Provide utility scripts": "Even if Claude could write a script, pre-made scripts offer advantages: More reliable than generated code; Save tokens …; Save time …; Ensure consistency across uses". Also: "Prefer scripts for deterministic operations".
- [V] Nx, Juri Strumpflohner:
  - [*Combining Predictability and Intelligence With Nx Generators and AI*](https://nx.dev/blog/nx-generators-ai-integration) (2025-05-13): LLMs "struggle with consistency and correctness"; generators give the repeatable part.
  - [*Let AI Agents Extract Reusable Nx Generators*](https://nx.dev/blog/agent-extract-nx-generator) (2026-09-17): "Scaffolding is a deterministic operation, and I try to move that outside the model as much as I can." The agent runs the generator, then adjusts.
  - Neither post has measurements. Nx sells generators, so read these as a vendor position.
- [V] OpenAI, Ryan Lopopolo, [*Harness engineering*](https://openai.com/index/harness-engineering/) (2026-02):
  - The initial scaffold was "generated by Codex CLI using GPT‑5, guided by a small set of existing templates."
  - In steady state they rely on custom linters and structural tests, with "error messages [written] to inject remediation instructions into agent context", not on generators.
  - On drift: "Codex replicates patterns that already exist in the repository—even uneven or suboptimal ones. Over time, this inevitably leads to drift." Also: "When documentation falls short, we promote the rule into code".
- [O] Birgitta Böckeler, [*Harness engineering for coding agent users*](https://martinfowler.com/articles/harness-engineering.html) (martinfowler.com, 2026):
  - She classifies scripts and codemods as "computational guides", which "increase the probability of good results with deterministic tooling". Her example for bootstrapping is a "Skill with instructions and a bootstrap script".
  - On templates: "As soon as teams instantiate them, they start fall out of sync with upstream improvements."
- [V] Factory, [*Using Linters to Direct Agents*](https://factory.ai/news/using-linters-to-direct-agents) (2025-09-05): "Achieving 'lint green' becomes the definition of 'Done'". Factory puts the weight on lint rules with autofix, not on templates.
- [E, weak] Ustynov, [arXiv:2604.07502](https://arxiv.org/html/2604.07502v1) (2026-04) counts ceremony: a Spring Boot endpoint is "∼170 lines, of which ∼18 are business logic". The paper itself labels its architectural claims "theoretically motivated hypotheses".

**Applied to us (ours, [O]).**

- **The sources agree on the direction but not on how much it matters.** OpenAI and Factory treat linters as the main mechanism and templates as a starting aid. That fits a simple split: a generator prevents mistakes in the first draft, and lints catch the edits the agent makes afterwards. We need both.
- **What a generator changes for our runs specifically** is where the pattern comes from (finding 4). With `pnpm gen vo`, the example the coder sees was produced a second ago from the doc-synced template. It isn't a hand-written file that has drifted (`PersonId.mts` still has `toString` and `public`).
- **Our value objects are small** (~20 lines). The token saving is minor. The value is in consistency and in taking away the reason to open reference files.
- **The coder still has to choose to run the generator.** That makes it an instruction, and it should be phrased as a commission at the workflow step ("create the files with `pnpm gen vo …`, then add the rules"). That wording follows gap 1 in `agy-open-gaps-research.md`.

## 3. Keeping templates in sync with `docs/architecture/*.md`

Three options, the first two prototyped:

| Mechanism | Catches | Misses | Cost (measured) |
|---|---|---|---|
| **gen-check**: generate into `src/__gencheck__`, run `tsc --noEmit`, oxlint, vitest, delete | API drift. Renaming `failWith` in `src/utils/test.mts` → `TS2305 … has no exported member 'failWith'` | convention drift. Removing `private readonly` from the template → still green | 5.3 s |
| **doc-sync test**: the doc's pattern block, between `<!-- generated:start/end -->` markers, must equal `valueObject("MemberNumber", "string")` | any template edit not mirrored in the doc, and the reverse. Removing `private readonly` → red, with a message saying what to do | wrong code that is identical in both places (review has to catch that) | 0.35 s |
| Doc written from the template by a script | same as doc-sync | same | a write mode; not needed yet |

- **No named source describes a "doc generated from template" practice for agent harnesses.**
  - The closest is OpenAI: "Dedicated linters and CI jobs validate that the knowledge base is up to date", plus a "doc-gardening" agent.
  - The other is Böckeler's warning that instantiated templates fall out of sync.
- (ours, [O]) The doc-sync test **turns the generator into the canonical example.** `value-object.md` would show `MemberNumber` as generated output instead of the hand-written `PersonId`. The rules prose stays hand-written. The doc stops pointing at `PersonId.mts` as a reference, which is the fix finding 4 asked for.
- **Out of the generator's scope:** convention drift in files after generation (the agent deletes `private readonly` while editing). Only a custom lint rule or a structural test catches that.

## 4. Prototype

Verified in a copy of the repo at `…/scratchpad/scaffolding/repo`. Before adding anything, the copy's baseline was red. I made two changes to get a clean baseline (details under "Side finding" below):

- deleted `src/sandbox/` (the locked agy fixture with no implementation, which gives 8 `tsc` errors);
- deleted the untracked `.mjs`/`.js` files that `tsc` emits next to the `.mts` sources. They produce oxlint errors, and vitest collects the `.spec.mjs` copies (18 failed files).

After that, lint, tsc and vitest were green (45 tests).

### Results

| Run | oxlint (type-aware, whole repo) | `tsc --noEmit` | vitest | knip |
|---|---|---|---|---|
| v1 generator | **red, 5 errors.** 3 in the generator itself: `no-unnecessary-type-assertion` ×2 and `no-unsafe-type-assertion`. 2 in the output: `vitest(warn-todo)` on an `it.todo` placeholder, which is an error under our categories | green | green (6 passed, 2 todo) | no new findings |
| v2 (below): `function fail(): never` for narrowing, no `it.todo` | **green** | **green** | **green** (6/6 for a string VO and a number VO) | **green**: the spec imports the VO, so knip's vitest plugin counts it as used; `scripts/gen.mts` is an entry via the `gen` script |
| gen-check script | green | green | green | — |
| doc-sync spec | green | green | green (1/1) | — |

Also verified: a re-run refuses to overwrite and exits 1; a camelCase name is rejected; generating takes 0.36 s.

- (ours, [O]) **The `warn-todo` result is worth keeping in mind.** An `it.todo("enforces the business rules of X")` in the generated spec is a precise, commission-style red signal that stays until the coder writes the business test. I left it out so the output is green by construction and gen-check stays simple. It is the natural next experiment if the coder skips rule tests.

### `package.json` (added script)

```json
"gen": "node scripts/gen.mts"
```

### `scripts/gen.mts`

```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

type Primitive = "string" | "number";

export const valueObject = (name: string, primitive: Primitive): string => {
	const guard =
		primitive === "string"
			? `		if (!input) return err({ code: "EMPTY" });
		const v = input.trim();
		if (!v) return err({ code: "EMPTY" });
		return ok(new ${name}(v));`
			: `		if (input === null || input === undefined) return err({ code: "EMPTY" });
		if (!Number.isFinite(input)) return err({ code: "NOT_FINITE", context: { value: input } });
		return ok(new ${name}(input));`;
	const errors =
		primitive === "string"
			? ` { code: "EMPTY" }`
			: `
	| { code: "EMPTY" }
	| { code: "NOT_FINITE"; context: { value: number } }`;
	return `import { err, ok, type Result } from "@/utils/Result.mjs";

export type ${name}Error =${errors};

export class ${name} {
	private readonly value: ${primitive};

	private constructor(value: ${primitive}) {
		this.value = value;
	}

	static create(input: ${primitive} | null | undefined): Result<${name}, ${name}Error> {
${guard}
	}

	equals(other: ${name}): boolean {
		return this.value === other.value;
	}
}
`;
};

export const valueObjectSpec = (name: string, primitive: Primitive): string => {
	const [a, b] = primitive === "string" ? [`"a1"`, `"b2"`] : ["1", "2"];
	const invalid =
		primitive === "string"
			? `	it("rejects empty or blank input", () => {
		failWith(${name}.create(""), "EMPTY");
		failWith(${name}.create("   "), "EMPTY");
	});`
			: `	it("rejects missing or non-finite input", () => {
		failWith(${name}.create(null), "EMPTY");
		failWith(${name}.create(Number.NaN), "NOT_FINITE");
	});`;
	return `import { describe, expect, it } from "vitest";

import { failWith, success } from "@/utils/test.mjs";
import { ${name} } from "../${name}.mjs";

describe("${name}.create", () => {
	it("accepts a valid value", () => {
		expect(${name}.create(${a}).success).toBe(true);
	});

${invalid}
});

describe("${name}.equals", () => {
	it("compares by value", () => {
		const x = success(${name}.create(${a}));
		const y = success(${name}.create(${a}));
		const z = success(${name}.create(${b}));
		expect(x.equals(y)).toBe(true);
		expect(x.equals(z)).toBe(false);
	});
});
`;
};

const generators = {
	vo: (dir: string, name: string, primitive: Primitive) => [
		{ path: join(dir, `${name}.mts`), body: valueObject(name, primitive) },
		{ path: join(dir, "__tests__", `${name}.spec.mts`), body: valueObjectSpec(name, primitive) },
	],
};

function fail(message: string): never {
	process.stderr.write(`gen: ${message}\n`);
	process.exit(1);
}

const main = (): void => {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: { primitive: { type: "string", default: "string" } },
	});
	const [kind, dir, name] = positionals;
	const usage = "usage: pnpm gen vo <dir under src/> <PascalName> [--primitive string|number]";

	if (kind !== "vo" || !dir || !name) fail(usage);
	if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`name must be PascalCase, got "${name}"`);
	if (!dir.startsWith("src/")) fail(`dir must start with src/, got "${dir}"`);
	if (values.primitive !== "string" && values.primitive !== "number") fail(usage);

	const files = generators.vo(dir, name, values.primitive);
	const clash = files.find((f) => existsSync(f.path));
	if (clash) fail(`${clash.path} already exists; refusing to overwrite`);

	for (const f of files) {
		mkdirSync(join(f.path, ".."), { recursive: true });
		writeFileSync(f.path, f.body);
		process.stdout.write(`created ${f.path}\n`);
	}
};

if (import.meta.main) main();
```

### `scripts/gen-check.sh`

```sh
#!/bin/sh
set -e
dir=src/__gencheck__
trap 'rm -rf "$dir"' EXIT
rm -rf "$dir"
node scripts/gen.mts vo "$dir" SampleText
node scripts/gen.mts vo "$dir" SampleCount --primitive number
pnpm exec tsc --noEmit
pnpm exec oxlint "$dir"
pnpm exec vitest run "$dir"
```

### `scripts/__tests__/gen.spec.mts`

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { valueObject } from "../gen.mjs";

const generatedBlock = (docPath: string): string => {
	const doc = readFileSync(docPath, "utf8");
	const match = /<!-- generated:start -->\n```ts\n([\s\S]*?)```\n<!-- generated:end -->/.exec(doc);
	if (!match?.[1]) throw new Error(`${docPath}: no generated block found`);
	return match[1];
};

describe("docs stay in sync with generator templates", () => {
	it("value-object.md pattern equals `pnpm gen vo … MemberNumber` output", () => {
		expect(
			generatedBlock("docs/architecture/value-object.md"),
			"Template and doc diverged. Change both together: edit scripts/gen.mts, then paste valueObject(\"MemberNumber\", \"string\") into the doc's generated block.",
		).toBe(valueObject("MemberNumber", "string"));
	});
});
```

`value-object.md` → `## Pattern` becomes:

````md
Generated by `pnpm gen vo src/<context> MemberNumber`. Add business rules to `create` and new codes to the error union; keep the rest.

<!-- generated:start -->
```ts
…exact output of valueObject("MemberNumber", "string")…
```
<!-- generated:end -->
````

### Output of `pnpm gen vo src/membership MemberNumber`

`src/membership/MemberNumber.mts`:

```ts
import { err, ok, type Result } from "@/utils/Result.mjs";

export type MemberNumberError = { code: "EMPTY" };

export class MemberNumber {
	private readonly value: string;

	private constructor(value: string) {
		this.value = value;
	}

	static create(input: string | null | undefined): Result<MemberNumber, MemberNumberError> {
		if (!input) return err({ code: "EMPTY" });
		const v = input.trim();
		if (!v) return err({ code: "EMPTY" });
		return ok(new MemberNumber(v));
	}

	equals(other: MemberNumber): boolean {
		return this.value === other.value;
	}
}
```

`src/membership/__tests__/MemberNumber.spec.mts`:

```ts
import { describe, expect, it } from "vitest";

import { failWith, success } from "@/utils/test.mjs";
import { MemberNumber } from "../MemberNumber.mjs";

describe("MemberNumber.create", () => {
	it("accepts a valid value", () => {
		expect(MemberNumber.create("a1").success).toBe(true);
	});

	it("rejects empty or blank input", () => {
		failWith(MemberNumber.create(""), "EMPTY");
		failWith(MemberNumber.create("   "), "EMPTY");
	});
});

describe("MemberNumber.equals", () => {
	it("compares by value", () => {
		const x = success(MemberNumber.create("a1"));
		const y = success(MemberNumber.create("a1"));
		const z = success(MemberNumber.create("b2"));
		expect(x.equals(y)).toBe(true);
		expect(x.equals(z)).toBe(false);
	});
});
```

### Side finding (not about scaffolding)

- **`pnpm check` in the real working tree fails for reasons unrelated to any task.**
  - `"build": "tsc"` with no `outDir` emits `.mjs` next to every `.mts`. Those files are untracked in `git status`. oxlint lints them, and vitest runs the `.spec.mjs` copies.
  - `src/sandbox/` fails `tsc` by design.
- An agent that runs `pnpm check` hits these failures before it touches anything. That is a failure-loop trigger (finding 2).
- Candidate fixes: an `outDir`, or ignoring `*.mjs` under `src/`.

---

## Applied to us (ranked, leverage vs cost)

1. **Adopt `scripts/gen.mts` (VO + spec) and the doc-sync test, and replace the `PersonId` pattern in `value-object.md` with the generated block.**
   - Cost: ~150 lines and one doc edit.
   - Leverage: removes the copy-from-`PersonId.mts` trap and makes the template the only example.
   - Typed ids are the same generator (`--primitive string`).
2. **Put the command at the coder's workflow step, as a commission**: "New value object or id: run `pnpm gen vo <dir> <Name>`, then add rules to `create` and tests to the spec." Put one line in `AGENTS.md` too. Cost: two lines.
3. **Run gen-check in pre-push or CI.** Cost: 5 s. It catches helper renames breaking the templates.
4. **Extend the generator in this order.** Each step adds a template, a doc-sync block and a gen-check call.
   1. Repository port + in-memory adapter. Pure boilerplate, two new files.
   2. Entity shell: private constructor, `create`, event buffer, `pullEvents`, getters. The state union and behaviours stay with the agent.
   3. New `events.mts` with one event and its factory. Adding an event to an existing file stays manual.
   4. Application service skeleton (load → call → save). The domain call is the business logic, so the template's value is smaller here.
5. **Decide before step 4.1**: `entity.md` says "Typed id Value Object, never a raw string", but `ContractDraftRepository` and `repository.md` use `get(id: string)`. A template will copy one of them into every new file, so fix the doc/code conflict first.
6. **Skill wrapper**, only if the coders don't pick up the command from the workflow step: `allowed-tools: Bash(pnpm gen *)` plus the usage line. Cost: one file per agent.
7. **Experiment**: add `it.todo` for business rules to the spec template as a forcing function (§4). Measure whether the coder then writes rule tests it currently skips.
8. **Don't adopt** plop, hygen, Yeoman or Nx for this. Revisit plop only if the generator grows into multi-file edits of existing files. Its `modify`/`append` is the one feature a plain script would have to re-implement.
