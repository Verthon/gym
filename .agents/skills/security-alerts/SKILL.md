---
name: security-alerts
description: Read the repo's open GitHub security alerts (Dependabot, CodeQL code scanning, secret scanning) in one pass and report what is new since the last check. Use whenever the user mentions security in any form: security status, security check, "is it secure", vulnerabilities, alerts, CVEs, Dependabot, CodeQL, leaked secrets.
---

GitHub is the single source of truth. Three features, no overlap between them:

| Feature | Covers |
|---|---|
| Dependabot alerts | vulnerable packages in `pnpm-lock.yaml` |
| CodeQL default setup | security bugs in `src/` (runs on push to main + weekly) |
| Secret scanning + push protection | leaked credentials |

Do not add local scanners (Trivy, OSV-Scanner, Snyk) to this flow: they duplicate Dependabot.

## 1. Fetch

Run from the repo root. All three need the `gh` token's `repo` scope; secret scanning also needs repo admin.

```bash
R=$(gh repo view --json nameWithOwner -q .nameWithOwner)
mkdir -p reports/security

gh api --paginate "repos/$R/dependabot/alerts?state=open&per_page=100" --jq '.[] | {kind:"dependency", n:.number, sev:.security_advisory.severity, pkg:.dependency.package.name, scope:.dependency.scope, ghsa:.security_advisory.ghsa_id, cve:.security_advisory.cve_id, fixed_in:.security_vulnerability.first_patched_version.identifier, summary:.security_advisory.summary, url:.html_url}' > reports/security/dependabot.jsonl

gh api --paginate "repos/$R/code-scanning/alerts?state=open&per_page=100" --jq '.[] | {kind:"code", n:.number, sev:(.rule.security_severity_level // .rule.severity), rule:.rule.id, tool:.tool.name, path:.most_recent_instance.location.path, line:.most_recent_instance.location.start_line, msg:.most_recent_instance.message.text, url:.html_url}' > reports/security/code-scanning.jsonl

gh api --paginate "repos/$R/secret-scanning/alerts?state=open&per_page=100" --jq '.[] | {kind:"secret", n:.number, type:.secret_type_display_name, validity:.validity, bypassed:.push_protection_bypassed, url:.html_url}' > reports/security/secret-scanning.jsonl

gh api "repos/$R/code-scanning/analyses?per_page=1" --jq '.[0] | {created_at, commit_sha, tool:.tool.name}'
```

`reports/` is gitignored; snapshots stay local.

## 2. Check the sources are alive

A zero count only means "clean" if the source is working:

- Dependabot `403 "Dependabot alerts are disabled"` → report it as disabled, not clean.
- Code scanning `404 "no analysis found"` → CodeQL has not finished a first run yet.
- Latest CodeQL analysis older than 8 days → the weekly schedule has stopped (GitHub disables it after 6 months without pushes); say so.

## 3. Diff against the last check

Compare each `*.jsonl` with the `*.prev.jsonl` from the previous run, keyed by `kind` + `n` (GitHub alert numbers are stable). Then rotate: `for s in dependabot code-scanning secret-scanning; do cp "reports/security/$s.jsonl" "reports/security/$s.prev.jsonl"; done`. No previous file → everything counts as new.

## 4. Report

Order by severity: critical, high, medium, low. Lead with what is **new** or **closed** since last check, then the total open count per source. Per finding, one line:

- dependency: `sev pkg (scope) GHSA/CVE — fixed in X` + url
- code: `sev rule path:line — msg` + url
- secret: `type, validity, bypassed?` + url — any open secret goes first regardless of severity

For dependency alerts, say whether the package is a direct dependency in `package.json` or transitive, and whether a fix version exists.

## Boundaries

- Never dismiss, resolve, or reopen alerts via the API without the user's explicit say-so; it changes state on GitHub.
- Do not bump dependencies as part of this skill. Propose the fix; the user decides.
