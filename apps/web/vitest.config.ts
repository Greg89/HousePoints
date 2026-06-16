import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@/": `${path.resolve(__dirname, "src")}/`,
      "@housepoints/contracts": path.resolve(
        __dirname,
        "../../packages/contracts/src/index.ts",
      ),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
});
