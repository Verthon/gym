import { defineConfig } from "oxlint";
// Docs: https://oxc.rs/docs/guide/usage/linter/config.html

export default defineConfig({
  env: {
    node: true,
    es2026: true,
  },
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
    style: "off",
  },

  plugins: [
    "typescript",
    "unicorn",
    "oxc",
    "eslint",
    "node",
    "vitest",
    "eslint",
    "promise",
    "import"
  ],

  rules: {
    "no-console": "warn", // allow but highlight accidental logs
    "no-var": "error", // disallow var
    "no-underscore-dangle": "off", // private _field + getter is the entity convention

    // TS specific
    "typescript/no-unused-vars": [
      "error",
      { args: "after-used", ignoreRestSiblings: true },
    ],

    // Disable browser-centric unicorn rules
    "unicorn/prefer-module": "off",

    "import/no-cycle": "error",
  },

  options: {
    typeAware: true,
    typeCheck: true,
    maxWarnings: 20,
    reportUnusedDisableDirectives: "error"
  },

  // Overrides for test files
  overrides: [
    {
      files: ["**/*.spec.mts", "**/__tests__/**"],
      env: {
        node: true,
      },
      rules: {
        "no-console": "off", // console output is fine in tests
        "vitest/expect-expect": [
          "error",
          { assertFunctionNames: ["expect", "failWith"] },
        ],
      },
    },
  ],
});
