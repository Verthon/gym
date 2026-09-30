import { globSync } from "node:fs";

const offenders = globSync("src/**/*.{js,mjs,cjs}");

if (offenders.length > 0) {
  console.error(
    [
      `Found ${offenders.length} JavaScript file(s) in src/:`,
      ...offenders.map((file) => `  ${file}`),
      "src/ is TypeScript only and tsconfig.json has noEmit. These are usually stale tsc output that vitest resolves instead of the .mts source.",
      "Fix: delete them. Do not run tsc with --outDir or without --noEmit.",
    ].join("\n"),
  );
  process.exit(1);
}
