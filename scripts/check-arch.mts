import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import { format, type ICruiseResult } from "dependency-cruiser";

const run = spawnSync("node_modules/.bin/depcruise", ["src", "--output-type", "json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

if (run.error !== undefined || run.stdout === "") {
  console.error(run.error?.message ?? run.stderr);
  console.error("depcruise did not run. Run pnpm install.");
  process.exit(1);
}

const isCruiseResult = (value: unknown): value is ICruiseResult =>
  typeof value === "object" && value !== null && "modules" in value && "summary" in value;

const parsed: unknown = JSON.parse(run.stdout);
if (!isCruiseResult(parsed)) {
  console.error("depcruise output is not a cruise result.");
  process.exit(1);
}
const result = parsed;
const { output } = await format(result, { outputType: "err-long" });
const report = typeof output === "string" ? output : "";
process.stdout.write(report);

const problems: string[] = [];

if (`${run.stdout}${run.stderr}${report}`.includes("missing-typescript-transpiler")) {
  problems.push(
    "depcruise has no TypeScript it can load (missing-typescript-transpiler), so it skips .mts sources and type-only imports.",
    "Fix: pnpm-workspace.yaml must keep packageExtensions.dependency-cruiser.dependencies.typescript pointing at TypeScript 6; check with `pnpm exec depcruise --info`.",
  );
}

const cruised = new Set(result.modules.map((module) => module.source));
const sources = globSync("src/**/*.mts");
const missed = sources.filter((file) => !cruised.has(file));

if (missed.length > 0) {
  problems.push(
    `depcruise cruised ${sources.length - missed.length} of ${sources.length} src/**/*.mts files. Not analyzed:`,
    ...missed.slice(0, 10).map((file) => `  ${file}`),
    ...(missed.length > 10 ? [`  ... and ${missed.length - 10} more`] : []),
    "Every src/**/*.mts file must be analyzed: depcruise reports no violations for files it never read.",
  );
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

if (result.summary.error > 0 || run.status !== 0) {
  process.exit(1);
}
