/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "error",
      from: {
        orphan: true,
        pathNot: ["(^|/)__tests__/", "(^|/)index\\.ts$"],
      },
      to: {},
    },
    {
      name: "no-test-code-in-production",
      comment: "src/utils/test.mts, __tests__/ and vitest may only be imported from __tests__/",
      severity: "error",
      from: { path: "^src/", pathNot: ["(^|/)__tests__/", "^src/utils/test\\.mts$"] },
      to: { path: ["^src/utils/test\\.mts$", "(^|/)__tests__/", "(^|/)node_modules/vitest/"] },
    },
  ],
  allowed: [
    {
      from: { path: "^src/utils/" },
      to: { path: "^src/utils/" },
    },
    {
      from: { path: "^src/money/" },
      to: { path: ["^src/money/", "^src/utils/"] },
    },
    {
      from: { path: "^src/contracting/([^/]+)/" },
      to: {
        path: [
          "^src/contracting/$1/",
          "^src/contracting/draft/PersonId\\.mts$",
          "^src/money/",
          "^src/utils/",
        ],
      },
    },
    {
      comment: "test code may use vitest",
      from: { path: ["(^|/)__tests__/", "^src/utils/test\\.mts$"] },
      to: { path: "(^|/)node_modules/vitest/" },
    },
    {
      comment: "entry point, outside the domain",
      from: { path: "^src/index\\.ts$" },
      to: { path: "(^|/)node_modules/" },
    },
  ],
  allowedSeverity: "error",
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
