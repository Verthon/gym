// oxlint configuration generated for Gym backend (Node.js)
// Docs: https://oxc.rs/docs/guide/usage/linter/config.html

export default {
  // Environment globals
  env: {
    node: true,
    es2022: true
  },

  // Enable rule groups with recommended severities
  categories: {
    correctness: "error",   // definitely wrong code
    suspicious: "warn",    // likely wrong code
    perf: "warn",          // micro-performance issues
    style: "warn"          // code-style consistency
  },

  // Built-in plugins useful for a TS Node project
  plugins: [
    "typescript",  // TS-specific rules
    "unicorn",     // extra modern JS rules
    "oxc"           // core rules (enabled by default)
  ],

  // File patterns Oxlint should ignore
  ignorePatterns: [
    "node_modules/**",
    "dist/**"
  ],

  // Fine-grained rule tweaks
  rules: {
    // Common backend best practices
    "no-console": "warn",          // allow but highlight accidental logs
    "no-var": "error",            // disallow var
    "prefer-const": "error",      // use const when possible

    // TS specific
    "typescript/no-unused-vars": [
      "error",
      { "args": "after-used", "ignoreRestSiblings": true }
    ],

    // Disable browser-centric unicorn rules
    "unicorn/prefer-module": "off"
  },

  // Overrides for test files
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],
      env: {
        node: true
      },
      rules: {
        "no-console": "off" // console output is fine in tests
      }
    }
  ]
} satisfies Record<string, unknown>;

