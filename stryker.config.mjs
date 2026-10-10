export default {
	testRunner: "vitest",
	plugins: ["@stryker-mutator/vitest-runner"],
	mutate: [
		"src/**/*.mts",
		"!src/**/__tests__/**",
		"!src/utils/test.mts",
		"!src/sandbox/**",
	],
	tsconfigFile: "tsconfig.stryker-skip.json",
	ignorePatterns: [".claude", ".agents", "docs", "architecture"],
	reporters: ["clear-text", "progress", "html", "json"],
	incremental: true,
	incrementalFile: "reports/stryker-incremental.json",
	thresholds: { high: 80, low: 60, break: null },
};
