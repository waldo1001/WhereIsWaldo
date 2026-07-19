import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Thin integration surface — covered by integration tests later, not unit coverage.
      exclude: ["src/functions/**", "src/adapters/**"],
    },
  },
});
