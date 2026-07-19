import { defineConfig } from "vitest/config";

// Storage-adapter integration tests (specs/002 §6). Requires Azurite running locally
// (`npm run dev:storage`) or in CI; deliberately a separate vitest project from the
// default config so `npm test` (unit only) never touches Azurite or the network. Run with
// `npm run test:integration`.
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
