import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Spike scaffold: no tests yet. Vitest runs with --passWithNoTests via the
    // `test` script; Phase 1 tasks will add coverage for lib helpers.
  },
});
