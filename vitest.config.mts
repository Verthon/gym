import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.spec.mts"],
		environment: "node",
		env: { GYM_TIME_ZONE: "Europe/Warsaw" },
	},
});
