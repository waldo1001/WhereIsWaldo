import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Azurite-backed adapter integration tests live under test/integration and run only
    // via `npm run test:integration` (vitest.integration.config.ts) — never here (CLAUDE.md:
    // `npm test` MUST never require Azurite).
    exclude: ["test/integration/**", "node_modules/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Thin integration surface — covered by integration tests later, not unit coverage.
      exclude: ["src/functions/**", "src/adapters/**"],
    },
  },
});
