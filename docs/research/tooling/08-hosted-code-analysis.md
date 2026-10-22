# Research: free hosted code analysis and AI review

Created: 2026-10-22
Input: "which free tiers (CodeScene, CodeRabbit, alternatives) fit this repo". Constraints: public GitHub repo (`Verthon/gym`), TypeScript 7, solo dev, trunk-based with no PRs (ADR 0003), nothing paid.
Tags as in `agy-findings-research.md`: **[E]** evidence, **[V]** vendor guidance, **[O]** opinion (ours says "ours").
All claims come from vendor pricing pages and docs read on 2026-10-22. Nothing below was installed or measured.

## Bottom line

- **There is no no-brainer. Adding a license is the closest thing to one.** The repo has no `LICENSE` file. Sonar's OSS plan is for "Public, OSI-licensed repos", and CodeScene and DeepSource word their free tiers as "for open-source projects". Without a license the repo is public but not open source. Add one (e.g. MIT) before signing up anywhere. **[V]**
- **CodeScene Community Edition is the one tool that adds information.** It analyzes git history (hotspots, code health trends, knowledge distribution), not PRs, so trunk-based work loses nothing. Signing up takes a GitHub OAuth app and no CI changes. One open question: the FAQ says it analyzes "public organizational repositories", and `Verthon/gym` is a personal repo. **[V]** (ours: try it first)
- **SonarQube Cloud Free and DeepSource OSS both analyze `main` without PRs.** Most of what they catch is already caught by oxlint, knip and dependency-cruiser. They don't confirm that their TS analysis works on TypeScript 7, and TS 7 has already filtered out Semgrep and typescript-eslint (`00-summary.md`). Treat them as unverified until a scan runs. **[V]** / **[O]**
- **CodeRabbit is only useful through its CLI.** Public repos get free PR reviews, but there are no PRs here. `cr review --committed` / `--uncommitted` reviews local changes, limited to 3 reviews per hour on the OSS and Free tiers. **[V]**
- **Skip Qodana.** Its JS/TS linter requires an Ultimate license. **[V]**

## CodeScene result (2026-10-22)

- **CodeScene ignores `.mts`.** The first analysis (revision `6c6c40b`) reports 2 TypeScript files (`src/index.ts`, `knip.config.ts`, 24 lines) and 50 "Ignored" files; that revision has 48 `.mts` files. The 10/10 Code Health score therefore covers none of the domain code. **[E]**
- The [project configuration docs](https://codescene.io/docs/configuration/project-config/index.html) offer only exclusion by extension or glob, with no extension-to-language mapping. The [language support page](https://codescene.io/docs/usage/language-support.html) lists TypeScript without naming extensions. **[V]**
- With "Detect all files with text content" enabled, the 48 `.mts` files are analyzed as language `.mts`: hotspots and change frequency work (21 hotspots, top `ContractDraftService.mts`), but every `.mts` file gets Code Health `-`, and the project score falls to 0.0. CodeScene parses `.mts` as plain text, so it's a hotspot map with no health score. **[E]**
- The cloud REST API (`api.codescene.io/v2`) works with a Community Edition token, despite the FAQ saying the API is on-prem only. **[E]**

## CodeRabbit CLI result (2026-10-22)

- **Setup:** CLI 0.9.1 via Homebrew, `coderabbit auth login` with GitHub. `coderabbit usage` reports 10 reviews per rolling hour for `Verthon/gym` (not the 3 per hour from the docs) and "Usage billing: inactive", so nothing is charged. Never pass `--use-credits`. **[E]**
- **Run:** `coderabbit review --committed --base-commit 6c6c40b --agent` in a detached worktree at `9f35ecb`, covering the 3 suspension commits (`d1063a6`, `0a6c1c8`, `9f35ecb`): 10 files, +428/−19. It took about 4 minutes. `--agent` emits JSON lines (`finding`, `complete`). **[E]**
- **Findings:** 1, rated major: "a failed save leaves the contract suspended" in `ActiveContractService.mts:17`. Verified: the stated scenario can't happen (`Map.set` never rejects), but it points at a real defect, the in-memory repositories returning live references. The coder/critic agents had not caught it. Follow-up: `docs/tasks/in-memory-repo-aliasing.md`. **[E]**
- **Takeaway:** 1 useful finding from 1, on a single run. CodeRabbit finds real issues, but its suggested fixes take the finding literally, so verify each one against the code before acting. One run isn't enough to judge its precision. **[O]**
- **Next:** more runs on other tasks, comparing CodeRabbit's findings with the critic agent's on the same diff. **[O]**

## Comparison

| Tool | Free tier (public repos) | Without PRs | Notes |
|---|---|---|---|
| CodeScene | Community Edition, public repos only | Yes, analyzes history | Possibly limited to org repos. The IDE extension is free "for a limited time period" and will later be for customers only. Whether the free tier allows the `cs delta` CLI token is not stated |
| SonarQube Cloud | Free plan: unlimited public projects, "only main branch analysis"; the OSS plan has Pro features for OSI-licensed repos | Yes, analyzes `main` | Docs don't confirm TS support in automatic analysis, so a scanner run in Actions may be needed |
| DeepSource | Unlimited public repos, 1,000 PR reviews a month | Yes, full analysis on every default-branch commit | AI Review and Autofix are pay-as-you-go, so leave them off |
| CodeRabbit | Free PR reviews "forever" on public repos | CLI only | OSS limits: 1–10 PR reviews per hour depending on stars, 3 CLI reviews per hour, 1 IDE review per hour |
| Codacy | "Free forever for open-source", unlimited public repos | Analyzes commits | Overlaps with Sonar and DeepSource, with no advantage here |
| Qodana | Community linters don't cover JS/TS | — | Out |

## Next steps

1. ~~Add `LICENSE`.~~ Done 2026-10-22: MIT.
2. Connect CodeScene Community Edition and confirm a personal repo is accepted.
3. Optional: run a CodeRabbit CLI review once on a real task's commits and compare its findings with the coder/critic agents' output.
4. Run Sonar or DeepSource only if a first scan proves they parse TS 7 and they find something the existing gates miss.

## Sources

- CodeRabbit: [pricing](https://www.coderabbit.ai/pricing), [CLI](https://docs.coderabbit.ai/cli/overview), [plans and rate limits](https://docs.coderabbit.ai/management/plans)
- CodeScene: [pricing](https://codescene.com/pricing), [FAQ](https://codescene.com/faqs), [Community Edition](https://codescene.com/product/codescene-for-open-source), [CLI](https://codescene.io/docs/cli/index.html), [VS Code extension](https://marketplace.visualstudio.com/items?itemName=CodeScene.codescene-vscode)
- Sonar: [plans and pricing](https://www.sonarsource.com/plans-and-pricing/), [SonarQube Cloud subscription plans](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- DeepSource: [pricing](https://deepsource.com/pricing), [full codebase review](https://docs.deepsource.com/docs/product/full-codebase-review)
- Codacy: [pricing](https://www.codacy.com/pricing)
- Qodana: [editions](https://www.jetbrains.com/help/qodana/pricing.html), [Qodana for JS](https://www.jetbrains.com/help/qodana/qodana-js.html)
